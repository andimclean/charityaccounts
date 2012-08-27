
/*
 * GET home page.
 */
var crypto = require("crypto");
var mailer = require("nodemailer");
var mongo = require("mongojs");
var db = null;
var step = require("step");

var emailTransport = mailer.createTransport("SMTP",{
    host: "smtp.ntlworld.com",
    port: 25
});

function sendSuccess(res,obj) {
  var session = res.sessionToken;
  res.send({status: 'ok', obj: obj,session:session});
}

function sendFailure(res,message) {
  res.send(400,{status: 'error',message: message});
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
	        console.log(err);
	        sendFailure(res,err);
	    }else{
	        console.log("Message sent: " + response.message);
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
        },/*
        function markTokenUsed(err,data) {
            if (err) throw err;
            tokenData = data;
            db.logintokens.remove({token:token}, this);
        },*/
        function getUserDetails(err,data) {
            if (err) throw err;
            tokenData = data;
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

function parseSession(req, res, next) {

    var sessionToken = req.headers.sessionToken;
    if (sessionToken) {
        db.sessions.findOne({token: sessionToken},function(data) {
            req.sessionObject = data;
            res.sessionToken = req.headers.sessionToken;
            next(req,res);    
        });
    }
    
    res.sessionToken = "";
    sendFailure(res,"Not logged in");
}

exports.bind = function bindRoutes(app) {
    db = mongo.connect(app.get("mongodb"),["logintokens", "users", "sessions"]);
	app.get('/', index);
	app.post('/api/login',login);
	app.post('/api/loginConfirm',loginConfirm);
};
