
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

var emailTransport = mailer.createTransport("SMTP",{
    host: "smtp.ntlworld.com",
    port: 25
});

function sendSuccess(res,obj) {
  var session = res.sessionToken;
  res.send({status: 'ok', obj: obj,session:session});
}

function sendFailure(res,message) {
  message = message.message || message;
  var session = res.sessionToken;
  res.send(400,{status: 'error',message: message,session:session});
}

function sendNotAuthed(res,message) {
  res.send(403,{status: 'error',message: message});
}
function index(req, res){
  res.redirect("index.html");
};

function login(req, res) {
  var email = req.body.email;
  var token = null;
 
  step(
    function getRandomToken() {
        crypto.randomBytes(32,this);
    },
    function saveToken(err, data) {
        if (err) throw err;

        token = data.toString("hex");
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
	        sendFailure(res,err);
	    }else{
	        sendSuccess(res);
	    }
    }
  );
}
function loginConfirm(req,res) {
    var token = req.body.token;
    if (!token) {
        sendFailure(res,'Invalid token');
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
            
            crypto.randomBytes(16, this);
        },
        function saveNewSession(err, data) {
            if (err) throw err;
            session = {
                token: data.toString('hex'),
                user: user._id
            };
            db.sessions.save(session, this);
        },
        function sendResponse(err,data) {
	        if (err) {
	            sendFailure(res,'Invalid token: '+err);
	            return;
	        }
	        res.sessionToken = session.token;
	        sendSuccess(res,user);
        }
    );
}

function getUser(req,res){
    var sessionObj = req.sessionObject;
    db.users.findOne({_id:sessionObj.user},function(err,data) {
        if (!err) {
            sendSuccess(res,data);
        } else {
            sendFailure(res,err);
        }
    });
}

function parseSession(req, res, next) {

    var sessionToken = req.headers.sessiontoken;
    if (sessionToken) {
        db.sessions.findOne({token: sessionToken},function(err,data) {
            if (data) {
	            req.sessionObject = data;
	            res.sessionToken = sessionToken;
	            next();
	        } else {
	            res.sessionToken = "";
                sendNotAuthed(res,"Not logged in");
            }
        });
    } else {
	    res.sessionToken = "";
	    sendNotAuthed(res,"Not logged in");
	}
}

function logout(req,res){
    var sessionToken = res.sessionToken;
    if (sessionToken) {
        db.sessions.remove({token: sessionToken},function(err,data) {
            if (err) {
                sendFailure(res,err);
            } else {
	            res.sessionToken = '';
	            req.sessionObject = null;
	            sendSuccess(res,null);
	        }
        });
    } else {
        res.sessionToken = '';
        req.sessionObject = null;
        sendSuccess(res,null);
    }
}
function addOrg(req,res) {
    var orgName = req.body.orgs;
    console.log(util.inspect(req.body));
    if (!orgName) {
        console.log(util.inspect(orgName));
        sendFailure(res,"Invalid name");
        return;
    }
    var org = null;
    var user = null;
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
        function getUser(err,data) {
            if (err) throw err;
            console.log("getUser:" + data);
            if (!data) {
                throw new Error('Could not save organisation');
            }
            db.users.findOne({_id: req.sessionObject.user},this);
        },
        function updateUser(err,data) {
            if (err) throw err;
            console.log("updateUser: " + data);
            if (!data) {
                throw new Error('Could not find user');
            }
            user = data;
            user.organisations.push(org);
            db.users.save(user,this);
        },
        function returnUser(err,data) {
            console.log("returnUser: " + data);
            if (err) {
               sendFailure(res,err);
            } else {
               sendSuccess(res,user);
            }
        }
    );
}

function removeOrg(req,res) {
    var orgId = req.body.orgid;
    if (!orgId) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    console.log("Remove Org id : " + orgId);
    var user;
    step(
        function getUser() {
            db.users.findOne({_id: req.sessionObject.user},this);
        },
        function updateUser(err,data) {
            if (err) throw err;
            if (!data) {
                throw new Error('Could not find user');
            }
            user = data;
            user.organisations = _.filter(user.organisations,function(item) {
                return orgId != item._id;
            });
            console.log("New user array : " + util.inspect(user));
            db.users.save(user,this);
        },
        function returnUser(err,data) {
            if (err) {
               sendFailure(res,err);
            } else {
             console.log("New User: " + util.inspect(user));
               sendSuccess(res,user);
            }
        }
    );
}

function getOrg(req,res) {
    var orgID = req.params.orgid;
    if (!orgID) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    step(
        function getOrg() {
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this);
        },
        function foundOrg(err,data) {
            if (err) {
               sendFailure(res,err);
            } else {
              if (!data) {
                sendFailure(res,new Error("Organisation not found: "+orgID));
              } else {
                sendSuccess(res,data);
              }
            }
        }
    );
}

function getTransactions(req,res) {
    var orgID = req.params.orgid;
    if (!orgID) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    
    var accID = req.params.accid;
    if (!accID) {
        sendFailure(res,"Invalid Account");
        return;
    }
    
    var fromTxn = parseInt(req.params.from);
    
    var countTxn = parseInt(req.params.count);
    if (!countTxn) {
        sendFailure(res, "Invalid Transaction Count");
        return;
    }
            
    var org;
    var id;
    var acc;
    var txn;
    step(
        function getOrg() {
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this.parallel());
            db.users.findOne({_id: req.sessionObject.user},this.parallel());
        },
        function checkAccount(err, orgData, userData) {
            if (err) throw err;
            if (!orgData) throw new Error('Unable to find Organisation: ' + orgID);
            if (!userData) throw new Error('Unable to find user: ' + req.sessionObject.user);
            
            org = orgData;
            org.accounts = org.accounts || [];
            acc = _.find(org.accounts, function(account) { return account.id === accID; });
            
            if (!acc) throw new Error('Unable to find account: ' + accID);
            
            db.transactions.find({orgid: orgID, accid:accID})
                .sort({date: -1})
                .skip(fromTxn)
                .limit(countTxn)
                .toArray(this.parallel());
            db.transactions.find({orgid: orgID, accid:accID})
                .count(this.parallel());
        },
        function sendData(err, transactions , size) {
            if (err) {
                sendFailure(res,err);
            } else {
                sendSuccess(res,{size: size , items:transactions});
            }
        }
    );
}

function addAccount(req,res) {
    var accountName = req.body.account;
    var orgID = req.body.org;
    
    if (!orgID) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    if (!accountName) {
        sendFailure(res,"Invalid Account Details");
        return;
    }
    
    var org;
    var id;
    step(
        function getOrg() {
            crypto.randomBytes(32,this.parallel());
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this.parallel());
        },
        function foundOrg(err,bytes,data) {
            if (err) throw err;
            if (!data)  throw new Error("Organisation not found: "+orgID);
            if (!bytes) throw new Error("ID not generated");
            
            id = bytes.toString("hex");;
            org = data;
            org.accounts = org.accounts || [];
            
            org.accounts.push({
                id: id,
                name: accountName,
                balance: 0,
                org: orgID
            });
            
            db.organisations.save(org,this);
        
        },
        function savedOrg(err,data) {
            if (err) {
                sendFailure(res,err);
            } else {
                sendSuccess(res,org);
            }
        }
    );
}

function removeAccount(req,res) {
    var orgID = req.body.orgid;
    if (!orgID) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    var accountID = req.body.accountid;
    if (!accountID) {
        sendFailure(res,"Invalid AccountId");
        return;
    }
    
    console.log("Remove Account Id : " + orgID + ":" + accountID);
    var org;
    step(
        function getOrg() {
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this);
        },
        function foundOrg(err,data) {
            if (err) throw err;
            if (!data)  throw new Error("Organisation not found: "+orgID);
            
            org = data;
            org.accounts = org.accounts || [];
            
            org.accounts = _.filter(org.accounts,function(item) {
                return accountID != item.id;
            });

            db.organisations.save(org,this);
        
        },
        function savedOrg(err,data) {
            if (err) {
                sendFailure(res,err);
            } else {
                sendSuccess(res,org);
            }
        }
    );
}

function getAcc(req,res) {
    var orgID = req.params.orgid;
    if (!orgID) {
    	console.log('OrgID is null');
        sendFailure(res,"Invalid Organisation");
        return;
    }
    var accountID = req.params.accid;
    if (!accountID) {
    	console.log('Account ID is null');
        sendFailure(res,"Invalid AccountId");
        return;
    }
    
    console.log("Find Account Id : " + orgID + ":" + accountID);
    var org;
    step(
        function getOrg() {
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this);
        },
        function foundOrg(err,data) {
            if (err) {
            	sendFailure(res,err);
            	return;
            }
            if (!data) {
            	sendFailure(res,new Error("Organisation not found: "+orgID));
            	return;
            }
            
            org = data;
            org.accounts = org.accounts || [];
            
            var accounts = _.filter(org.accounts,function(item) {
                return accountID == item.id;
            });

            if (accounts.length != 1) {
            	sendFailure(res,new Error("Account not found"));
            	return;
            }
        	sendSuccess(res,accounts[0]);
        }
    );
}

function addTransaction(req,res) {
    var orgID = req.params.orgid;
    var accID = req.params.accid;
    
    if (!orgID) {
        sendFailure(res,"Invalid Organisation");
        return;
    }
    if (!accID) {
        sendFailure(res,"Invalid Account");
        return;
    }
    
    var org;
    var id;
    var acc;
    var txn;
    step(
        function getOrg() {
            crypto.randomBytes(32,this.parallel());
            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this.parallel());
            db.users.findOne({_id: req.sessionObject.user},this.parallel());
        },
        function foundOrg(err,bytes,orgData,userData) {
            if (err) throw err;
            if (!bytes) throw new Error("ID not generated");
            if (!orgData)  throw new Error("Organisation not found: "+orgID);
            if (!userData) throw new Error("User not found: " + req.sessionObject.user);
            
            id = bytes.toString("hex");
            org = orgData;
            org.accounts = org.accounts || [];
            acc = _.find(org.accounts, function(account) { return account.id === accID; });
            
            if (!acc) { throw new Error("Account not found: " + accID); }
            
            var amount = parseFloat(req.body.amount) * 100;
            if (req.body.transfered == 'out') {
                amount *= -1;
            }
            
            txn = {
                id: id,
                orgid: orgID,
                accid: accID,
                date: Date.parse(req.body.date),
                description: req.body.description,
                amount: amount
            };
            
            db.transactions.save(txn,this);
        },
        function savedOrg(err,data) {
            if (err) {
                sendFailure(res,err);
            } else {
                sendSuccess(res,txn);
            }
        }
    );
}


exports.bind = function bindRoutes(app) {
    db = mongo.connect(app.get("mongodb"),["logintokens", "users", "sessions","organisations","transactions"]);
	app.get('/', index);
	app.get('/api/getUser',parseSession,getUser);
    app.get('/api/getOrg/:orgid',parseSession,getOrg);
    app.get('/api/getAcc/:orgid/:accid',parseSession,getAcc);
    app.get('/api/getTransactions/:orgid/:accid/:from/:count',parseSession,getTransactions);

    app.post('/api/login', login);
	app.post('/api/loginConfirm', loginConfirm);
	app.post('/api/logout',parseSession, logout);
	app.post('/api/addOrg',parseSession, addOrg);
	app.post('/api/removeOrg',parseSession, removeOrg);
	app.post('/api/addAccount',parseSession, addAccount);
	app.post('/api/removeAccount', parseSession, removeAccount);
	app.post('/api/addTransaction/:orgid/:accid', parseSession, addTransaction);
};

