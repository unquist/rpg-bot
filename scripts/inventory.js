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
     
		//const GOOGLE_SERVICE_ACCOUNT = process.env.SERVICE_ACCOUNT;
		//const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
		var google = require("googleapis")
		var util = require("util");
		//var GoogleSpreadsheet = require('google-spreadsheet');
		/*
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
		*/
		robot.respond(/(inventory)/i, function(msg) {
			//robot.logger.debug(util.inspect(google));
			var serviceClient = google['sheets']("v4");
		
			robot.emit("googleapi:request", {
				service: "sheets",
				version: "v4",
				endpoint: "spreadsheets.values.get",
				params: {
					spreadsheetId: '1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0',
					range: 'A11:A17'
				},
				callback: function(err, data) {
					if (err) {
						return robot.logger.debug("inventory error:"+err);
					}
					for(var k = 0; k < data.values.length; k++)
					{
						robot.logger.debug("["+k+"] <"+data.values[k]+">");
					}
					return "Finished."
				}
			});
        });

  
     
};

})();
