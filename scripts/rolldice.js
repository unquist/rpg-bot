// Description:
//   Rolls dice!
//
// Dependencies:
//   None
// Description:
//   Rolls dice!
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hubot roll XdY[+/-#] [adv,advantage,dis,disadvantage] -  rolls X dice with Y sides. Optional `+` or `-` adds/subtracts bonuses, and the [adv,advantage,dis,disadvantage] keywords roll advantage or disadvantage (note the space between the dice syntax and the adv keywords)
//
// Author:
//   unquist

(function() {
    module.exports = function(robot) {
		var util = require("util");
		var hasProp = {}.hasOwnProperty;


		var randint = function(sides) {
			return Math.round(Math.random() * (sides - 1)) + 1;
		};

		var rolldice = function(sides, num) {
			var results = [];
			for (var j = 1; j <= num; j++) {
				results.push(randint(sides));
			}
			return results;
		};



		const MACRO_REDIS_KEY_PREFIX = "diceroller-macro:";

		var setBrainValue = function(key,value)
		{
			robot.brain.set(MACRO_REDIS_KEY_PREFIX+key,value);
		};

		var getBrainValue = function(key)
		{
			return robot.brain.get(MACRO_REDIS_KEY_PREFIX+key);
		};

		var deleteBrainValue = function(key)
		{
			delete robot.brain.data._private[MACRO_REDIS_KEY_PREFIX+key];
		};


		var getHelpText = function()
		{
			var helpText = "Usage: _*/roll XdY([+|-]#) (adv|advantage|dis|disadvantage) (label)*_";
			helpText += "\nX is the number of dice, and Y is the number of sides.";
			helpText += "\nOnly the first paramter, e.g. XdY, is required.";
			helpText += "\nDice roller will recognize a critical hit (natural 20) and miss (natural 1) when rolling a 1d20.";
			helpText += "\nYou can string together as many dice rolls as you want (see example below).";
			helpText += "\n\n_*Examples:*_";
			helpText += "\n`/roll 3d6+2`    (Rolls three six-sided dice and adds two to the result)";
			helpText += "\n`/roll 4d100-7 adv`    (Rolls four hundred-sided dice twice and takes the higher result, then substracts seven)";
			helpText += "\n`/roll 1d4 dis`    (Rolls a single four-sided die twice and takes the lower result.)";
			helpText += "\n`/roll 1d20+1 to hit with sword 2d8 slashing damage`    (Rolls a single d20, adds 1 to the result, and returns the outcome. Then roll two eight-side dice and return the result. The labels will be attached to each result.)";
			helpText += "\n";
			helpText += "\n_*Mulitple Rolls*_";
			helpText += "\nYou may add (in any order) a parameter of the form `#x` (or `x#`), which will run # multiples of whatever the command is:";
			helpText += "\n`/roll 10x 1d20+1 to hit 1d6 damage`    (Rolls a 1d20+1 and a 1d6 couplet, 10 times in a row)";
			helpText += "\n`/roll x2 1d20-1 to hit 1d12+1 damage`    (Rolls a 1d20-1 and a 1d12+1 couplet, twice in a row)";
      helpText += "\n";
			helpText += "\n_*Macros*_";
			helpText += "\n Per user macros allow you to set a long command once, associate it with a short command phrase, and then reuse the command phrase whenever necessary.";
			helpText += "\n`/roll setmacro $[MACRO-NAME] [full dice command]` - Setup a new macro. `$` is required to identify the macro name at creation.";
			helpText += "\n`/roll getmacro $[MACRO-NAME]` - Return the dice command for a particular macro. `$` is optional.";
			helpText += "\n`/roll getmacro` - Return all currently set macros.";
			helpText += "\n`/roll $[MACRO-NAME]` - Run the named macro. `$` is optional.";
			helpText += "\n`/roll deletemacro $[MACRO-NAME]` - Delete the named macro.";
			helpText += "\n`/roll deleteallmymacros` - Delete all macros currently associated with your username.";
			helpText += "\nYou can set a dice macro with the `setmacro` command. Macro names must be prefixed with `$` at creation, and use alphanumeric characters (no spaces). Whatever follows the macro name will be the command set to that macro:";
			helpText += "\n`/roll setmacro $fists-of-fury 2x 1d20+5 to hit with fists of fury to hit 1d6 damage`";
			helpText += "\n`/roll fists-of-fury`";
			return helpText;
		};

		var getRollResults = function(sides, num) {
			var result = {
				rolls: rolldice(sides, num),
				rollsTotal: 0
			}
			for( var i = 0; i < result.rolls.length ; i++) {
				result.rollsTotal += result.rolls[i];
			}
			return result;
		};


		var diceBot = function(name,num,sides,bonusType,bonus,advantage,label) {
			var results = [];
			var isCrit = false;
			var isFail = false;
			var firstResults = getRollResults(sides,num);
			results.push(firstResults);
			var finalResults = firstResults;

			if(advantage.indexOf("dis") != -1) {
				var secondResults = getRollResults(sides,num);
				results.push(secondResults);
				if(firstResults.rollsTotal > secondResults.rollsTotal) {
					finalResults = secondResults;
				} else {
					finalResults = firstResults;
				}
			} else if(advantage.indexOf("adv") != -1) {
				var secondResults = getRollResults(sides,num);
				results.push(secondResults);
				if(firstResults.rollsTotal > secondResults.rollsTotal) {
					finalResults = firstResults;
				} else {
					finalResults = secondResults;
				}
			}

			if(sides == 20 && num == 1) {
				if(finalResults.rollsTotal == 20) {
					isCrit = true;
				} else if(finalResults.rollsTotal == 1) {
					isFail = true;
				}
			}
			// add bonus
			var finalTotal = finalResults.rollsTotal;
			var bonusString = "";
			if(bonusType && (bonusType == "+" || bonusType == "-")) {
				finalTotal = finalTotal + Number(bonusType+bonus);
				bonusString = bonusType+bonus;
			}

			//printing results
			var text = name + " rolled *`" + finalTotal + "`*";

			if(advantage) {
				if(advantage.indexOf("dis") != -1) {
					text += " with disadvantage";
				} else if (advantage.indexOf("adv") != -1) {
					text += " with advantage";
				}
			}

			if(label) {
				text += " for _'"+label+"'_";
			}

			if(isCrit) {
				text += " _`CRITICAL!`_";
			} else if(isFail) {
				text += " `FAIL!`";
			}
			text += "\n";

			var formatResult = function(num, sides, bonusString, result) {
				var m = "_" + num + "d" + sides + bonusString + "_ : ";
				if(result.rolls.length > 1) {
					m += "Results";
					for(var i = 0; i < result.rolls.length; i++) {
						m += " `"+result.rolls[i]+"`"
					}
					m += " " + bonusString;
				} else {
					m += "Result _" + result.rollsTotal + bonusString+"_"
				}
				m += "  Total: _*" + (result.rollsTotal+Number(bonusString)) + "*_\n"

				return m;
			};

			for(var i = 0; i < results.length; i++) {
				text += formatResult(num,sides,bonusString,results[i]);
			}

			//build slack message
			var msgData = {
				attachments: [
				{
					"fallback": text,
					"color": "#cc3300",
					"text": text,
					"mrkdwn_in": ["text"]
				}
				]
			};

			if(isCrit) {
				msgData.attachments.push({"image_url": "http://www.neverdrains.com/criticalhit/images/critical-hit.jpg", "text": "*CRITICAL!*","mrkdwn_in": ["text"]});
			}
			if(isFail) {
				msgData.attachments.push({"image_url": "http://i.imgur.com/eVW7XtF.jpg", "text": "*FAIL!*","mrkdwn_in": ["text"]});
			}

			return msgData;
		};

    var getInteractiveMadnessMsg = function(channel_name)
    {

      var msgData = [
        payload: {
          channel: channel_name,
          attachments: [
            {
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'What kind of madness should I roll for?'
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Short-term* _(1d10 minutes)_\n*Long-term* _(1d10 x 10 hours)_\n*Indefinite* _(lasts until cured)_'
                  },
                  accessory: {
                    type: 'image',
                    image_url: 'https://i.etsystatic.com/7088875/r/il/c351f3/1108046803/il_794xN.1108046803_7zc5.jpg',
                    alt_text: 'computer thumbnail'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        emoji: true,
                        text: 'Short-term'
                      },
                      value: 'short-term'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        emoji: true,
                        text: 'Long-term'
                      },
                      value: 'long-term'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        emoji: true,
                        text: 'Indefinite'
                      },
                      value: 'indefinite'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];
      robot.logger.debug("returning a maddness message");
      return msgData;
    };

		/*
		robot.hear(/(\$roll\s+)(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}\s{0,1}(advantage|adv|disadvantage|dis){0,1}/i, function(msg) {
			var callerName = msg.message.user.name;
			var num = msg.match[2] || 1;
			var sides = msg.match[4] || 6;
			var bonusType = msg.match[5] || "NAN";
			var bonus = msg.match[6] || 0;
			var advantage = msg.match[7] || "";

			var msgData = diceBot(callerName,num,sides,bonusType,bonus,advantage);
			msgData['channel'] = msg.message.room;
			try{

			robot.adapter.customMessage(msgData);
			}
			catch (err)
			{
			robot.logger.debug("Caught error: " + err.message);
			}
			return;
		});
*/

		var getRealNameFromId = function(userId)
		{
			var user = robot.brain.data.users[userId];
			if(user == null)
			{
				return "<Unknown User>"
			}

			return user.real_name;
		};

		/*
	* returns a msgData object representing the slack response on success or null if it couldn't parse the input
	*/
		var doRoll = function(realName,text) {

			var match = text.match(/(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}\s{0,1}(disadvantage|advantage|adv\b|dis\b){0,1}\s{0,1}([\s\S]+)?/i);

			if(match != null)
			{
				var num = match[1] || 1;
				var sides = match[3] || 6;
				var bonusType = match[4] || "";
				var bonus = match[5] || 0;
				var advantage = match[6] || "";
				var label = match[7] || "";

				var msgData = diceBot(realName,num,sides,bonusType,bonus,advantage,label);
				return msgData;
			}
			return null;
		};

		var processMacroCommand = function(macroCommandString,realName,username,channel_name){



			var clearAllMacrosMatch = macroCommandString.match(/clearallmacros/i);
			if(clearAllMacrosMatch != null)
			{
				return clearAllMacros();
			}


			var clearMyMacrosMatch = macroCommandString.match(/deleteallmymacros/i);
			if(clearMyMacrosMatch != null)
			{
				return clearMyMacros(username);
			}

			var clearMacroMatch = macroCommandString.match(/deletemacro/i);
			if(clearMacroMatch != null)
			{
				return clearMacro(macroCommandString,username);
			}

			var setMacroMatch = macroCommandString.match(/setmacro/i);
			if(setMacroMatch != null)
			{
				return setMacro(macroCommandString,realName,username);
			}

			var getMacroMatch = macroCommandString.match(/getmacro/i);
			if(getMacroMatch != null)
			{
				return getMacro(macroCommandString,realName,username);
			}


			var execMacroMatch = macroCommandString.match(/(\${0,1}[\S]+)/i);
			//var execMacroMatch = macroCommandString.match(new RegExp('\('+MACRO_CHAR+'\*\[\\S\]\+\)',"i"));
			if(execMacroMatch != null)
			{
				robot.logger.debug("processMacroCommand-> found execMacroMatch["+util.inspect(execMacroMatch)+"]");
				if(execMacroMatch[1] == "$")
				{
					return getMsgData("Error: macro command names must consist of at least one non-space character following the `$`.");
				}
				return executeMacro(macroCommandString,realName,username,channel_name);
			}

			return getMsgData("No valid macro command found. Use _/roll help_ to see options.");
		};

		var setMacro = function(macroCommandString,realName,username){
			var setMacroMatch = macroCommandString.match(/setmacro (\$[\S]+) (\S+.*)/i);
			//var setMacroMatch = macroCommandString.match(new RegExp('setmacro \('+MACRO_CHAR+'\[\\S\]\+\) \(\\S\+\.\*\)',"i"));
			if(setMacroMatch == null)
			{
				return getMsgData('*No valid setmacro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}
			robot.logger.debug("setMacro-> found setMacroMatch ["+util.inspect(setMacroMatch)+"]");
			var macroName = setMacroMatch[1] || "NA";
			var fullMacroCommand = setMacroMatch[2] || "NA";
			if(macroName == "NA" || fullMacroCommand == "NA")
			{
				return getMsgData('*No valid setmacro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}

			setBrainValue(username+":"+macroName,fullMacroCommand)

			return getMsgData("Setting new macro name `"+macroName+"` to command `"+fullMacroCommand+"`");
		};

		var getMacro = function(macroCommandString,realName,username){

			var getMacroMatch = macroCommandString.match(/getmacro( ){0,1}(\${0,1}[\S]+){0,1}/i);
			//var getMacroMatch = macroCommandString.match(new RegExp('getmacro\\s\+\('+MACRO_CHAR+'\*\[\\S\]\+\)\*',"i"));
			if(getMacroMatch == null)
			{
				return getMsgData('*No valid getmacro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}
			robot.logger.debug("getMacro-> found getMacroMatch ["+util.inspect(getMacroMatch)+"]");
			var macroName = getMacroMatch[2] || "NA";

			//if a macro name was specified, we only need to return that
			if(macroName != "NA")
			{
				robot.logger.debug("getMacro-> found macroName ["+util.inspect(macroName)+"]");
				var originalMacroName = macroName;
				var indexOfMacroChar = macroName.indexOf("$");
				if(indexOfMacroChar == -1 || indexOfMacroChar > 0)
				{
					macroName = "$" + macroName;
				}

				var diceCommandString = getBrainValue(username+":"+macroName);
				if(diceCommandString == null)
				{
					return getMsgData("Found no macro command associated with name `"+originalMacroName+"`.");
				}
				var message = "Macro name `"+macroName+"` runs command `"+diceCommandString+"`";
				return getMsgData(message);
			}

			//if no macro name was specified, we need to return all macros set for this user
			var key;
			var message = "You have the following macros set:\n";
			var macroCount = 0;
			for (key in robot.brain.data._private)
			{
				if(!hasProp.call(robot.brain.data._private, key)) continue;
				robot.logger.debug("key["+key+"]:value["+robot.brain.data._private[key]+"]");
				if(key.indexOf(MACRO_REDIS_KEY_PREFIX+username) != -1)
				{
					robot.logger.debug("Found a macro for this user.");
					macroName = key.split(":")[2];
					robot.logger.debug("macroName=["+macroName+"]");
					message += "Macro name `"+macroName+"` runs command `"+getBrainValue(username+":"+macroName)+"` \n";
					macroCount += 1;
				}
			}
			if(macroCount == 0)
			{
				message = "You have no macros currently set.";
			}

			return getMsgData(message);
		};

		var executeMacro = function(macroCommandString,realName,username,channel_name){

			robot.logger.debug("Found macroCommandString="+util.inspect(macroCommandString));
			//var getMacroMatch = macroCommandString.match(new RegExp('\('+MACRO_CHAR+'\*\[\\S\]\+\)',"i"));
			var getMacroMatch = macroCommandString.match(/(\${0,1}[\S]+)/i);

			if(getMacroMatch == null)
			{
				return getMsgData('*No valid macro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}
			robot.logger.debug("Found getMacroMatch="+util.inspect(getMacroMatch));
			var macroName = getMacroMatch[1] || "NA";

			if(macroName == "NA")
			{
				return getMsgData('*No valid macro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}
			robot.logger.debug("Found macro="+util.inspect(macroName));
			var originalMacroName = macroName;
			var indexOfMacroChar = macroName.indexOf("$");
			if(indexOfMacroChar == -1 || indexOfMacroChar > 0)
			{
				macroName = "$" + macroName;
			}

			var diceCommandString = getBrainValue(username+":"+macroName);

			if(diceCommandString == null)
			{
				return getMsgData("Found no macro command associated with name `"+originalMacroName+"`.");
			}

			var msgData = processDiceCommandString(diceCommandString,realName,channel_name);

			msgData['text'] = "Running macro `"+macroName+"`";

			return msgData;
		};

		var clearAllMacros = function()
		{
			for (key in robot.brain.data._private)
			{
				if(!hasProp.call(robot.brain.data._private, key)) continue;
				robot.logger.debug("key["+key+"]:value["+robot.brain.data._private[key]+"]");
				if(key.indexOf(MACRO_REDIS_KEY_PREFIX) != -1)
				{
					robot.logger.debug("Deleting macro with name["+key+"].");
					delete robot.brain.data._private[key];
				}
			}
			return getMsgData("All macros cleared.");
		}

		var clearMacro = function(macroCommandString,username)
		{
			var getMacroMatch = macroCommandString.match(/deletemacro (\${0,1}[\S]+)/i);
			//var getMacroMatch = macroCommandString.match(new RegExp('getmacro\\s\+\('+MACRO_CHAR+'\*\[\\S\]\+\)\*',"i"));
			if(getMacroMatch == null)
			{
				return getSimpleMsgDataWitoutAttachment('*No valid deletemacro command recognized in ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}
			robot.logger.debug("clearMacro-> found getMacroMatch ["+util.inspect(getMacroMatch)+"]");
			var macroName = getMacroMatch[1] || "NA";

			//if a macro name was specified, we only need to return that
			if(macroName != "NA")
			{
				robot.logger.debug("clearMacro-> found macroName ["+util.inspect(macroName)+"]");
				var originalMacroName = macroName;
				var indexOfMacroChar = macroName.indexOf("$");
				if(indexOfMacroChar == -1 || indexOfMacroChar > 0)
				{
					macroName = "$" + macroName;
				}

				var diceCommandString = getBrainValue(username+":"+macroName);
				if(diceCommandString == null)
				{
					return getSimpleMsgDataWitoutAttachment("Found no macro command associated with name `"+originalMacroName+"`.");
				}

				deleteBrainValue(username+":"+macroName);

				var message = "Deleted macro name `"+macroName+"` with command `"+diceCommandString+"`";
				return getMsgData(message);
			}
			else
			{
				return getSimpleMsgDataWitoutAttachment('*Could not find named macro in deletemacro command ['+macroCommandString+']!*\nUse _/roll help_ to get usage.');
			}

		};

		var clearMyMacros = function(username)
		{
			var reply = "Deleted the following macros for user _"+username+"_:\n";
			var countMacros = 0;
			for (key in robot.brain.data._private)
			{
				if(!hasProp.call(robot.brain.data._private, key)) continue;
				robot.logger.debug("key["+key+"]:value["+robot.brain.data._private[key]+"]");
				if(key.indexOf(MACRO_REDIS_KEY_PREFIX+username) != -1)
				{
					robot.logger.debug("Deleting macro with name["+key+"].");
					var diceCommand = robot.brain.data._private[key];
					var macroName = key.split(":")[2];
					delete robot.brain.data._private[key];
					reply += "Deleted macro name `"+macroName+"` with command `"+diceCommand+"`.\n";
					countMacros += 1;
				}
			}

			if(countMacros == 0)
			{
				reply = "No macros found for user _"+username+"_.\n";
			}

			return getMsgData(reply);
		}

		var processDiceCommandString = function(diceCommandString,realName,channel_name)
		{
			var text = diceCommandString; //create a copy since we will be modifying this
			var match = text.match(/(\d+)(d)(\d+)/ig);

			if(! match) {
				robot.logger.debug("failed match!");
				return getMsgData('*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.');
			}

			//first, check to see if there's a multiplier anywhere in the string
			var multiplierMatch = text.match(/\s{0,1}(\d+)[x|X]\s/i);
			var multiplier = 1;
			if(multiplierMatch != null)
			{
				robot.logger.debug("Found a multipler match: " +multiplierMatch);
				multiplier = Number(multiplierMatch[1]);
				var indexOfMultipler = text.indexOf(multiplierMatch[1]);
				robot.logger.debug("Found a multipler match; text before: " +text);
				text = text.replace(/(\d+)[x|X]/,"");
				robot.logger.debug("Found a multipler match; text after: " +text);
			}
			else
			{

        multiplierMatch = text.match(/\s{0,1}[x|X](\d+)\s/i);
			  multiplier = 1;
			  if(multiplierMatch != null)
			  {
				  robot.logger.debug("Found a multipler match: " +multiplierMatch);
				  multiplier = Number(multiplierMatch[1]);
				  var indexOfMultipler = text.indexOf(multiplierMatch[1]);
				  robot.logger.debug("Found a multipler match; text before: " +text);
				  text = text.replace(/(\d+)[x|X]/,"");
				  robot.logger.debug("Found a multipler match; text after: " +text);
			  }
			  else
			  {
          robot.logger.debug("No multiplier request. Proceed as normal");
        }

			}

			args = [];
			var match = text.match(/(\d+)(d)(\d+)/ig);
			for (var i = match.length-1 ; i >= 0; i--) {
				var idx = text.lastIndexOf(match[i]);
				arg = text.slice(idx);
				args.push(arg);
				text = text.slice(0,idx);
				robot.logger.debug("arg: "+arg);
				robot.logger.debug("remaining: "+text);
			}

			//arg = 1d20+1 adv foo foo foo

			var msgData = null;
			for(var k = 0; k < multiplier; k++)
			{
				for (var i = args.length-1; i >= 0; i--) {
					robot.logger.debug("Rolling: "+args[i]);
					nextMessage = doRoll(realName,args[i]);
					if(nextMessage) {
						if(msgData == null) {
							msgData = nextMessage;
						} else {
							msgData.attachments = msgData.attachments.concat(nextMessage.attachments);
						}
					} else {

						return getMsgData('*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.');
					}

				}
			}
			msgData['channel'] = channel_name;
			msgData['response_type'] = 'in_channel';
			return msgData;
		};

		var getMsgData = function(messageText){
			var msgData = {
				attachments: [
				{
					"fallback": messageText,
					"color": "#cc3300",
					"text": messageText,
					"mrkdwn_in": ["text"]
				}
				]
			};
			return msgData;
		};

		var getSimpleMsgDataWitoutAttachment = function(messageText, channel_name)
		{
			var msgData = {
				text:messageText,
        channel:channel_name,
        response_type:'in_channel'
			};
      
			return msgData;
		}

		robot.router.post('/hubot/roll', function(req, res) {
			robot.logger.debug("Received a POST request to /hubot/roll");

			var data, channel_name, response_url, command, text, token,username, realName;

			data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
			//robot.logger.debug("data:"+util.inspect(data));
			command = data.command;
			//text = data.text;
			token = data.token;

			//robot.logger.debug("received token:["+token+"]");
			//robot.logger.debug("stored token is:["+process.env.HUBOT_SLASH_ROLL_TOKEN+"]");

			if(token != process.env.HUBOT_SLASH_ROLL_TOKEN)
			{
				return res.json(getSimpleMsgDataWitoutAttachment("Incorrect authentication token. Did you remember to set the HUBOT_SLASH_ROLL_TOKEN to the token for your Slack slash command?"));
			}
			else
			{
				robot.logger.debug("Request authenticated.");
			}
			username = data.user_name;
			userId = data.user_id;
			realName = getRealNameFromId(userId);
			channel_name = data.channel_name;
			var helpMatch = data.text.match(/help/i);
			if(helpMatch != null)
			{
				return res.json(getSimpleMsgDataWitoutAttachment(getHelpText(),channel_name));
			}

      var madnessMatch = data.text.match(/madness/i);
      if(madnessMatch != null)
      {
        robot.logger.debug("Recieved madness request.");
        var msgData = getInteractiveMadnessMsg(channel_name);
        robot.logger.debug("msgData is:\n" + JSON.stringify(msgData));
        return res.json(msgData);
      }

			var macroMatch = data.text.match(/(deleteallmymacros|deletemacro|clearallmacros|getmacro|setmacro|\$)/i);
			//var macroMatch = data.text.match(new RegExp('clearallmacros\|getmacro\|setmacro\|'+MACRO_CHAR,"i"));
			var diceMatch = data.text.match(/(\d+)(d)(\d+)/ig);
			if(macroMatch != null)
			{
				var msgData = processMacroCommand(data.text,realName,username,channel_name);
				return res.json(msgData);
			}
			else if(diceMatch != null)
			{
				var msgData = processDiceCommandString(data.text,realName,channel_name);
				robot.logger.debug("msgData is:\n" + JSON.stringify(msgData));
        return res.json(msgData);
			}
			else
			{
				//no explicit macro command, and no dice roll command.
				//check if it's a macro request without the #
				macroMatch = data.text.match(/([\S]+)/i);
				if(macroMatch == null)
				{
					return res.json(getMsgData("No valid dice roll or macro command. Use _/roll help_ to see command options."));
				}
				var msgData = processMacroCommand(data.text,realName,username,channel_name);
				return res.json(msgData);
			}
		});

		module.exports.rolldice = rolldice;
		module.exports.getRollResults = getRollResults;

	};


})();
