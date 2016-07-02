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
    
		var addMessageOnNaturalTwentyOrOne = function(roll,sides,number)
		{
			var result = "";
			
			if(sides == 20 && roll == 20 && number == 1)
			{
				//_*`roll CRITICAL!`*_
				result = "_ `" + roll + " CRITICAL!` _ ";
			}
			else if(sides == 20 && roll == 1 && number == 1)
			{
				result = "_ `" + roll + " FAIL!` _ ";
			}
			else
			{
				result += "`" + roll + "` ";
			}
			
			return result;
		};
		
		var checkForCritical = function(roll,sides,numDice,critical) {
			
			if(critical)
			{
				return true;
			}
			else if(roll == 20 && sides == 20 && numDice == 1)
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
			var result = name + " rolled " + num + "d" + sides;
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
					
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides,num);
					criticalHit = checkForCritical(rolls[j],sides,num,criticalHit);
					rollsTotal += rolls[j];
				}
				result += "\nSecond result: ";
				rolls = rolldice(sides, num);
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides,num);
					criticalHit = checkForCritical(rolls[j],sides,num,criticalHit);
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
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides,num);
					criticalHit = checkForCritical(rolls[j],sides,num,criticalHit);
					rollsTotal += rolls[j];
				}
				result += "\nSecond result: ";
				rolls = rolldice(sides, num);
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides,num);
					criticalHit = checkForCritical(rolls[j],sides,num,criticalHit);
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
				
				result += "\nResult: ";
				for (var j = 0; j < rolls.length; j++) {
					result += addMessageOnNaturalTwentyOrOne(rolls[j],sides,num);
					criticalHit = checkForCritical(rolls[j],sides,num,criticalHit);
					rollsTotal += rolls[j];
				}
				
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
  
    var getRealNameFromId = function(userId)
    {
      var user = robot.brain.data.users[userId];
      if(user == null)
      {
        return "<Unknown User>"
      }
      
      return user.real_name;
    };
  
     
};

})();
