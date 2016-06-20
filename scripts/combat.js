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
        var util = require("util");
		var enemy_name = require('./enemy_name');

		var hasProp = {}.hasOwnProperty;
		
		const PC_TYPE = 0;
		const MONSTER_TYPE = 1;
		
		var helpText = function() {
			var reply = "";
			reply = "/combat tracks your combat status. The following are the commands (in roughly the same order you need to use them in). Bracketed text below are the paramters you need to replace with your own values:";
			reply += "\n\n*_/combat start [NUM COMBATANTS]_* - Start tracking a combat. You need to specify _NUM COMBATANTS_ to set how many combatants are in the fight.";
			reply += "\n\n*_/combat init [BONUS]_* - Each PC needs to run this to roll for initiative. BONUS is your Dex. bonus. Once the correct number of player and monsters have rolled, combat will automatically start.";
			reply += "\n\n*_/combat initdm [BONUS] [NUM MONSTERS] [MONSTER NAME]_* - The DM can run this to quickly add monsters of a single type to a combat.";
			reply += "\n\n*_/combat setinit [INIT]_* - Optional command to manually set your initiative. Useful if you rolled but forgot to put in the right Dex. bonus.";
			reply += "\n\n*_/combat next_* - Signal to the bot that the current player's turn is over (and it's time for the next player).";
			reply += "\n\n*_/combat status_* - Broadcasts the current order and indicates whomever's turn it is.";
			reply += "\n\n*_/combat add [BONUS]_* - Use this to add a player to a combat that has already started. BONUS is your Dex. initiative bonus.";
			reply += "\n\n*_/combat add-dm [BONUS] [NUM MONSTERS] [MONSTER NAME]_* - The DM can use this to add new monsters to a fight that has already started.";
			reply += "\n\n*_/combat end_* - End the combat. You can't start a new combat until you end the old one.";
			reply += "\n\n*_/combat help_* - Prints this message.";
			return reply;
		};
		
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
		
		//just a lazy wrapper for randint
		var rolldie = function(sides) {
            return randint(sides);
        };
		
		function Combatant (name,id,init,type) {
			this.name = name;
			this.id = id;
			this.init = Number(init);
			this.type = Number(type);
		};
 	
		var combatantSortByName = function(a,b) {
			var nameA=a.name.toLowerCase();
			var nameB=b.name.toLowerCase();
			if (nameA < nameB) //sort string ascending
				return -1 
			if (nameA > nameB)
				return 1
			return 0 //default return value (no sorting) 
		};
		
		var combatantSortByInit = function(a,b) {
			var initA=a.init;
			var initB=b.init;
			if (initA < initB) //sort int descending
				return 1 
			if (initA > initB)
				return -1
			return 0 //default return value (no sorting) 
		};
		
		var clearAll = function() {
			delete robot.brain.data._private['combat_flag'];
			delete robot.brain.data._private['numRegisteredCombatants'];
			delete robot.brain.data._private['numTotalCombatants'];
			delete robot.brain.data._private['combatantsArray'];
			delete robot.brain.data._private['currentTurnIndex'];
			var key;
			for (key in robot.brain.data._private) 
			{
				if(!hasProp.call(robot.brain.data._private, key)) continue;
				robot.logger.debug("key["+key+"]:value["+robot.brain.data._private[key]+"]");
				if(key.indexOf("_initScore") != -1)
				{
					delete robot.brain.data._private[key];
				}
			}	
			robot.logger.debug("Clearing all combat data.");
		};
		
			
		var combatEnd = function (callerName) {
		  
			var combat_started = robot.brain.get('combat_flag');
			
			if(combat_started != 0 && combat_started != 1)
			{
			   robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			   clearAll();
			   robot.brain.set('combat_flag', 0);
			   return "No combat started @"+callerName+". Begin with `/combat start`";
			}  
		  if(combat_started == 0)
			{
			   return "No combat started @"+callerName+". Begin with `/combat start`";
			}
			//combat needs to end
			
			robot.brain.set('combat_flag', 0);
			//TODO: any other cleanup work (like removing persistent variables)
			delete robot.brain.data._private['numRegisteredCombatants'];
			delete robot.brain.data._private['numTotalCombatants'];
			delete robot.brain.data._private['currentTurnIndex'];
			
			var combatantsArray = robot.brain.get('combatantsArray');
			if(combatantsArray != null)
			{
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var key = combatantsArray[k].name + "_initScore";
					delete robot.brain.data._private[key];
				}
			}
			delete robot.brain.data._private['combatantsArray'];
			
			robot.logger.debug("Ending combat.");
			return "@"+callerName+" is taking the low road. Ending Combat (all combat data cleared).";
		};
		

		var combatStart = function(callerName,numCombatants) {
			var combat_started = robot.brain.get('combat_flag');
			robot.logger.debug("numCombatants = ["+numCombatants+"]"); 

			if(combat_started != 0 && combat_started != 1)
		   {
			   robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			   robot.brain.set('combat_flag', 1);
			}  
			else if(combat_started == 1)
			{
				return "Combat already started @"+callerName+". End with `/combat end`";
			}
		   //Combat has started. First step is to check the number of participants
		   
		   if(numCombatants < 2)
		   {
				var reply = "Need at least two to tango @"+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
				return reply;
		   }

					   
			   //how many players have rolled for initiative? zero so far
			   var numRegisteredCombatants = 0;
			   robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
			   //array of players. currently empty
			   var combatantsArray = [];
			   robot.brain.set('combatantsArray',combatantsArray);
			   //who is in the fight?
			   var numTotalCombatants = numCombatants;
			   robot.brain.set('numTotalCombatants',numTotalCombatants);
			   
			   
			   robot.brain.set('combat_flag', 1);
			   return "@"+callerName+" started combat with " + numCombatants + " belligerents. Everyone in @channel roll for initiative with the _/combat init [BONUS]_ command!";
			   
		};
		

		var combatInit = function(callerName, bonus) {
		    var combat_started = robot.brain.get('combat_flag');
			  var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			  //array of players
			  var combatantsArray = robot.brain.get('combatantsArray');
			  var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			
			  if(combat_started != 0 && combat_started != 1)
  			{
  				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			  	robot.brain.set('combat_flag', 0);
				  return "No combat started @"+callerName+". Begin with `/combat start`";
			  }  
			  if(combat_started == 0)
			  {
				  return "Don't get trigger happy @"+callerName+". Need to start combat before you roll initiative...";
		    }
			  else if(numTotalCombatants == numRegisteredCombatants)
			  {
				  return "This combat is full up @"+callerName+".";
		  	}
			  else if(robot.brain.get(callerName+"_initScore") != null)
  			{
  				return "@" + callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies. You can use *_/combat setinit [init]_* to manually fix your initiative, up until the start of combat.";
  			}
  			
  			
  			robot.logger.debug("Init request from " + callerName + " with bonus of [" + bonus + "]");
  			
  			var initRoll = rolldie(20);
  			var initScore = initRoll + bonus;
			numRegisteredCombatants += 1;
			
  			var newCombatant = new Combatant(callerName,numRegisteredCombatants,initScore,PC_TYPE);
  			robot.brain.set(callerName+"_initScore",initScore);
  			
  			combatantsArray.push(newCombatant);
  			robot.brain.set('combatantsArray',combatantsArray);

  			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
  			
  			//ready to start combat?
  			if(numRegisteredCombatants == numTotalCombatants)
  			{
  				var reply = "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.";
  				reply += "\nAll Combatants accounted for.";
  				reply += "\nHere is the combat order:";
  				
  				combatantsArray = combatantsArray.sort(combatantSortByInit);
  				robot.brain.set('combatantsArray',combatantsArray);
  				robot.brain.set('currentTurnIndex',0);
  				for(var k = 0; k < combatantsArray.length; k++)
  				{
  					var order = k + 1;
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") @" + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					}
  				}
  				reply += "\n*Let the fight begin!*";
  				return reply; 
  			}
  			else
  			{
  				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
  				return "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.\nStill waiting on "+stillNeeded+" combatants."; 
  			}
		  
		  };
		  

		var initdm = function(callerName,bonus,numMonsters,monsterName) {
			robot.logger.debug("DM Init request from " + callerName + " with bonus of [" + bonus + "]");
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return "No combat started @"+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy @"+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return "This combat is full up @"+callerName+". Add your self to the fight with `combat add [initiative bonus]`";
			}
			
			
			robot.logger.debug("Adding [" + numMonsters + "] to the combat");
			robot.logger.debug("Number of registered = " + numRegisteredCombatants);
			robot.logger.debug("Total number of combatants = " + numTotalCombatants);
						
			if((numRegisteredCombatants + numMonsters) > numTotalCombatants)
			{
				var remainingSpots = numTotalCombatants - numRegisteredCombatants;
				return "That's too many monsters for this combat @"+callerName+". You can add " + remainingSpots + " monsters maximum. I already have " +numRegisteredCombatants+ " fighter(s), out of " +numTotalCombatants+" total spots. ";
			}
			
			
			
			var initRoll = rolldie(20);
			var initScore = initRoll + Number(bonus);
			var numCombatantsIndex = numRegisteredCombatants;
			for(var k = 0; k < numMonsters; k++)
			{
				var index = k + 1;
				numCombatantsIndex += 1;
				var thisMonsterName = enemy_name.getRandomEnemyName() + " the " + monsterName;
				var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE);
				combatantsArray.push(newCombatant);
			}
			
			robot.brain.set('combatantsArray',combatantsArray);
			numRegisteredCombatants += numMonsters;
			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
			
			//ready to start combat?
			if(numRegisteredCombatants == numTotalCombatants)
			{
				var reply = "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"` for " + numMonsters + " " + monsterName + ".";
				reply += "\nAll Combatants accounted for.";
				reply += "\nHere is the combat order:";
				
				combatantsArray = combatantsArray.sort(combatantSortByInit);
				robot.brain.set('combatantsArray',combatantsArray);
				robot.brain.set('currentTurnIndex',0);
				var firstPlayerName = "";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var order = k + 1;
					if(k == 0)
					{
						firstPlayerName = combatantsArray[k].name;
					}
					
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") @" + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					}					
				}
				reply += "\n*@" + firstPlayerName + ", you're up first!*";
				return reply; 
			}
			else
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				return "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"` for " + numMonsters + " " + monsterName + ".\nStill waiting on "+stillNeeded+" combatants."; 
			}
		};
		
		var combatSetInit = function (callerName, newInit) {
		
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return "No combat started @"+callerName+". Begin with `/combat start`";
			}  
			else if(combat_started == 0)
			{
				return "Don't get trigger happy @"+callerName+". Need to start combat before you set initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return "You cannot set your initiative once the combat has started @"+callerName+".";
			}
			
			robot.logger.debug("Manual init request from " + callerName + " with init of [" + newInit + "]");
  		
  		
  		var oldInit = robot.brain.get(callerName+"_initScore");
  		robot.brain.set(callerName+"_initScore",newInit)
  		
  		for(var k = 0; k < combatantsArray.length; k++)
  		{
  		  if(combatantsArray[k].name == callerName)
  		  {
  		    combatantsArray[k].init = newInit;
  		  }
  		}
  		
  		robot.brain.set('combatantsArray',combatantsArray);
  		
  		return "Manually changed @"+callerName+"'s initiative score from `" +oldInit+ "` to `"+newInit+"`.";
		};
		
		var combatStatus = function(callerName) {
		
		  var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return "No combat started @"+callerName+". Begin with `/combat start`"
			}  
			else if(combat_started == 0)
			{
				return "The status is, there's no status @"+callerName+". Need to start combat first.";
			}
			else if(numRegisteredCombatants < numTotalCombatants)
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				var reply = "Still waiting on "+stillNeeded+" combatants before starting."; 
				reply += "\nHere is who has already rolled:";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n@" + combatantsArray[k].name + " rolled `" +combatantsArray[k].init+"`.";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n" + combatantsArray[k].name + " rolled `" +combatantsArray[k].init+"`.";
					}
					
				}
				return reply;
				
			}
			var currentTurnIndex = robot.brain.get('currentTurnIndex');
			
			var reply = "Here is the current order, with current combatant highlighted:"; 
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				if(currentTurnIndex == k)
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") *_@" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
					}
					
				}
				else
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") @" + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
					}
				}
			}
			return reply;
		};
			
		var combatNext = function(callerName) {
		  var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return "No combat started @"+callerName+". Begin with `/combat start`";
			}  
			else if(combat_started == 0)
			{
				return "No combat started @"+callerName+". Begin with `/combat start`";
			}
			else if(numRegisteredCombatants < numTotalCombatants)
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				var reply = "Still waiting on "+stillNeeded+" combatants before starting."; 
				reply += "\nHere is who has already rolled:";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var order = k + 1;
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n@" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")" + "  [id:"+combatantsArray[k].id+"]";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")" + "  [id:"+combatantsArray[k].id+"]";
					}
					
				}
				return reply;
				
			}
			var currentTurnIndex = robot.brain.get('currentTurnIndex');
			currentTurnIndex += 1;
			if(currentTurnIndex >= combatantsArray.length)
			{
				currentTurnIndex = 0;
			}
			robot.brain.set('currentTurnIndex',currentTurnIndex);
			var reply = ""
			if(combatantsArray[currentTurnIndex].type == PC_TYPE) {
				reply = "Next turn started. @" +combatantsArray[currentTurnIndex].name+" is up!";
			} else if (combatantsArray[currentTurnIndex].type == MONSTER_TYPE) {
				reply = "Next turn started. " +combatantsArray[currentTurnIndex].name+" is up!";
			}
			
			return reply;
		};
	  
	  var combatAdd = function(callerName,bonus) {
		var combat_started = robot.brain.get('combat_flag');
		var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
		//array of players
		var combatantsArray = robot.brain.get('combatantsArray');
		var numTotalCombatants = robot.brain.get('numTotalCombatants');
		
		if(combat_started != 0 && combat_started != 1)
		{
  			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			robot.brain.set('combat_flag', 0);
			return "No combat started @"+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy @"+callerName+". Need to start combat and roll initiative before you add yourself...";
		}
	    else if(numRegisteredCombatants < numTotalCombatants)
	    {
			return "No need to use *_add_* right now @"+callerName+". Try *_/combat init [BONUS]_* to roll for initiative and join the fight.";
		}
		else if(robot.brain.get(callerName+"_initScore") != null)
  		{
  			return "@" + callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies. You can use `combat setinit [init]` to manually fix your initiative up until the start of combat.";
  		}
  			
  			
  		robot.logger.debug("Add request from " + callerName + " with bonus of [" + bonus + "]");
  			
  		var initRoll = rolldie(20);
  		var initScore = initRoll + Number(bonus);
		numRegisteredCombatants += 1;
		numTotalCombatants += 1;
			
  		var newCombatant = new Combatant(callerName,numRegisteredCombatants,initScore,PC_TYPE);
  		robot.brain.set(callerName+"_initScore",initScore);
  			
		//now we have the new combatant and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(robot.brain.get('currentTurnIndex'));
		var currentCombatant = combatantsArray[currentTurnIndex];
		
		//now add the new player and resort the array
  		combatantsArray.push(newCombatant);
  		combatantsArray = combatantsArray.sort(combatantSortByInit);
		
		//loop through the array, find the player whose turn it is, and reset the index
		for(var i = 0; i < combatantsArray.length; i++)
		{
			if(combatantsArray[i].id == currentCombatant.id)
			{
				currentTurnIndex = i;
				robot.brain.set('currentTurnIndex',currentTurnIndex);
			}
		}
		
		robot.brain.set('combatantsArray',combatantsArray);

  		robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
  		robot.brain.set('numTotalCombatants',numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New player @"+callerName+" rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_@" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") @" + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
				}
			}
		}
		return reply;		
		  
	  };
	  
	  var combatAddDM = function(callerName,bonus,numMonsters,monsterName) {
		var combat_started = robot.brain.get('combat_flag');
		var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
		//array of players
		var combatantsArray = robot.brain.get('combatantsArray');
		var numTotalCombatants = robot.brain.get('numTotalCombatants');
		
		if(combat_started != 0 && combat_started != 1)
		{
  			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			robot.brain.set('combat_flag', 0);
			return "No combat started @"+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy @"+callerName+". Need to start combat and roll initiative before you add more monsters...";
		}
	    else if(numRegisteredCombatants < numTotalCombatants)
	    {
			return "No need to use *_add_* right now @"+callerName+". Try *_/combat initdm [BONUS] [NUM MONSTERS] [NAME]_* to roll initiative for a few monsters.";
		}
 			
  			
  		robot.logger.debug("Add request from " + callerName + " with bonus of [" + bonus + "]");
  			
  		var initRoll = rolldie(20);
  		var initScore = initRoll + Number(bonus);
		
		var numCombatantsIndex = numRegisteredCombatants;
		var newMonsterCombatants = new Array();
		for(var k = 0; k < numMonsters; k++)
		{
			var index = k + 1;
			numCombatantsIndex += 1;
			var thisMonsterName = enemy_name.getRandomEnemyName() + " the " + monsterName;
			var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE);
			newMonsterCombatants.push(newCombatant);
		}		
		
		numRegisteredCombatants += numMonsters;
		numTotalCombatants += numMonsters;
			
 			
		//now we have the new monsters and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(robot.brain.get('currentTurnIndex'));
		var currentCombatant = combatantsArray[currentTurnIndex];
		
		//now add the new player and resort the array
		for(var i = 0; i < newMonsterCombatants.length; i++)
		{
			combatantsArray.push(newMonsterCombatants[i]);
		}
  		
  		combatantsArray = combatantsArray.sort(combatantSortByInit);
		
		//loop through the new array, find the player whose turn it is, and reset the index
		for(var i = 0; i < combatantsArray.length; i++)
		{
			if(combatantsArray[i].id == currentCombatant.id)
			{
				currentTurnIndex = i;
				robot.brain.set('currentTurnIndex',currentTurnIndex);
			}
		}
		
		robot.brain.set('combatantsArray',combatantsArray);

  		robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
  		robot.brain.set('numTotalCombatants',numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New monsters ("+monsterName+") rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_@" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  [id:"+combatantsArray[k].id+"]";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") @" + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  [id:"+combatantsArray[k].id+"]";
				}
			}
		}
		return reply;		
		  	
		};
		
		
		
		
	  /* begin 'hear' functions*/
	  /*
	  robot.hear(/(combat_clean_names)/i, function(msg) {
			var names = enemy_name.cleanNames();			
			robot.logger.debug(util.inspect(names));
			return msg.reply("names inspected.");
		});
	  */
	  robot.hear(/(combat_hear clearall)/i, function(msg) {
			var callerName = msg.message.user.name;			
			clearAll();
			return msg.reply("@"+callerName+" cleared all current combat data.");
		});
		
		robot.hear(/(combat_hear next)/i, function(msg) {
			var callerName = msg.message.user.name;			
			var reply = combatNext(callerName);
			
			return msg.reply(reply);
		});
		
		robot.hear(/(combat_hear end)/i, function(msg) {
			var callerName = msg.message.user.name;
			var reply = combatEnd(callerName);
			return msg.reply(reply);
		});
		
		robot.hear(/(combat_hear start )(\d+)/i, function(msg) {
			var callerName = msg.message.user.name;
			var numCombatants = msg.match[2] || -1;
			var reply = combatStart(callerName,numCombatants);
			return msg.reply(reply);
		});
		
		robot.hear(/combat_hear start$/i, function(msg) {
            var callerName = msg.message.user.name;
			var reply = "Need at least two to tango @"+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
			return msg.reply(reply);
	
        });
		
		robot.hear(/combat_hear init(\s){0,1}(\d+){0,1}$/i, function(msg) {
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			bonus = Number(bonus);
		
			var reply = combatInit(callerName,bonus);
			return msg.reply(reply);
		});
		
		robot.hear(/combat_hear initdm(\s){0,1}(\d+){0,1}(\s){0,1}(\d+){0,1}(\s){0,1}([a-z]*){0,1}$/i, function(msg) {
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			
			var numMonsters = Number(msg.match[4]) || 1;
			var monsterName = msg.match[6] || "Nameless Monster";
						
			var reply = initdm(callerName,bonus,numMonsters,monsterName);
			return msg.reply(reply);
		});
		
		robot.hear(/(combat_hear setinit (\d+))/i, function(msg) {
			var callerName = msg.message.user.name;		
			var init = msg.match[2] || 0;
			init = Number(init);
			
			var reply = combatSetInit(callerName,init);
			 
			return msg.reply(reply);
		});
		
		robot.hear(/(combat_hear status)/i, function(msg) {
			var callerName = msg.message.user.name;			
			var reply = combatStatus(callerName);
			return msg.reply(reply);
		});
		/*end 'hear' functions*/
		
		/*begin slash command listening code*/
		var getFormattedJSONAttachment = function(messageText,channel,inChannel) {
			
			var msgData = {
				
				"attachments": [{
					"fallback": messageText,
					"color": "#cc3300",
					"footer": "Combat Script",
					"footer_icon": "http://plainstexasdivision.tripod.com/sitebuildercontent/sitebuilderpictures/crossedswords.gif",
					"text": messageText,
					"channel":channel,
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
		

		robot.router.post('/hubot/combat', function(req, res) {
			robot.logger.debug("Received a POST request to /hubot/combat");
			  
			var data, channel_name, response_url, command, subcommand, text, token,username;
				   
			data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
			//robot.logger.debug("data:"+util.inspect(data));
			command = data.command;
		   
			token = data.token;
			username = data.user_name;
			channel_name = data.channel_name;
			text = data.text;
			var match = text.match(/([a-z]+-{0,1}[a-z]{0,2})(\s*)(.*)/i);
			var reply = "";  
			if(match != null)
			{
				var subcommand = match[1] || "invalid";
				var parameters = match[3] || "";
				robot.logger.debug("Subcommand recieved: ["+subcommand+"]");
				robot.logger.debug("Parameters recieved: ["+parameters+"]");
				switch(subcommand)
				{
					case "clearall":
						clearAll();
						reply = "All combat data cleared.";
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
						break;
					case "next":
					  reply = combatNext(username);
					  var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "end":
					  reply = combatEnd(username);
					  var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "start":
						if(parameters != "")
						{
							var numCombatants = parameters.match(/\d+/i) || -1;
							if(numCombatants == -1)
							{
								reply = "Need to specify the number of combatants in the fight (minimum of 2)!\n For example, *_/combat start 4_* begins a combat with four participants.";
							}
							else
							{
								reply = combatStart(username,Number(numCombatants));
							}
						}
						else
						{
							reply = "Need to specify the number of combatants in the fight (minimum of 2)!\n For example, *_/combat start 4_* begins a combat with four participants.";
						}
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "init":
						var bonus = 0;
						if(parameters != "")
						{
							bonus = parameters.match(/\d+/i) || 0;
						}
						reply = combatInit(username,Number(bonus));
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "init-dm":
						if(parameters != "")
						{
							var initdmParams = parameters.match(/(\d+)\s+(\d+)\s+([a-z]+)/i) || null;
							if(initdmParams == null)
							{
								reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat initdm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
							}
							else
							{
								var bonus = initdmParams[1] || 0;
								bonus = Number(bonus);
								var numMonsters = initdmParams[2] || 0;
								numMonsters = Number(numMonsters);
								var monsterName = initdmParams[3] || "Nameless Horror";
								reply += initdm(username,bonus,numMonsters,monsterName);
							}
						}
						else
						{
							reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat initdm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
						}
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "add":
						var bonus = 0;
						if(parameters != "")
						{
							bonus = parameters.match(/\d+/i) || 0;
						}
						reply = combatAdd(username,Number(bonus));
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "add-dm":
						if(parameters != "")
						{
							var initdmParams = parameters.match(/(\d+)\s+(\d+)\s+([a-z]+)/i) || null;
							if(initdmParams == null)
							{
								reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat initdm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
							}
							else
							{
								var bonus = initdmParams[1] || 0;
								bonus = Number(bonus);
								var numMonsters = initdmParams[2] || 0;
								numMonsters = Number(numMonsters);
								var monsterName = initdmParams[3] || "Nameless Horror";
								reply += initdm(username,bonus,numMonsters,monsterName);
							}
						}
						else
						{
							reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat initdm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
						}
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "setinit":
						if(parameters != "")
						{
							var newInit = parameters.match(/\d+/i) || -1;
							if(newInit == -1)
							{
								reply = "Need to specify the new initiative value!\n For example, *_/combat setinit 12_* will set your initiative to 12. Note that you can only use this function up until all initiatives have been rolled.";
							}
							else
							{
								reply = combatSetInit(username,Number(newInit));
							}
						}
						else
						{
							reply = "Need to specify the new initiative value!\n For example, *_/combat setinit 12_* will set your initiative to 12. Note that you can only use this function up until all initiatives have been rolled.";
						}
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "status":
						reply = combatStatus(username);
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						return res.json(msgData);
						break;
					case "help":
						reply = helpText();
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
						break;
					default:
						reply = "I don't know how to _" + subcommand + "_! Use _/combat help_ for an explanation of each command.";
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
				}
			}
			else
			{
				reply = "Missing a command! Use _/combat help_ for an explanation of each command.";
				var msgData = getFormattedJSONAttachment(reply,channel_name,false);
				return res.json(msgData);
			}
		});
		
		//end function definitions
    };

})();
