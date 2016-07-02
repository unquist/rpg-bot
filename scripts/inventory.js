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
     
		var GoogleSpreadsheet = require('google-spreadsheet');

        robot.respond(/(inventory)/i, function(msg) {
            var callerName = msg.message.user.name;
			var command = msg.match[1] || "NAN";
    
            return msg.reply(callerName+" checked their inventory.");
        });
  
  
     
};

})();
