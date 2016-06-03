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
//   hubot roll 2d6
//
// Author:
//   sprngr, dualmoon

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

        robot.respond(/roll\s?(?:([0-9]+)?d([0-9]+)?)?(?:\s?(.*))?/i, function(msg) {
            var num = msg.match[1] || 1;
            var sides = msg.match[2] || 6;
            var comment = msg.match[3] || "";
            var rolls = rolldice(sides, num);
            var rollsTotal = 0;
            var result = "rolled " + num + "d" + sides + " " + comment + "\n\nResult: ";

            for (var j = 0; j < rolls.length; j++) {
                result += "`" + rolls[j] + "` ";
            }

            if (rolls.length > 1) {
                for (var k = 0; k < rolls.length; k++) {
                    rollsTotal += rolls[k];
                }
                result += "\n\nTotal: `" + rollsTotal + "`";
            }

            return msg.reply(result);
        });
    };

})();
