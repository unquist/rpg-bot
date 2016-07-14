// Description:
//   summarizes the recent action
//
// Dependencies:
//   None
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
        var util = require("util");
		
		//TODO: move this to something more modular. Maybe an environment variable?
		var summaryChannelId = 'C1RJ8KRD5';
		
		var campaignChannelId = 'C1D2ZTKF0';
		
		var randint = function(sides) {
            return Math.round(Math.random() * (sides - 1)) + 1;
        };
		
		robot.respond(/(summary)\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i, function(msg) {
            var callerName = msg.message.user.name;
			robot.logger.debug(util.inspect(msg));
			
			var params = {
				channel: campaignChannelId,
				
			};
			
			robot.slack.channels.history(params)// NOTE: could also give postMessage a callback
			.then(function (res) {
				robot.logger.debug("Successfully retrieved channel history. Result was " + util.inspect(res));
				//create the message with attachment object
				var msgData = {
					channel: summaryChannelId,
					text: "Summary test"
				};

				//post the message
				robot.adapter.customMessage(msgData);
			})
			.catch(function (err) {
				robot.logger.debug("Couldn't get channel history: " + err);
			});
			
			return;
        });
		
		
		var getChannelHistory = function (msgObj, robot) {

		}
		
/*End function definitions*/
	};
})();