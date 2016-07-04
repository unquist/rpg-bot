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
			GoogleSpreadsheet.useServiceAccountAuth({client_email:GOOGLE_SERVICE_ACCOUNT,private_key:GOOGLE_PRIVATE_KEY}, callback)
            robot.logger.debug("returning from inventory function");
			return msg.reply(callerName+" checked their inventory.");
        });
  
  
     
};

})();
