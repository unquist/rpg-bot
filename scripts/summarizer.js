// Description:
//   summarizes the recent action
//
// Dependencies:
//   None
//
// Configuration:
//   RPGBOT_SUMMARIZE_INTERVAL: required, defaults to 0 which turns the summarizer off
//   RPGBOT_SUMMARY_CHANNEL_NAME: required, set this to the name of the channel you want summaries posted to. Do not prefix the name with a "#" character.
//   RPGBOT_CAMPAIGN_CHANNEL_NAME: required, set this to the name of the channel you summarized. Do not prefix the name with a "#" character.
//
// Commands:
//	 None
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
		
		var summaryChannelName = process.env.RPGBOT_SUMMARY_CHANNEL_NAME || "<NOT SET>";
		var campaignChannelName = process.env.RPGBOT_CAMPAIGN_CHANNEL_NAME || "<NOT SET>";
		
		//var summaryChannelId = 'C1RJ8KRD5';
		//var campaignChannelId = 'C1D2ZTKF0';
		var summaryChannelId = null;
		var campaignChannelId = null;
		var channelListParams = {};
		
		//There is some kind of order-of-operations problem with initializing. 
		// We can't run the robot.slack.channels call at startup; probably has not itself been initialized. 
		// Instead, we'll initialize the summarizer the first time it's called, and then set this variable to false.
		var summarizerInitialized = false;
		
		var initializeSummarizer = function(){
			//need to set the id of the channel based on the name
			if(summaryChannelName != "<NOT SET>" && campaignChannelName != "<NOT SET>")
			{
				robot.slack.channels.list(channelListParams)
				.then(function (res) {
					robot.logger.debug("summarizer initialization: Successfully retrieved channel list of length["+res.channels.length+"].");
					for(var j = 0; j < res.channels.length; j++)
					{
						robot.logger.debug("summarizer initialization: found channel["+j+"] with name ["+res.channels[j].name+"] and id ["+res.channels[j].id+"]");
						if(res.channels[j].name == summaryChannelName)
						{
							robot.logger.debug("setting "+summaryChannelName+" to id "+res.channels[j].id);
							summaryChannelId = res.channels[j].id;
						}
						else if(res.channels[j].name == campaignChannelName)
						{
							robot.logger.debug("setting "+campaignChannelName+" to id "+res.channels[j].id);
							campaignChannelId = res.channels[j].id;
						}
					}
					summarizerInitialized = true;
					robot.logger.debug("summarizer successfully initialized.");
				})
				.catch(function (err) {
					robot.logger.debug("summarizer initialization: Failed to set summary and or campaign channel id; summarizer will not work ->" + err);
				});
			}
		}
		//don't turn on the cron job if the variable is set to zero, or if the channel variables were not set
		if(summarizeIntervalInMinutes != 0 && summaryChannelName != "<NOT SET>" && campaignChannelName != "<NOT SET>")
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
		else
		{
			robot.logger.debug("Summarizer failed to start cron job due to missing or zeroed environment variables. summarizeIntervalInMinutes["+summarizeIntervalInMinutes+"], summaryChannelName["+summaryChannelName+"] campaignChannelName["+campaignChannelName+"]");
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
			try
			{
				messages.sort(sortMessagesChronologically);
				//robot.logger.debug("messageFilter-> messages inspect: " + util.inspect(messages));
				var filteredMessages = new Array();
				//robot.logger.debug("messageFilter function recieved ["+messages.length+"] messages.");
				for(var k = 0; k < messages.length; k++)
				{
					var archivedMessage = messages[k];
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
						if(attachments != null)
						{
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
					
					
				}
				robot.logger.debug("message filter function returning ["+filteredMessages.length+"] messages");
				return filteredMessages;	
			}
			catch(err)
			{
				robot.logger.debug("messageFilter->Error: " + err);
			}			
		};
		
		var executePostSummary = function(callerName,numberOfTimeUnits,typeOfTimeUnits)
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
		
		var postSummary = function(callerName,numberOfTimeUnits,typeOfTimeUnits)
		{
			//if this is the first time we've run, need to translate the channel name to channel id
			if(!summarizerInitialized)
			{
				initializeSummarizer();
				setTimeout(function(){
					executePostSummary(callerName,numberOfTimeUnits,typeOfTimeUnits);
				}, 5000);
			}
			else
			{
				executePostSummary(callerName,numberOfTimeUnits,typeOfTimeUnits);
			}
			
		};
		
		var getFormattedJSONAttachment = function(messageText,channel,inChannel) {
			
			var msgData = {
				
				"attachments": [{
					"fallback": messageText,
					"color": "#cc3300",
					"text": messageText,
					"channel":channel,
					"image_url" : "http://www.rihs.org/atlas/images/rule.jpg",
					"mrkdwn_in": ["text"]
              }]
          };
		  
		  if(inChannel)
		  {
			msgData['response_type'] = 'in_channel';
		  }
		  else
		  {
			msgData['response_type'] = 'ephemeral';
		  }
		  
		  return msgData;
		}
		
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
					//robot.logger.debug("sending recursive params: " + util.inspect(recursive_params));
					
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
						robot.logger.debug("requestChannelHistory(recursive):Couldn't get channel history: " + err);
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
				robot.logger.debug("requestChannelHistory:Couldn't get channel history: " + err);
			});
			return;
		};
		
		var respondToSummaryLog = function(msg)
		{
			var callerName = msg.message.user.name;
			//robot.logger.debug(util.inspect(msg));
	
			var numberOfTimeUnits = Number(msg.match[2]) || 0;
			var typeOfTimeUnits = msg.match[3] || "hour";
			
			robot.logger.debug("User ["+callerName+"] asked for the debug log for ["+numberOfTimeUnits+"] ["+typeOfTimeUnits+"].");
			
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
			
			debugChannelHistory(params);

			
			return;
		};
		
		//use the "summarylog" phrase to test functionality.
		robot.respond(/(summarylog)\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i, function(msg) {
            
			//if this is the first time we've run, need to translate the channel name to channel id
			if(!summarizerInitialized)
			{
				initializeSummarizer();
				setTimeout(function(){
					respondToSummaryLog(msg);
				}, 5000);
			}
			else
			{
				respondToSummaryLog(msg);
			}

        });
		
		var debugChannelHistory = function(params)
		{
			robot.slack.channels.history(params)// NOTE: could also give postMessage a callback
			.then(function (res) {
				robot.logger.debug("Successfully retrieved channel history.");
						
								
				var filteredMessages = messageFilter(res.messages);
				robot.logger.debug("returned from messageFilter");
				for(var k = 0; k < filteredMessages.length; k++)
				{
					robot.logger.debug("debugChannelHistory: filteredMessages["+k+"]="+util.inspect(filteredMessages[k]));
				}
				
			})
			.catch(function (err) {
				robot.logger.debug("requestChannelHistory:Couldn't get channel history: " + err);
			});
			return;
		};
		
/*End function definitions*/
	};
})();