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
			
			
			var timeNow = new Date();
			var targetPastTime = new Date();
			var numberOfTimeUnits = Number(msg.match[2]) || 0;
			var typeOfTimeUnits = msg.match[3] || "hour";
			
			robot.logger.debug("User ["+callerName+"] asked for the log for ["+numberOfTimeUnits+"] ["+typeOfTimeUnits+"].");
			
			targetPastTime.setHours(timeNow.getHours()-numberOfTimeUnits);
			
			//utc:
			//var utcTime = timeNow.getTime() / 1000;
			var utcTargetPastTime = targetPastTime.getTime();
			
			var params = {
				channel: campaignChannelId,
				oldest: utcTargetPastTime
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