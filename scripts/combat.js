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
//   hubot combat
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

        robot.hear(/(\/combat){1}(\s*)(\d+|end|clear){0,1}/i, function(msg) {
           
		   var combat_started = robot.brain.get('combat_flag');
		   var numCombatants = msg.match[3] || -1;
		   robot.logger.debug("numCombatants = ["+numCombatants+"]");
		   
		   if(numCombatants.toString().toLowerCase() == "end" || numCombatants.toString().toLowerCase() == "clear" || combat_started == 1)
		   {
			   //combat needs to end
				robot.brain.set('combat_flag', 0);
				//TODO: any other cleanup work (like removing persistent variables)
				robot.logger.debug("Ending combat.");
				return msg.reply(">Ending Comabt");
		   }
		   

		   if(combat_started != 0 && combat_started != 1)
		   {
			   robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			   return msg.reply(">Unknown combat flag["+combat_started+"]");
		   }  
	
		   
		   //Combat has started. First step is to check the number of participants
		   
	
		   if(numCombatants < 2)
		   {
				var reply = ">Need at least two to tango! Usage `combat [num participants]` where [num participants] is 2 or more.\n";
				return msg.reply(reply);
		   }

		   
		   robot.brain.set('combat_flag', 1);
		   return msg.reply(">Combat started with " + numCombatants + ". Everyone roll for initiative!");
		   
        });
    };

})();
