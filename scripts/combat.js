// Description:
//   Keeps track of combat
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

        robot.respond(/combat\s*(\d)*/i, function(msg) {
           
		   var combat_started = robot.brain.get('combat_flag');
		   if(!combat_started)
		   {
				combat_started = 1;
		   }
		   else if(combat_started == 1)
		   {
				//combat needs to end
				robot.brain.set('combat_flag', 0);
				//TODO: any other cleanup work (like removing persistent variables)
				return msg.reply(">Combat over");
		   }
		   else if(combat_started == 0)
		   {
				robot.brain.set('combat_flag', 1);
				return msg.reply(">Combat started");
		   }
		   
		   
		   var numCombatants = msg.match[1] || 0;
		   if(numCombatants < 2)
		   {
				var reply = "Need at least two to tango! Usage `combat [num participants]` where [num participants] is 2 or more.\n";
				return msg.reply(reply);
		   }
		   else
		   {
				var reply = "Combat started? [" + combat_started + "]";
				return msg.reply(reply);
		   }
		   
        });
    };

})();
