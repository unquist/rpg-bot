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
     
		var google = require("googleapis");
		var util = require("util");
		var spreadsheet_wrapper = require('./spreadsheet_wrapper');

		robot.respond(/(delete brain auth key)/i, function(msg) {
			try{
				delete robot.brain.data._private['googleapi:credential'];
				return msg.reply("Successfully deleted googleapi:credential");
			}
			catch(err)
			{
				return msg.reply("error in <delete brain auth key>:" + err);
			}
			
		});
		
		robot.respond(/(inventory)/i, function(msg) {
			//robot.logger.debug(util.inspect(google));
			/*
			var serviceClient = google['sheets']("v4");
		
			robot.emit("googleapi:request", {
				service: "sheets",
				version: "v4",
				endpoint: "spreadsheets.values.get",
				params: {
					spreadsheetId: '1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0',
					range: 'Party Loot!A11:A17'
				},
				callback: function(err, data) {
					if (err) {
						return robot.logger.debug("inventory error:"+err);
					}
					var result = "";
					for(var k = 0; k < data.values.length; k++)
					{
						result += "["+k+"] <"+data.values[k]+">\n";
					}
					return msg.reply(result);
				}
			});
			*/
			//'1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0'
			//'Party Loot!A11:A17'
			spreadsheet_wrapper.getSpreadsheetValues('1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0','Party Loot!A11:A17',function(err, data) {
				if (err) {
					robot.logger.debug("getSpreadsheetValues error:"+err);
					return msg.reply(err.toString());
				}
				return msg.reply(data.values);
			});
        });
 
};

})();
