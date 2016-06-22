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
        
		var addMessageOnNaturalTwentyOrOne = function(roll,sides)
		{
			var result = "";
			
			if(sides == 20 && roll == 20)
			{
				//_*`roll CRITICAL!`*_
				result = "_*`" + roll + " CRITICAL!`*_ ";
			}
			else if(sides == 20 && roll == 1)
			{
				result = "_*`" + roll + " FAIL!`*_ ";
			}
			else
			{
				result += "`" + roll + "` ";
			}
			
			return result;
		};
		
		var checkForCritical = function(roll,sides,critical) {
			
			if(critical)
			{
				return true;
			}
			else if(roll == 20 && sides == 20)
			{
				return true;
			}
			else
			{
				return false;
			}
		};
		
		var diceBot = function(name,num,sides,bonusType,bonus,advantage) {
			var rolls = rolldice(sides, num);
			var rollsTotal = 0;
			var addBonus = true;
			var result = "@" + name + " rolled " + num + "d" + sides;
			var criticalHit = false;
			if(bonusType.indexOf("+") != -1)
			{
				result += "+" + bonus;
			}
			else if(bonusType.indexOf("-") != -1)
			{
				addBonus = false;
				result += "-" + bonus;
			}
			
			if(advantage.indexOf("dis") != -1)
			{
				result += " with disadvantage\nFirst result: ";
				var secondRollsTotal = rollsTotal;
				
				for (var j = 0; j < rolls.length; j++) {
					
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides);
					criticalHit = checkForCritical(rolls[j],sides,criticalHit);
					rollsTotal += rolls[j];
				}
				result += "\nSecond result: ";
				rolls = rolldice(sides, num);
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides);
					criticalHit = checkForCritical(rolls[j],sides,criticalHit);
					secondRollsTotal += rolls[j];
				}
				
				if(secondRollsTotal < rollsTotal)
				{
					rollsTotal = secondRollsTotal;
				}
				
				if(Number(bonus) > 0)
				{
					if(addBonus) {
						rollsTotal += Number(bonus);
					}
					else
					{
						rollsTotal -= Number(bonus);
						if(rollsTotal < 1)
						{
							rollsTotal = 1;
						}
					}
				}
				
				result += "\n*Total of lowest rolls (w/ modifier): `" + rollsTotal + "`*";
				
			}
			else if(advantage.indexOf("adv") != -1)
			{
				result += " with advantage\nFirst result: ";
				var secondRollsTotal = rollsTotal;
				
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides);
					criticalHit = checkForCritical(rolls[j],sides,criticalHit);
					rollsTotal += rolls[j];
				}
				result += "\nSecond result: ";
				rolls = rolldice(sides, num);
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides);
					criticalHit = checkForCritical(rolls[j],sides,criticalHit);
					secondRollsTotal += rolls[j];
				}
				
				if(secondRollsTotal > rollsTotal)
				{
					rollsTotal = secondRollsTotal;
				}
				if(Number(bonus) > 0)
				{
					
					if(addBonus) 
					{
						rollsTotal += Number(bonus);
					}
					else
					{
						rollsTotal -= Number(bonus);
						if(rollsTotal < 1)
						{
							rollsTotal = 1;
						}
					}
				}
				
				result += "\n*Total of highest rolls (w/ modifier): `" + rollsTotal + "`*";
				
			}
			else
			{
				if(Number(bonus) > 0)
				{
					if(addBonus) {
						rollsTotal += Number(bonus);
					}
					else
					{
						rollsTotal -= Number(bonus);			
					}
				}
				
				result += "\n*Result: ";
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides);
					criticalHit = checkForCritical(rolls[j],sides,criticalHit);
					rollsTotal += rolls[j];
				}
				result += "*";
				if ((rolls.length > 1) || (rolls.length == 1 && Number(bonus) > 0)) 
				{
					if(rollsTotal < 1)
					{
						rollsTotal = 1;
					}
					result += "\n*Total (w/ modifier): `" + rollsTotal + "`*";
				}
			}

			
			
			var msgData = {
				attachments: [
					{
						"fallback": result,
						"color": "#cc3300",
						"footer": "Dice Rolling Script",
						"footer_icon": "https://a.fsdn.com/allura/p/kdicegen/icon",
						"text": result,
						"mrkdwn_in": ["text"]
					}
				]
			};
          if(criticalHit)
		  {
			msgData.attachments.push({"image_url": "http://www.neverdrains.com/criticalhit/images/critical-hit.jpg", "text": "*CRITICAL!*","mrkdwn_in": ["text"]});
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
      	robot.router.post('/hubot/roll', function(req, res) {
          robot.logger.debug("Received a POST request to /hubot/roll");
          
          var data, channel_name, response_url, command, text, token,username;
               
          data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
          //robot.logger.debug("data:"+util.inspect(data));
		  command = data.command;
          //text = data.text;     
		  token = data.token;
		  username = data.user_name;
		  channel_name = data.channel_name;

		  var match = data.text.match(/(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}\s{0,1}(advantage|adv|disadvantage|dis){0,1}/i);
		  if(match != null)
		  {
			  var num = match[1] || 1;
			  var sides = match[3] || 6;
			  var bonusType = match[4] || "";
			  var bonus = match[5] || 0;
			  var advantage = match[6] || "";
			  
			  var msgData = diceBot(username,num,sides,bonusType,bonus,advantage);
			  msgData['channel'] = channel_name;
			  msgData['response_type'] = 'in_channel';
			  
			  return res.json(msgData);
		  }
		  else
		  {
			  return res.send('*No valid dice roll!*\nUsage: _/roll XdY([+|-]#) (adv|advantage|dis|disadvantage)_\nX is the number of dice, and Y is the number of sides.\nOnly the first paramter, e.g. XdY, is required.\n\nExamples:\n/roll 2d6    (Rolls two six-sided dice)\n/roll 3d10+2    (Rolls three ten-sided dice and adds two to the result)\n/roll 4d100-7 adv    (Rolls four hundred-sided dice twice and takes the higher result, then substracts seven)');
		  }
    });
      
    };

})();
