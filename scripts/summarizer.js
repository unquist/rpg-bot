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
		
		var summarizeIntervalInMinutes = Number(process.env.RPGBOT_SUMMARIZE_INTERVAL) || 0;
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
		
		//don't turn on the cron job if the variable is set to zero
		if(summarizeIntervalInMinutes != 0)
		{
			var HubotCron = require('hubot-cronjob');
		
			var fn, pattern, timezone;
			pattern = '1 */'+summarizeIntervalInMinutes+' * * * *';
			timezone = 'America/New_York';
			robot.logger.debug("Initializing cron job with pattern ["+pattern+"] and timezone ["+timezone+"]");
			fn = function(err) {
				robot.logger.debug("Executing postSummary cron job");
				postSummary("CRON",summarizeIntervalInMinutes,'minutes');
			};
			new HubotCron(pattern, timezone, fn);
		}
		
		var randint = function(sides) {
            return Math.round(Math.random() * (sides - 1)) + 1;
        };
		
		var sortMessagesChronologically = function(a,b) {
			var timeA=Number(a.ts);
			var timeB=Number(b.ts);
			if (timeA < timeB) //sort string ascending
				return -1 
			if (timeA > timeB)
				return 1
			return 0 //default return value (no sorting) 
		};
		
		//filters a message array, and returns the array. Since we assume slack will give us messages in the reverse order, this array re-sorts oldest-to-newest
		var messageFilter = function(messages)
		{
			var sortedMessages = messages.sort(sortMessagesChronologically);
			var filteredMessages = new Array();
			robot.logger.debug("messageFilter function recieved ["+sortedMessages.length+"] messages.");
			for(var k = 0; k < sortedMessages.length; k++)
			{
				var archivedMessage = sortedMessages[k];
				var name = getRealNameFromId(archivedMessage.user);
				archivedMessage['real_name'] = name;
				var txt = archivedMessage.text;
				
				/*
				if(name == "<Unknown User>")
				{
					robot.logger.debug(util.inspect(archivedMessage));
				}
				*/
				
				//robot.logger.debug("Msg["+k+"] -> user_id:["+archivedMessage.user+"] user:["+name+"] txt:["+txt+"]");
				//throw away any system messages
				if(name == "SYSTEM")
				{
					continue;
				}
				
				if(txt.indexOf("&gt") != -1)
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
					archivedMessage.text = "_" + archivedMessage.text + "_";
					filteredMessages.push(archivedMessage);
					continue;
				}
				
				//we want to show combat start and end messages
				if(archivedMessage.subtype == "bot_message")
				{
					var attachments = archivedMessage.attachments;
					for(var i = 0; i < attachments.length; i++)
					{
						var attachment = attachments[i];
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
			robot.logger.debug("message filter function returning ["+filteredMessages.length+"] messages");
			return filteredMessages;				
		};
		
		var postSummary = function(callerName,numberOfTimeUnits,typeOfTimeUnits)
		{
			var timeNow = new Date();
			var targetPastTime = new Date();
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
						
			requestChannelHistory(params);
			
			return;
		};
		
		var requestChannelHistory = function(params)
		{
			robot.slack.channels.history(params)// NOTE: could also give postMessage a callback
			.then(function (res) {
				robot.logger.debug("Successfully retrieved channel history.");
				
				if(res.has_more)
				{
					var recursive_params = {
						channel: campaignChannelId,
						oldest: params.oldest,
						latest: Number(res.messages[res.messages.length-1].ts),
						count: 1000
					};
					robot.logger.debug("sending recursive params: " + util.inspect(recursive_params));
					
					robot.slack.channels.history(params)// NOTE: could also give postMessage a callback
					.then(function (_res) {
						robot.logger.debug("Successfully retrieved channel history.");
						//create the message with attachment object
						var _summaryMessage = ""; 
					
						var _filteredMessages = messageFilter(_res.messages);
						robot.logger.debug("returned from messageFilter");
						for(var _k = 0; _k < _filteredMessages.length; _k++)
						{
							_summaryMessage += "*"+_filteredMessages[_k].real_name+"*: " + _filteredMessages[_k].text + "\n\n";
						}
						robot.logger.debug("sending a message with length ["+_summaryMessage.length+"] to channel ["+summaryChannelId+"]");
						var _msgData = {
							channel: summaryChannelId,
							text: _summaryMessage
						};

						//post the message
						robot.adapter.customMessage(_msgData);
					})
					.catch(function (err) {
						robot.logger.debug("Couldn't get channel history: " + err);
					});
				}
				
				//create the message with attachment object
				var summaryMessage = ""; 
				
				var filteredMessages = messageFilter(res.messages);
				robot.logger.debug("returned from messageFilter");
				for(var k = 0; k < filteredMessages.length; k++)
				{
					summaryMessage += "*"+filteredMessages[k].real_name+"*: " + filteredMessages[k].text + "\n\n";
				}
				robot.logger.debug("sending a message with length ["+summaryMessage.length+"] to channel ["+summaryChannelId+"]");
				var msgData = {
					channel: summaryChannelId,
					text: summaryMessage
				};

				//post the message
				robot.adapter.customMessage(msgData);
			})
			.catch(function (err) {
				robot.logger.debug("Couldn't get channel history: " + err);
			});
			return;
		};
		
		robot.respond(/(summary)\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i, function(msg) {
            var callerName = msg.message.user.name;
			//robot.logger.debug(util.inspect(msg));
	
			var numberOfTimeUnits = Number(msg.match[2]) || 0;
			var typeOfTimeUnits = msg.match[3] || "hour";
			
			robot.logger.debug("User ["+callerName+"] asked for the log for ["+numberOfTimeUnits+"] ["+typeOfTimeUnits+"].");
			
			postSummary(callerName,numberOfTimeUnits,typeOfTimeUnits);

			
			return;
        });
		
		
		
/*End function definitions*/
	};
})();