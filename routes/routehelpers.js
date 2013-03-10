/*jslint node:true*/

(function(){
    "use strict";
    
    var step = require('step'),
        crypto = require('crypto');
    
    module.exports.sendSuccess = function(res,obj) {
	  var session = res.sessionToken;
	  res.send({status: 'ok', obj: obj,session:session});
	}

	module.exports.sendFailure = function(res,message) {
	  message = message.message || message;
	  var session = res.sessionToken;
	  res.send(400,{status: 'error',message: message,session:session});
	}
	
	module.exports.sendNotAuthed = function(res,message) {
	  res.send(403,{status: 'error',message: message});
	}
    
    function makeId(collection, filterTemplate, callback) {
        var generatedId = null;
        step(
            function generateCandidateId() {
                crypto.randomBytes(32,this)
            },
            function checkIfUnique(err, bytes) {
                if (err) throw err;

                generatedId = bytes.toString("hex");
                var filter = JSON.parse(filterTemplate.replace('$ID', generatedId));
                console.log('Checking for unique: ' + filterTemplate.replace('$ID', generatedId));
                collection.findOne(filter, this);
            },
            function retryIfNotUnique(err, foundObject) {
                if (err) {
                    callback(err);
                    return;
                }
                
                if (foundObject) {
                    makeId(collection, filterTemplate, callback);
                } else {
                    callback(null, generatedId);
                }
            }
        );
    }
    
    module.exports.makeId = makeId;
})();