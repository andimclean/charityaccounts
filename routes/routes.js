
/*
 * GET home page.
 */
var removeOnLogin = false; 
 
 
var crypto = require("crypto");
var mailer = require("nodemailer");
var mongo = require("mongojs");
var db = null;
var step = require("step");
var util = require("util");
var _ = require("underscore");
var rh = require("./routehelpers");
var mw = require("./middleware");

var emailTransport = mailer.createTransport("SMTP",{
    host: "smtp.ntlworld.com",
    port: 25
});

function index(req, res){
  res.redirect("index.html");
};

var login = {
    mw: [],
    handler: function login(req, res) {
	  var email = req.body.email;
	  var token = null;
	 
	  step(
	    function getRandomToken() {
	       rh.makeId(db.logintokens, '{"token":"$ID"}', this);
	    },
	    function saveToken(err, data) {
	        if (err) throw err;
	
	        token = data;
		    db.logintokens.save(
		      {
		        email: email,
		        token: token,
		        time: (new Date()).getTime()
		      },
		      this
		    );
	    },
	    function sendMail(err, saved) {
	        if (err) throw err;
	        
	        var url = req.protocol + "://" + req.headers.host+"/index.html#loginconfirm/"+token;
	        var mailOptions = {
	            from: email, // sender address
	            to: email,
	            subject: "Charity Accounts Sign In", // Subject line
	            text: url, // plaintext body
	            html: "<a href='"+url+"'>"+url+"</a>" // html body
	        }
	        
	        // send mail with defined transport object
	        emailTransport.sendMail(mailOptions, this);
	    },
	    function sendResponse(err, response) {
		    if(err){
		        rh.sendFailure(res,err);
		    }else{
		        rh.sendSuccess(res);
		    }
	    }
	  );
	}
};

var loginConfirm = {
    mw: [],
    handler: function (req,res) {
	    var token = req.body.token;
	    if (!token) {
	        rh.sendFailure(res,'Invalid token');
	        return;
	    }
	    
	    var tokenData = null;
	    var user = null;
	    var session = null;
	    step(
	        function findToken() {
	            db.logintokens.findOne({token:token},this);
	        },
	        function validateToken(err, data) {
	            if (err) throw err;
	            
	            if (!data) {
	                throw new Error("Invalid token");
	            }
	            
	            return data;
	        },
	        function markTokenUsed(err,data) {
	            if (err) throw err;
	            tokenData = data;
	             
	            if (removeOnLogin) {
		            db.logintokens.remove({token:token}, this);
	            } else {
	                return data;
	            }
	        },
	        function getUserDetails(err,data) {
	            if (err) throw err;
	            db.users.findOne({email: tokenData.email},this);
	        },
	        function setupNewUser(err,data) {
	            if (err) throw err;
	            if (data) {
	                user = data;
	                return user;
	            } else {
	                user = {
	                    'email': tokenData.email,
	                    'organisations': [],
	                    'name':tokenData.email.split('@')[0],
	                };
	                db.users.save(user,this);
	            }
	        },
	        function createSessionData(err, data) {
	            if (err) throw err;
	            
	            rh.makeId(db.sessions, '{"token":"$ID"}', this);
	        },
	        function saveNewSession(err, data) {
	            if (err) throw err;
	            session = {
	                token: data,
	                user: user._id
	            };
	            db.sessions.save(session, this);
	        },
	        function sendResponse(err,data) {
		        if (err) {
		            rh.sendFailure(res,'Invalid token: '+err);
		            return;
		        }
		        res.sessionToken = session.token;
		        rh.sendSuccess(res,user);
	        }
	    );
	}
};

var getUser = {
    mw: [mw.session, mw.user],
	handler: function (req,res){
	    rh.sendSuccess(res,req.user);
	}
};

var logout = {
    mw: [mw.session],
    handler: function (req,res){
	    var sessionToken = res.sessionToken;
	    if (sessionToken) {
	        db.sessions.remove({token: sessionToken},function(err,data) {
	            if (err) {
	                rh.sendFailure(res,err);
	            } else {
		            res.sessionToken = '';
		            req.sessionObject = null;
		            rh.sendSuccess(res,null);
		        }
	        });
	    } else {
	        res.sessionToken = '';
	        req.sessionObject = null;
	        rh.sendSuccess(res,null);
	    }
	}
};

var addOrg = {
    mw: [mw.session, mw.user],
    handler: function (req,res) {
	    var orgName = req.body.orgs;
	    console.log(util.inspect(req.body));
	    if (!orgName) {
	        console.log(util.inspect(orgName));
	        rh.sendFailure(res,"Invalid name");
	        return;
	    }
	    var org = null;
	    step(
	        function findOrg() {
	            db.organisations.findOne({name:orgName},this);
	        },
	        function checkNotExists(err,data) {
	            if (err) throw err;
	            console.log("checkNotExists: " + util.inspect(data));
	            if (data) {
	                throw new Error('Already exists');
	            }
	            return data;
	        },
	        function addOrg(err,data) {
	            if (err) throw err;
	            console.log("addOrg: " + data);
	            org = {
	                name: orgName
	            };
	            db.organisations.save(org,this);
	        },
	        function updateUser(err,data) {
	            if (err) throw err;
	            req.user.organisations.push(org);
	            db.users.save(req.user,this);
	        },
	        function returnUser(err,data) {
	            console.log("returnUser: " + data);
	            if (err) {
	               rh.sendFailure(res,err);
	            } else {
	               rh.sendSuccess(res,req.user);
	            }
	        }
	    );
	}
};

var removeOrg = {
    mw: [mw.session, mw.user, mw.org],
    handler: function(req,res) {
	    console.log("Remove Org id : " + req.org._id);
	    step(
	       function updateUser() {
	            req.user.organisations = _.filter(req.user.organisations,function(item) {
	                return req.org._id.toString() != item._id.toString();
	            });
	            console.log("New user array : " + util.inspect(req.user));
	            db.users.save(req.user,this);
	        },
	        function returnUser(err) { // Not using the data returned from save
	            if (err) {
	               rh.sendFailure(res,err);
	            } else {
	             console.log("New User: " + util.inspect(req.user));
	               rh.sendSuccess(res,req.user);
	            }
	        }
	    );
	}
};

var getOrg = {
    mw: [mw.session, mw.user, mw.org],
    handler: function(req,res) {
	    rh.sendSuccess(res,req.org);
	}
};

var getTransactions = {
    mw: [mw.session, mw.user, mw.org, mw.acc],
    handler: function(req,res) {
	    var fromTxn = parseInt(req.params.from);
	    
	    var countTxn = parseInt(req.params.count);
	    if (!countTxn) {
	        rh.sendFailure(res, "Invalid Transaction Count");
	        return;
	    }
	            
	    var id;
	    var txn;
	    step(
	        function checkAccount() {
	            db.transactions.find({orgid: req.org._id, accid:req.acc.id})
	                .sort({date: -1, id: -1})
	                .skip(fromTxn)
	                .limit(countTxn)
	                .toArray(this.parallel());
	            db.transactions.find({orgid: req.org._id, accid:req.acc.id})
	                .count(this.parallel());
	        },
	        function sendData(err, transactions , size) {
	            if (err) {
	                rh.sendFailure(res,err);
	            } else {
	                rh.sendSuccess(res,{size: size , items:transactions});
	            }
	        }
	    );
	}
};

var addAccount = {
    mw: [mw.session, mw.user, mw.org],
	handler: function(req,res) {
	    var accountName = req.body.accountname;
	    if (!accountName) {
	        rh.sendFailure(res,"Invalid Account Details");
	        return;
	    }
	    
	    var id;
	    step(
	        function createAccountId() {
	           rh.makeId(db.organisations, '{"accounts.id": "$ID"}', this);
	        },
	        function idCreated(err,bytes) {
	            if (err) throw err;
	            if (!bytes) throw new Error("ID not generated");
	            
	            id = bytes.toString("hex");;
	            
	            req.org.accounts.push({
	                id: id,
	                name: accountName,
	                balance: 0,
	                org: req.org._id
	            });
	            
	            db.organisations.save(req.org,this);
	        },
	        function savedOrg(err,data) {
	            if (err) {
	                rh.sendFailure(res,err);
	            } else {
	                rh.sendSuccess(res,req.org);
	            }
	        }
	    );
	}
};

var removeAccount = {
    mw: [mw.session, mw.user, mw.org, mw.acc],
    handler: function(req,res) {
	    console.log("Remove Account Id : " + req.org._id + ":" + req.acc.id);
	    step(
	        function findAccount() {
	            req.org.accounts = _.filter(req.org.accounts,function(item) {
	                return req.acc.id != item.id;
	            });
	
	            db.organisations.save(req.org,this);
	        },
	        function savedOrg(err,data) {
	            if (err) {
	                rh.sendFailure(res,err);
	            } else {
	                rh.sendSuccess(res,req.org);
	            }
	        }
	    );
	}
};

var getAcc = {
    mw: [mw.session, mw.user, mw.org, mw.acc],
    handler: function(req, res) {
		rh.sendSuccess(res,req.acc);
	}
};

var addTransaction = {
    mw: [mw.session, mw.user, mw.org, mw.acc],
    handler: function(req,res) {
	    var id;
	    var txn;
	    step(
	        function getCreateTxnId() {
	            rh.makeId(db.transactions, '{"id":"$ID"}', this);
	        },
	        function createdTxnId(err,newid) {
	            if (err) throw err;
	            if (!newid) throw new Error("ID not generated");
	           
	            id = newid;
	            return true;
	        },
	        function buildTransactionRecord(err) {
	            if (err) throw err;

                var amount = parseFloat(req.body.amount) * 100;
                if (req.body.transfered == 'out') {
                    amount *= -1;
                }
               
                txn = {
                    id: '',
                    orgid: req.org._id,
                    accid: req.acc.id,
                    date: Date.parse(req.body.date),
                    description: req.body.description,
                    amount: amount,
                    dayid: id,
                    daycounter: 0
                };
                
                return true;
	        },
	        function getPreviousTransaction(err) {
                if (err) throw err;
	           
				db.transactions.find({orgid: txn.orgid, accid: txn.accid, date: {$lte: txn.date}}).sort({date:-1, id:-1}).limit(1).toArray(this);
	        },
	        function gotPreviousTransaction(err, prev_transactions) {
	            if (err) throw err;

                if (prev_transactions && prev_transactions.length === 1) {
    	            txn.total = prev_transactions[0].total + txn.amount;
    	            if (prev_transactions[0].date === txn.date) {
    	               txn.dayid = prev_transactions[0].dayid;
    	               txn.daycounter = prev_transactions[0].daycounter + 1;
    	            }
    	        } else {
                    txn.total = txn.amount;
    	        }
    	        
    	        txn.id = txn.dayid + '_' + ('00000000' + txn.daycounter).slice(-8);

	            db.transactions.save(txn,this.parallel());
	            
	            db.transactions.update({orgid: txn.orgid, accid: txn.accid, date: {$gt: txn.date}}, {$inc: {total: txn.amount}}, {multi:true}, this.parallel);
	            
	            req.acc.balance += txn.amount;
	            db.organisations.save(req.org, this.parallel());
	        },
	        function savedTxn(err,txndata, updateres, orgdata) {
	            if (err) {
	                rh.sendFailure(res,err);
	            } else {
	                rh.sendSuccess(res,req.acc);
	            }
	        }
	    );
	}
};



exports.bind = function bindRoutes(app) {
	function bindRoute(method, path, route) {
	    app[method](path, route.mw, route.handler);
	}
	
    db = mongo.connect(app.get("mongodb"),["logintokens", "users", "sessions","organisations","transactions"]);
    mw.setDb(db);
    
	app.get('/', index);
	bindRoute('get', '/api/getUser', getUser);
    bindRoute('get', '/api/getOrg/:orgid', getOrg);
    bindRoute('get', '/api/getAcc/:orgid/:accid', getAcc);
    bindRoute('get', '/api/getTransactions/:orgid/:accid/:from/:count', getTransactions);

    bindRoute('post', '/api/login', login);
	bindRoute('post', '/api/loginConfirm', loginConfirm);
	bindRoute('post', '/api/logout', logout);
	bindRoute('post', '/api/addOrg', addOrg);
	bindRoute('post', '/api/removeOrg/:orgid', removeOrg);
	bindRoute('post', '/api/addAccount/:orgid', addAccount);
	bindRoute('post', '/api/removeAccount/:orgid/:accid', removeAccount);
	bindRoute('post', '/api/addTransaction/:orgid/:accid', addTransaction);
};

