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
      var helpText = "Usage: _/roll XdY([+|-]#) (adv|advantage|dis|disadvantage)_";
      helpText += "\nX is the number of dice, and Y is the number of sides.";
      helpText += "\nOnly the first paramter, e.g. XdY, is required.";
      helpText += "\nDice roller will recognize a critical hit (natural 20) and miss (natural 1) when rolling a 1d20.";
      helpText += "\nThe minimum value that dice roller will return is always 1.";
      helpText += "\n\nExamples:";
      helpText += "\n/roll 2d6    (Rolls two six-sided dice)";
      helpText += "\n/roll 3d20+2    (Rolls three twenty-sided dice and adds two to the result)";
      helpText += "\n/roll 4d100-7 adv    (Rolls four hundred-sided dice twice and takes the higher result, then substracts seven)";
      helpText += "\n/roll 1d4 dis    (Rolls a single four-sided die twice and takes the lower result.)";
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

		
	var diceBot = function(name,num,sides,bonusType,bonus,advantage) {
		var results = [];
		var isCrit = false;
		var isFail = false;
		var firstResults = getRollResults(sides,num);
		results.push(firstResults);
		var finalResults = firstResults;

		if(advantage.startsWith("adv")) {
			var secondResults = getRollResults(sides,num);
			results.push(secondResults);
			if(firstResults.rollsTotal > secondResults.rollsTotal) {
				finalResults = firstResults;
			} else {
				finalResults = secondResults;
			}
		} else if(advantage.startsWith("dis")) {
			var secondResults = getRollResults(sides,num);
			results.push(secondResults);
			if(firstResults.rollsTotal > secondResults.rollsTotal) {
				finalResults = secondResults;
			} else {
				finalResults = firstResults;
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
			if(advantage.startsWith("adv")) {
				text += " with advantage";	
			} else if (advantage.startsWith("dis")) {
				text += " with disadvantage";
			}
		}
		if(isCrit) {
			text += " `_CRITICAL!_`";
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
			m += "  Total: _" + (result.rollsTotal+Number(bonusString)) + "_\n"

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
  
    robot.router.post('/hubot/roll', function(req, res) {
      robot.logger.debug("Received a POST request to /hubot/roll");
          
      var data, channel_name, response_url, command, text, token,username, realName;
               
      data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
      //robot.logger.debug("data:"+util.inspect(data));
		  command = data.command;
      //text = data.text;     
		  token = data.token;
		  username = data.user_name;
		  userId = data.user_id;
		  realName = getRealNameFromId(userId);
		  channel_name = data.channel_name;
      var helpMatch = data.text.match(/help/i);
      if(helpMatch != null)
      {
        return res.send(getHelpText());
      }
      
		  var match = data.text.match(/(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}\s{0,1}(advantage|adv|disadvantage|dis){0,1}/i);
		  if(match != null)
		  {
			  var num = match[1] || 1;
			  var sides = match[3] || 6;
			  var bonusType = match[4] || "";
			  var bonus = match[5] || 0;
			  var advantage = match[6] || "";
			  
			  var msgData = diceBot(realName,num,sides,bonusType,bonus,advantage);
			  msgData['channel'] = channel_name;
			  msgData['response_type'] = 'in_channel';
			  
			  return res.json(msgData);
		  }
		  else
		  {
			  return res.send('*No valid dice roll recognized in ['+data.text+']!*\nUse _/roll help_ to get usage.');
		  }
    });
      
    };

})();
