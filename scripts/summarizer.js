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
		
		var getRealNameFromId = function(userId){
			var user = robot.brain.data.users[userId];
			if(user == null)
			{
				return "<Unknown User>"
			}
			else if(user.real_name == "")
			{
				return "SYSTEM";
			}
		    return user.real_name;
		};
		
		//TODO: move this to something more modular. Maybe an environment variable?
		var summaryChannelId = 'C1RJ8KRD5';
		var campaignChannelId = 'C1D2ZTKF0';
		
		var randint = function(sides) {
            return Math.round(Math.random() * (sides - 1)) + 1;
        };
		
		//filters a message array, and returns the array. Since we assume slack will give us messages in the reverse order, this array re-sorts oldest-to-newest
		var messageFilter = function(messages)
		{
			var filteredMessages = new Array();
			for(var k = 0; k < messages.length; k++)
			{
				var archivedMessage = messages[k];
				var name = getRealNameFromId(archivedMessage.user);
				archivedMessage['real_name'] = name;
				var txt = archivedMessage.text;
				
				if(name == "<Unknown User>")
				{
					robot.logger.debug(util.inspect(archivedMessage));
				}
				
				//robot.logger.debug("Msg["+k+"] -> user_id:["+archivedMessage.user+"] user:["+name+"] txt:["+txt+"]");
				//throw away any system messages
				if(name == "SYSTEM")
				{
					continue;
				}
				
				//regex will find text enclosed by 1 or 3 backticks, or italicized
				var match = txt.match(/`{1}([^`]+)`{1}|`{3}([^`]+)`{3}|_{1}([^_]+)_{1}/i);
			 
				if(match != null)
				{
					//found a match, so this message goes into the array.
					//robot.logger.debug("Matched regex; insert into array and continue.");
					filteredMessages.push(archivedMessage);
					continue;
				}
				
				//we also want to save "/me" messages
				if(archivedMessage.subtype == "me_message")
				{
					//robot.logger.debug("Found /me message. Insert into arrary and continue");
					filteredMessages.push(archivedMessage);
					continue;
				}
				
				//we want to show combat start and end messages
				if(archivedMessage.subtype == "bot_message")
				{
					var attachments = archivedMessage.attachments;
					for(var k = 0; k < attachments.length; k++)
					{
						var attachment = attachments[k];
						var attachmentText = attachment['text'];
						if(/(All Combatants accounted for)|(Ending combat and clearing combat data)/.test(attachmentText))
						{
							archivedMessage['real_name'] = "Conan-bot";
							archivedMessage['text'] = attachmentText;
							filteredMessages.push(archivedMessage);
							break;
						}
						
					}
				}
				
				
			}
			return filteredMessages;				
		};
		
		robot.respond(/(summary)\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i, function(msg) {
            var callerName = msg.message.user.name;
			//robot.logger.debug(util.inspect(msg));
			var timeNow = new Date();
			var targetPastTime = new Date();
			var numberOfTimeUnits = Number(msg.match[2]) || 0;
			var typeOfTimeUnits = msg.match[3] || "hour";
			
			robot.logger.debug("User ["+callerName+"] asked for the log for ["+numberOfTimeUnits+"] ["+typeOfTimeUnits+"].");
			
			switch(typeOfTimeUnits)
			{
				case "minute":
				case "minutes":
					targetPastTime.setMinutes(timeNow.getMinutes()-numberOfTimeUnits);
					break;
				case "hour":
				case "hours":
					targetPastTime.setHours(timeNow.getHours()-numberOfTimeUnits);
					break;
				case "day":
				case "days":
					targetPastTime.setDate(timeNow.getDate()-numberOfTimeUnits);
					break;
				default:
					return msg.reply("I didn't recognize ["+typeOfTimeUnits+"]. Valid units are `minutes`, `hours` or `days`.");
			}
			
					
			//utc:
			//var utcTime = timeNow.getTime() / 1000;
			var utcTargetPastTime = (targetPastTime.getTime())/1000;
			
			var params = {
				channel: campaignChannelId,
				oldest: utcTargetPastTime,
				count: 1000
			};
						
			robot.slack.channels.history(params)// NOTE: could also give postMessage a callback
			.then(function (res) {
				robot.logger.debug("Successfully retrieved channel history.");
				//create the message with attachment object
				var summaryMessage = ""; 
				
				var filteredMessages = messageFilter(res.messages);
				
				for(var k = 0; k < filteredMessages.length; k++)
				{
					summaryMessage += "*"+filteredMessages[k].real_name+"*: " + filteredMessages[k].text + "\n\n";
				}
				var msgData = {
					channel: "@"+callerName,
					text: summaryMessage
				};

				//post the message
				robot.adapter.customMessage(msgData);
			})
			.catch(function (err) {
				robot.logger.debug("Couldn't get channel history: " + err);
			});
			
			return;
        });
		
		
		
/*End function definitions*/
	};
})();