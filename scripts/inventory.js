// Description:
//   Inventory tracker
//
// Dependencies:
//   google-spreadsheet
//
// Configuration:
//   None
//
// Commands:
//   
// Author:
//   unquist

(function() {
    module.exports = function(robot) {
     
		const GOOGLE_SERVICE_ACCOUNT = process.env.SERVICE_ACCOUNT;
		const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
		
		var GoogleSpreadsheet = require('google-spreadsheet');

        robot.respond(/(inventory)/i, function(msg) {
            robot.logger.debug("Inventory function");
			var callerName = msg.message.user.name;
			var command = msg.match[1] || "NAN";
			
			var doc = new GoogleSpreadsheet('1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0');
			
			//var creds = require('./google-generated-creds.json');
			var creds = {
			private_key: GOOGLE_PRIVATE_KEY,
			client_email : GOOGLE_SERVICE_ACCOUNT
			};
			
			doc.useServiceAccountAuth(creds, function(message){robot.logger.debug("Message["+message+"]");});
            robot.logger.debug("returning from inventory function");
			
			doc.getInfo(function (info){
				robot.logger.debug("title=["+info.title+"]");
			});
			
			return msg.reply(callerName+" checked their inventory.");
        });
  
  
     
};

})();
