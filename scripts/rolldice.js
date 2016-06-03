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
//   hubot roll 2d6[+/-#][adv,advantage,dis,disadvantage]
//
// Author:
//   unquist

(function() {
    module.exports = function(robot) {
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

        robot.respond(/(roll\s+)(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}\s{0,1}(advantage|adv|disadvantage|dis){0,1}/i, function(msg) {
            var num = msg.match[2] || 1;
            var sides = msg.match[4] || 6;
            var bonusType = msg.match[5] || "NAN";
			      var bonus = msg.match[6] || 0;
            var rolls = rolldice(sides, num);
            var rollsTotal = 0;
			if(Number(bonus) > 0)
			{
				rollsTotal += Number(bonus);
			}
			var result = "rolled " + num + "d" + sides;
			if(bonusType.indexOf("+") != -1)
			{
				result += "+" + bonus;
			}
			else if(bonusType.indexOf("-") != -1)
			{
				result += "-" + bonus;
			}
			
			result += "\n\nResult: ";

            for (var j = 0; j < rolls.length; j++) {
                result += "`" + rolls[j] + "` ";
		    }

            if ((rolls.length > 1) || (rolls.length == 1 && Number(bonus) > 0)) {
                for (var k = 0; k < rolls.length; k++) {
                    rollsTotal += rolls[k];
                }

                result += "\n\nTotal: `" + rollsTotal + "`";
            }
	
            return msg.reply(result);
        });
    };

})();
