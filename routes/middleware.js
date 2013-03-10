/*jlint node:true*/

(function(){
    "use strict";
    
    var rh = require('./routehelpers'),
        step = require('step'),
        mongo = require('mongojs'),
        _ = require('underscore'),
        db = null;
    
    module.exports.setDb = function(pdb) {
        db = pdb;
    };
    
    module.exports.session = function(req, res, next) {
	    var sessionToken = req.headers.sessiontoken;
	    if (sessionToken) {
	        db.sessions.findOne({token: sessionToken},function(err,data) {
	            if (data) {
	                req.sessionObject = data;
	                res.sessionToken = sessionToken;
	                next();
	            } else {
	                res.sessionToken = "";
	                rh.sendNotAuthed(res,"Not logged in");
	            }
	        });
	    } else {
	        res.sessionToken = "";
	        rh.sendNotAuthed(res,"Not logged in");
	    }
	};
	
	module.exports.user = function(req, res, next) {
	    step(
	        function getUser() {
	            db.users.findOne({_id: req.sessionObject.user},this);
	        },
	        function gotUser(err, data) {
	            if (err) {
	                rh.sendFailure(res,err);
	                return;
	            }
	            if (data) {
	                req.user = data;
                    req.user.organisations = req.user.organisations || [];
	                next();
	            } else {
	                rh.sendFailure(res, 'Unable to find user');
	            }
	        }
	    )
	};
	
	module.exports.org = function(req, res, next) {
        var orgID = req.params.orgid;

	    if (!orgID) {
	        rh.sendFailure(res,"Invalid Organisation");
	        return;
	    }

        if(!req.user) {
            rh.sendFailure(res,"No user loaded");
            return;
        }
	    
	    step(
	        function getOrg() {
	            db.organisations.findOne({_id: mongo.ObjectId(orgID)}, this);
	        },
	        function foundOrg(err,orgData) {
	            if (err) {
	               rh.sendFailure(res, err);
	               return;
	            }
	            
	            if (!orgData) {
	               rh.sendFailure(res, "Organisation not found: "+orgID);
	               return;
   	            }
   	            
	            req.org = orgData;
	            req.org.accounts = req.org.accounts || [];
	            
	            next();
	        }
	    );
	};
	
	module.exports.acc = function(req, res, next) {
    	var acc, accID;
	
        if (!req.org) {
            rh.sendFailure(res, "Organisation not loaded");
        }

        accID = req.params.accid;

        if (!accID) {
            rh.sendFailure(res,"Invalid Account");
            return;
        }
        
	    acc = _.find(req.org.accounts, function(account) { return account.id === accID; });
	    
	    if (!acc) { throw new Error("Account not found: " + accID); }
	    
	    req.acc = acc;
	    
	    next();
	};
})();