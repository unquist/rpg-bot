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
    var getHelpText = function()
    {
      var helpText = "Usage: _/roll XdY([+|-]#) (adv|advantage|dis|disadvantage) (label)_";
      helpText += "\nX is the number of dice, and Y is the number of sides.";
      helpText += "\nOnly the first paramter, e.g. XdY, is required.";
      helpText += "\nDice roller will recognize a critical hit (natural 20) and miss (natural 1) when rolling a 1d20.";
      helpText += "\nYou can string together as many dice rolls as you want (see example below).";
      helpText += "\n\nExamples:";
      helpText += "\n/roll 3d6+2    (Rolls three six-sided dice and adds two to the result)";
      helpText += "\n/roll 4d100-7 adv    (Rolls four hundred-sided dice twice and takes the higher result, then substracts seven)";
      helpText += "\n/roll 1d4 dis    (Rolls a single four-sided die twice and takes the lower result.)";
	  helpText += "\n/roll 1d20+1 to hit with sword 2d8 slashing damage    (Rolls a single d20, adds 1 to the result, and returns the outcome. Then roll two eight-side dice and return the result. The labels will be attached to each result.)";
      helpText += "\n";
	  helpText += "\n_Mulitple Rolls_";
	  helpText += "\nYou may add (in any order) a parameter of the form `#x`, which will run # multiples of whatever the command is:";
	  helpText += "\n/roll 10x 1d20+1 to hit 1d6 damage    (Rolls a 1d20+1 and a 1d6 couplet, 10 times in a row)";
	  helpText += "\n";
	  helpText += "\n_Macros_";
	  helpText += "\n/roll setmacro #[MACRO-NAME] [full dice command] - Setup a new macro";
	  helpText += "\n/roll getmacro #[MACRO-NAME] - Return the dice command for a particular macro";
	  helpText += "\n/roll getmacro - Return all currently set macros.";
	  helpText += "\n/roll #[MACRO-NAME] - Run the named macro.";
	  helpText += "\nYou can set a dice macro with the `setmacro` command. Macro names must be prefixed with a hash sign (#) and use alphanumeric characters (no spaces). Whatever follows the macro name will be the command set to that macro:";
	  helpText += "\n/roll setmacro #fists-of-fury 2x 1d20+5 to hit with fists of fury to hit 1d6 damage";
	  helpText += "\n/roll #fists-of-fury";
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

	var processMacroCommand = function(){
		
	};
	
	var setMacro = function(){
		
		
	};
	
	var getMacro = function(){
		
	};
	
	var executeMacro = function(){
	
		
	};
	
	var processDiceCommandString = function(diceCommandString)
	{
		var text = diceCommandString; //create a copy since we will be modifying this
		var match = text.match(/(\d+)(d)(\d+)/ig);

		if(! match) {
			robot.logger.debug("failed match!");
			var msgData = {
				attachments: [
					{
						"fallback": '*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.',
						"color": "#cc3300",
						"text": '*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.',
						"mrkdwn_in": ["text"]
					}
				]
			};
			return msgData;
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
			robot.logger.debug("No multiplier request. Proceed as normal");
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
					var msgData = {
						attachments: [
							{
								"fallback": '*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.',
								"color": "#cc3300",
								"text": '*No valid dice roll recognized in ['+diceCommandString+']!*\nUse _/roll help_ to get usage.',
								"mrkdwn_in": ["text"]
							}
						]
					};
					return msgData;
				}
				
			}
		}
		msgData['channel'] = channel_name;
		msgData['response_type'] = 'in_channel';
		return msgData;
	};
	
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
			return res.send("Incorrect authentication token. Did you remember to set the HUBOT_SLASH_ROLL_TOKEN to the token for your Slack slash command?");
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
			return res.send(getHelpText());
		}

		var macroMatch = data.text.match(/(getmacro|setmacro|#/i);
		if(macroMatch != null)
		{
			var msgData = processMacroCommand(data.text);
			return res.json(msgData);
		}
		
		var msgData = processDiceCommandString(data.text);
		return res.json(msgData);
		/*
	msgData = doRoll(realName,data.text);
	if(msgData) {

		msgData['channel'] = channel_name;
		msgData['response_type'] = 'in_channel';

		return res.json(msgData);
	} else {
		return res.send('*No valid dice roll recognized in ['+data.text+']!*\nUse _/roll help_ to get usage.');
	}
*/
	});

	module.exports.rolldice = rolldice;	
	module.exports.getRollResults = getRollResults;
	 
    };

	
})();
