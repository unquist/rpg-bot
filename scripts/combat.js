// Description:
//   Keeps track of combat
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
		
		var death_euphemisms = new Array('is now at room temperature' ,'bit the dust' ,'bought a one-way ticket' ,'bought the farm ' ,'cashed out his chips' ,'checked out' ,'croaked' ,'is taking a dirt nap' ,'became worm food' ,'flatlined' ,'was fragged' ,'gave up the ghost' ,'is kaput' ,'joined his ancestors' ,'kicked the bucket' ,'kicked the can' ,'has left the building' ,'paid the piper' ,'shuffled off the mortal coil' ,'is six feet under' ,'sleeps with the fishes' ,'was terminated with extreme prejudice' ,'is tits up' ,'took a permanent vacation' ,'return to dust' ,'walked the plank','forgot to keep breathing','punched his ticket','took the long walk');
		
		var getRandomDeathEuphemism = function() {
		  var index = Math.floor(Math.random()*death_euphemisms.length);
		  var euphemism = death_euphemisms[index];
      return euphemism; 
		}
		
		var getRealNameFromId = function(userId)
    {
      var user = robot.brain.data.users[userId];
      if(user == null)
      {
        return "<Unknown User>"
      }
      
      return user.real_name;
    };
		
		var countCombatantTypes = function(combatantsArray)
		{
			var combatantTypes = {};
			
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var combatant = combatantsArray[k];
				var combatantType = combatant.monsterType;
				if(combatantType in combatantTypes)
				{
					var currentCount = Number(combatantTypes[combatantType]);
					currentCount += 1;
					combatantTypes[combatantType] = currentCount;
				}
				else
				{
					combatantTypes[combatantType] = 1;
				}
			}
			
			return combatantTypes;
		};
		
		var helpText = function() {
			var reply = "";
			reply = "/combat tracks your combat status. The following are the commands (in roughly the same order you need to use them in). Bracketed text below are the paramters you need to replace with your own values:";
			reply += "\n\n*_/combat start [NUM COMBATANTS]_* - Start tracking a combat. You need to specify _NUM COMBATANTS_ to set how many combatants are in the fight.";
			reply += "\n\n*_/combat init [BONUS]_* - Each PC needs to run this to roll for initiative. BONUS is your Dex. bonus. Once the correct number of player and monsters have rolled, combat will automatically start.";
			reply += "\n\n*_/combat init-dm [BONUS] [NUM MONSTERS] [MONSTER NAME]_* - The DM can run this to quickly add monsters of a single type to a combat.";
			reply += "\n\n*_/combat setinit [INIT]_* - Optional command to manually set your initiative. Useful if you rolled but forgot to put in the right Dex. bonus.";
			reply += "\n\n*_/combat next_* - Signal to the bot that the current player's turn is over (and it's time for the next player).";
			reply += "\n\n*_/combat status_* - Broadcasts the current order and indicates whomever's turn it is.";
			reply += "\n\n*_/combat add [BONUS]_* - Use this to add a player to a combat that has already started. BONUS is your Dex. initiative bonus.";
			reply += "\n\n*_/combat add-dm [BONUS] [NUM MONSTERS] [MONSTER NAME]_* - The DM can use this to add new monsters to a fight that has already started.";
			reply += "\n\n*_/combat kill [ID]_* - Remove combatant with [ID] from the combat. Can provide multiple IDs separated by a space.";
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
		
		function Combatant (name,id,init,type,monsterType) {
			this.name = name;
			this.id = id;
			this.tieBreaker = rolldie(10000);
			this.init = Number(init);
			this.type = Number(type);
			this.monsterType = monsterType;
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
			//if the initiatives are tied, sort by the tie breaker score.
			return combatantSortByTieBreaker(a,b) //default return value (no sorting) 
		};
		
		var combatantSortByTieBreaker = function(a,b) {
			var tieBreakerA=a.tieBreaker;
			var tieBreakerB=b.tieBreaker;
			if (tieBreakerA < tieBreakerB) //sort int descending
				return 1 
			if (tieBreakerA > tieBreakerA)
				return -1
			return 0 //default return value (no sorting) 
		};
		
		var clearAll = function() {
			delete robot.brain.data._private['combat_flag'];
			delete robot.brain.data._private['numRegisteredCombatants'];
			delete robot.brain.data._private['numTotalCombatants'];
			delete robot.brain.data._private['combatantsArray'];
			delete robot.brain.data._private['currentTurnIndex'];
			delete robot.brain.data._private['pc_graveyard'];
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
			   return "No combat started "+callerName+". Begin with `/combat start`";
			}  
		  if(combat_started == 0)
			{
			   return "No combat started "+callerName+". Begin with `/combat start`";
			}
			//combat needs to end
			
			combatCleanupAfterEnd();
			
			robot.logger.debug("Ending combat.");
			return callerName+" decided that enough is enough.\nEnding Combat (all combat data cleared).";
		};
		
		var combatCleanupAfterEnd = function(){
		  robot.brain.set('combat_flag', 0);
			//TODO: any other cleanup work (like removing persistent variables)
			delete robot.brain.data._private['numRegisteredCombatants'];
			delete robot.brain.data._private['numTotalCombatants'];
			delete robot.brain.data._private['currentTurnIndex'];
			delete robot.brain.data._private['pc_graveyard'];
			
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
				return "Combat already started "+callerName+". End with `/combat end`";
			}
		   //Combat has started. First step is to check the number of participants
		   
		   if(numCombatants < 2)
		   {
				var reply = "Need at least two to tango "+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
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
			   
			   //create an empty graveyard for PCs
			   robot.brain.set('pc_graveyard', new Array());
			   
			   robot.brain.set('combat_flag', 1);
			   return callerName+" started combat with " + numCombatants + " belligerents.\nEveryone in @channel roll for initiative with the _/combat init [BONUS]_ command!";
			   
		};
		
		var constructInitReplyMessage = function(combatantsArray,firstPlayer)
		{
			var reply = "All Combatants accounted for. *Begin combat*!\n";
			var combatantTypes = countCombatantTypes(combatantsArray);
			
			var numberOfPCs = Number(combatantTypes['PC']);
			var PCsCounted = 0;
			
			if(numberOfPCs == 1)
			{
				for(var k = 0; k < combatantsArray.length; k++)
				{
					if(combatantsArray[k].type == PC_TYPE)
					{
						reply += "*" + combatantsArray[k].name + "* is fighting";
					}
				}
			}
			else
			{
				for(var k = 0; k < combatantsArray.length; k++)
				{
					if(combatantsArray[k].type == PC_TYPE)
					{
						PCsCounted += 1;
						if(PCsCounted < numberOfPCs)
						{
							reply += "*" + combatantsArray[k].name + "*, ";
						}
						else
						{
							reply += "and *" + combatantsArray[k].name + "* ";
						}
					}
				}
				reply += " are fighting";
			}
			for(var type in combatantTypes)
			{
				if(type != "PC")
				{
					if(Number(combatantTypes[type]) > 1)
					{
						reply += " " + combatantTypes[type] + " " + type + "s,";
					}
					else
					{
						reply += " " + combatantTypes[type] + " " + type + ",";
					}						
				}
			}
			//chop off the last comma.
			reply = reply.substring(0,reply.length-1);
			
			//add a final "and"
			var lastCommaIndex = reply.lastIndexOf(",");
			if(lastCommaIndex != -1)
			{
				reply = reply.substring(0,lastCommaIndex) + ", and" + reply.substring(lastCommaIndex + 1, reply.length);
			}
			reply += ".\n<SPLIT>";
			
			
			
			if(firstPlayer.type == PC_TYPE) {
				  reply += "\n*" + firstPlayer.name + ", you're up first!*";
			  } else if (firstPlayer.type == MONSTER_TYPE) {
				  reply += "\n*" + firstPlayer.name + ", you're up first!*";
			  }	
			
			reply += "\nHere is the combat order:";
			
			
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
			

			return reply; 
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
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return "This combat is full up "+callerName+".";
			}
			else if(robot.brain.get(callerName+"_initScore") != null)
			{
				return callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies. You can use *_/combat setinit [init]_* to manually fix your initiative, up until the start of combat.";
			}
  			
  			
  			robot.logger.debug("Init request from " + callerName + " with bonus of [" + bonus + "]");
  			
  			var initRoll = rolldie(20);
  			var initScore = initRoll + bonus;
			numRegisteredCombatants += 1;
			
  			var newCombatant = new Combatant(callerName,numRegisteredCombatants,initScore,PC_TYPE,"PC");
  			robot.brain.set(callerName+"_initScore",initScore);
  			
  			combatantsArray.push(newCombatant);
  			robot.brain.set('combatantsArray',combatantsArray);

  			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
  			
  			//ready to start combat?
  			if(numRegisteredCombatants == numTotalCombatants)
  			{
				combatantsArray = combatantsArray.sort(combatantSortByInit);
  				robot.brain.set('combatantsArray',combatantsArray);
  				robot.brain.set('currentTurnIndex',0);
  				var firstPlayer = combatantsArray[0];
				
				var reply = callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.<SPLIT>";
				
				reply += constructInitReplyMessage(combatantsArray,firstPlayer);
				
				return reply;
				
  			}
  			else
  			{
  				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
  				return callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.\nStill waiting on "+stillNeeded+" combatants."; 
  			}
		  
		  };
		  

		var initdm = function(callerName,bonus,addBonus,numMonsters,monsterName) {
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
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return "This combat is full up "+callerName+". Add your self to the fight with `combat add [initiative bonus]`.";
			}
			
			
			robot.logger.debug("Adding [" + numMonsters + "] to the combat");
			robot.logger.debug("Number of registered = " + numRegisteredCombatants);
			robot.logger.debug("Total number of combatants = " + numTotalCombatants);
						
			if((numRegisteredCombatants + numMonsters) > numTotalCombatants)
			{
				var remainingSpots = numTotalCombatants - numRegisteredCombatants;
				return "That's too many monsters for this combat "+callerName+". You can add " + remainingSpots + " monsters maximum.\nI already have " +numRegisteredCombatants+ " fighter(s), out of " +numTotalCombatants+" total spots. ";
			}
			
			
			
			var initRoll = rolldie(20);
			var initScore = initRoll;
			var bonusDescription = "";
			if(addBonus)
			{
				initScore += Number(bonus);
				bonusDescription = "+" + bonus;
				
			}
			else
			{
				initScore -= Number(bonus);
				bonusDescription = "-" + bonus;
			}
			var numCombatantsIndex = numRegisteredCombatants;
			for(var k = 0; k < numMonsters; k++)
			{
				var index = k + 1;
				numCombatantsIndex += 1;
				var thisMonsterName = enemy_name.getRandomEnemyName() + " (" + monsterName +")";
				var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE,monsterName);
				combatantsArray.push(newCombatant);
			}
			
			robot.brain.set('combatantsArray',combatantsArray);
			numRegisteredCombatants += numMonsters;
			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
			
			//ready to start combat?
			if(numRegisteredCombatants == numTotalCombatants)
			{
			  
				combatantsArray = combatantsArray.sort(combatantSortByInit);
				robot.brain.set('combatantsArray',combatantsArray);
				robot.brain.set('currentTurnIndex',0);
				var firstPlayer = combatantsArray[0];
			  
				var reply = callerName+" rolled `" + initRoll +"` with a modifier of `" + bonusDescription+"` for a total initative score of `"+initScore+"` for " + numMonsters + " " + monsterName + ".<SPLIT>";
								
				reply += constructInitReplyMessage(combatantsArray,firstPlayer);
			
				return reply; 
			}
			else
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				return callerName+" rolled `" + initRoll +"` with a modifier of `" + bonusDescription+"` for a total initative score of `"+initScore+"` for " + numMonsters + " " + monsterName + ".\nStill waiting on "+stillNeeded+" combatants."; 
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
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			else if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you set initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return "You cannot set your initiative once the combat has started "+callerName+".";
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
  		
  		return "Manually changed "+callerName+"'s initiative score from `" +oldInit+ "` to `"+newInit+"`.";
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
				return "No combat started "+callerName+". Begin with `/combat start`"
			}  
			else if(combat_started == 0)
			{
				return "The status is, there's no status "+callerName+". Need to start combat first.";
			}
			else if(numRegisteredCombatants < numTotalCombatants)
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				var reply = "Still waiting on "+stillNeeded+" combatants before starting."; 
				reply += "\nHere is who has already rolled:";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n" + combatantsArray[k].name + " _[id:"+combatantsArray[k].id+"]_ rolled `" +combatantsArray[k].init+"`.";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n" + combatantsArray[k].name + " _[id:"+combatantsArray[k].id+"]_ rolled `" +combatantsArray[k].init+"`.";
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
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					}
					
				}
				else
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
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
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			else if(combat_started == 0)
			{
				return "No combat started "+callerName+". Begin with `/combat start`";
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
						reply += "\n" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")" + "  _[id:"+combatantsArray[k].id+"]_";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")" + "  _[id:"+combatantsArray[k].id+"]_";
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
				reply = "Next turn started. *" +combatantsArray[currentTurnIndex].name+"* is up!";
			} else if (combatantsArray[currentTurnIndex].type == MONSTER_TYPE) {
				reply = "Next turn started. *" +combatantsArray[currentTurnIndex].name+"* is up!";
			}
			
			//now list out the number of monsters left, and the current status.
			var numMonstersRemaining = 0
			for(var k = 0; k < combatantsArray.length; k++)
			{
			  if(combatantsArray[k].type == MONSTER_TYPE)
			  {
			    numMonstersRemaining +=1;
			  }
			}
			reply += "\nThere are _" + numMonstersRemaining + "_ enemies remaining."
			
			//now list the current list of combatants
			reply += "\nHere is the current order:"; 
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				if(currentTurnIndex == k)
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					}
					
				}
				else
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					} else if (combatantsArray[k].type == MONSTER_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					}
				}
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
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+". Need to start combat and roll initiative before you add yourself...";
		}
	    else if(numRegisteredCombatants < numTotalCombatants)
	    {
			return "No need to use *_add_* right now "+callerName+". Try *_/combat init [BONUS]_* to roll for initiative and join the fight.";
		}
		else if(robot.brain.get(callerName+"_initScore") != null)
  		{
  			return callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies.\nYou can use `combat setinit [init]` to manually fix your initiative up until the start of combat.";
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
		var reply = "New player "+callerName+" rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
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
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+".\nNeed to start combat and roll initiative before you add more monsters...";
		}
	    else if(numRegisteredCombatants < numTotalCombatants)
	    {
			return "No need to use *_add_* right now "+callerName+".\nTry *_/combat init-dm [BONUS] [NUM MONSTERS] [NAME]_* to roll initiative for a few monsters.";
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
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
		  	
		};
		
		
	var combatKill = function(callerName,combatantIdArray) {
		var combat_started = robot.brain.get('combat_flag');

		if(combat_started != 0 && combat_started != 1)
		{
			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			robot.brain.set('combat_flag', 0);
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+". Need to start combat and roll initiative before you remove anyone...";
		}
		
		robot.logger.debug("Kill request from " + callerName + " for IDs [" + combatantIdArray + "]");   
		
		
		var combatantsToBeKilled = new Array();
		for(var k = 0; k < combatantIdArray.length; k++)
		{
			try{
				var tempCombatantToBeKilled = killPlayerWithId(callerName,combatantIdArray[k]);
				if(tempCombatantToBeKilled == -1)
				{
					robot.logger.debug("Didn't find player with ID ["+combatantIdArray[k]+"]");
				}
				else
				{
					combatantsToBeKilled.push(tempCombatantToBeKilled);
				}
			}
			catch (error)
			{
				robot.logger.debug("Caught error while trying to kill player: ["+error.essage+"]");
				return "Error occured during kill request: ["+error.essage+"]";
			}

		}
		var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
		//array of players
		var combatantsArray = robot.brain.get('combatantsArray');
		var numTotalCombatants = robot.brain.get('numTotalCombatants');
		
		var currentTurnIndex = robot.brain.get('currentTurnIndex');
		var currentPlayer = combatantsArray[currentTurnIndex];
		
		//now construct our response message.
		var reply = "";
		if(combatantsToBeKilled.length < 1)
		{
			return "No valid Ids found. No combatants removed from combat."; 
		}
		else if(combatantsToBeKilled.length == 1)
		{
			reply += "_*" + combatantsToBeKilled[0].name + "*_ "  + getRandomDeathEuphemism() + "\n";
		}
		else
		{
			for(var k = 0; k < combatantsToBeKilled.length; k++)
			{
				reply += "_*" + combatantsToBeKilled[k].name + "*_ "  + getRandomDeathEuphemism() + ".\n";
			}
			
		}
		
		//now we need to check and see if that removed enough combatants to remove the total to one or zero.
		if(combatantsArray.length == 0)
		{
			//should be an extreme edge case.
			reply += "Mutually assured destrution: all combatants are dead!\nEnding combat and clearing combat data.\n";
			combatCleanupAfterEnd();
			return reply;
		}
		else if(combatantsArray.length == 1)
		{
			reply += "*_" + combatantsArray[0].name + "_* is the only one still standing when the dust clears.\n";
			
			var graveYardArray = robot.brain.get('pc_graveyard');
			if(graveYardArray.length == 1)
			{
				reply += graveYardArray[k].name + " was killed during the fight.\n";
			}
			else if(graveYardArray.length > 1)
			{
				
				for(var k = 0; k < graveYardArray.length; k++)
				{
					reply += graveYardArray[k].name + ", ";					
				}
				//chop off the last comma.
				reply = reply.substring(0,reply.length-2);
				
				
				//add a final "and"
				var lastCommaIndex = reply.lastIndexOf(",");
				reply = reply.substring(0,lastCommaIndex) + ", and" + reply.substring(lastCommaIndex + 1, reply.length);
				reply += " were killed during the fight.\n";
			}
			
			reply += "Ending combat and clearing combat data.\n";
			combatCleanupAfterEnd();
			return reply;
		}
		
		
		//now check if the number of enemies remaining is zero
		var numMonstersRemaining = 0
		for(var k = 0; k < combatantsArray.length; k++)
		{
			if(combatantsArray[k].type == MONSTER_TYPE)
			{
				numMonstersRemaining +=1;
			}
		}
		if(numMonstersRemaining < 1)
		{
			reply += "All hostile monsters eliminated!\n"
			
			var graveYardArray = robot.brain.get('pc_graveyard');
			if(graveYardArray.length == 1)
			{
				reply += graveYardArray[k].name + " was killed during the fight.\n";
			}
			else if(graveYardArray.length > 1)
			{
				
				for(var k = 0; k < graveYardArray.length; k++)
				{
					reply += graveYardArray[k].name + ", ";					
				}
				//chop off the last comma.
				reply = reply.substring(0,reply.length-2);
				
				
				//add a final "and"
				var lastCommaIndex = reply.lastIndexOf(",");
				reply = reply.substring(0,lastCommaIndex) + ", and" + reply.substring(lastCommaIndex + 1, reply.length);
				reply += " were killed during the fight.\n";
			}
			
			reply += "Ending combat and clearing combat data.\n";
			combatCleanupAfterEnd();
			return reply;
		}
		reply += "Here is the current order:\n";
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else if (combatantsArray[k].type == MONSTER_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
	};

	  
		//kill off a comnatant and return their Combatant object
		var killPlayerWithId = function(callerName,combatantId) {
		
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			var indexOfCombatantToBeKilled = -1;
			for(var i = 0; i< combatantsArray.length; i++)
			{
				var currentCombatant = combatantsArray[i];
				if(currentCombatant.id == combatantId)
				{
					indexOfCombatantToBeKilled = i;
					break;
				}
			}
			
			if(indexOfCombatantToBeKilled == -1)
			{
				return -1;
			}
			
			var combatantToBeKilled = combatantsArray[indexOfCombatantToBeKilled];
			
			//we've located the correct player. Need to remove from array, erase any redis data.
			
			//PCs have special redis data to prevent them from rolling init too many times. Need to erase it.	
			if(combatantToBeKilled.type == PC_TYPE) 
			{
				try
				{
					var key = combatantToBeKilled.name+"_initScore";
					robot.logger.debug("key["+key+"]:value["+robot.brain.data._private[key]+"]");
					if(hasProp.call(robot.brain.data._private, key))
					{
						delete robot.brain.data._private[key];
					}
					var graveYardArray = robot.brain.get('pc_graveyard');
					graveYardArray.push(combatantToBeKilled);
					robot.brain.set('pc_graveyard',graveYardArray);
				}
				catch(err)
				{
					robot.logger.debug("Caught error trying to delete key in Kill function ->" + err.message);
				}
				
			} 
			
			
			//if we don't have everyone, just reduce the number of registered combatants by 1.  
			if(numRegisteredCombatants < numTotalCombatants)
			{
				numRegisteredCombatants -= 1;
				robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
				combatantsArray.splice(indexOfCombatantToBeKilled,1);
				robot.brain.set('combatantsArray',combatantsArray);
				var combatantsLeft = numTotalCombatants - numRegisteredCombatants;
				return combatantToBeKilled;;
			}
			else 
			{
				// If the fight has already started, decremement both the registered fighters and the total number. 
				// Need to keep the turn counter correct too.
				// We shouldn't need to reshuffle the array b/c it's already in the correct order.
				numRegisteredCombatants -= 1;
				numTotalCombatants -= 1;
				robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
				robot.brain.set('numTotalCombatants',numTotalCombatants);
				
				var currentTurnIndex = robot.brain.get('currentTurnIndex');
				var currentPlayer = combatantsArray[currentTurnIndex];
				
				
				//if we removing the player whose turn it is currently (which should rarely if ever happpen) need to do some extra work
				if(currentPlayer.id == combatantToBeKilled.id)
				{
					
					//set the index to whomever comes after them.
					var newCurrentPlayer;
					if((currentTurnIndex+1) > combatantsArray.length)
					{
						newCurrentPlayer = combatantsArray[0];
					}
					else
					{
						newCurrentPlayer = combatantsArray[currentTurnIndex+1];
					}
					
					//remove the killed player from the combatantsArray
					combatantsArray.splice(indexOfCombatantToBeKilled,1);
					robot.brain.set('combatantsArray',combatantsArray);
					for(var k = 0; k < combatantsArray.length; k++)
					{
						if(combatantsArray[k].id == newCurrentPlayer.id)
						{
							currentTurnIndex = k;
							robot.brain.set('currentTurnIndex',currentTurnIndex);
							break;
						}
					}
				}
				else
				{
					//remove the killed player from the combatantsArray
					combatantsArray.splice(indexOfCombatantToBeKilled,1);
					robot.brain.set('combatantsArray',combatantsArray);
					
					//we know who's turn it should be. Just need to reset the turn index to the correct value.
					for(var k = 0; k < combatantsArray.length; k++)
					{
						if(combatantsArray[k].id == currentPlayer.id)
						{
							currentTurnIndex = k;
							robot.brain.set('currentTurnIndex',currentTurnIndex);
							break;
						}
					}
				}
				
				return combatantToBeKilled;
			}
		
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
			return msg.reply(callerName+" cleared all current combat data.");
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
			var reply = "Need at least two to tango "+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
			return msg.reply(reply);
	
        });
		
		robot.hear(/combat_hear init(\s){0,1}(\d+){0,1}$/i, function(msg) {
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			bonus = Number(bonus);
		
			var reply = combatInit(callerName,bonus);
			return msg.reply(reply);
		});
		
		robot.hear(/combat_hear init-dm(\s){0,1}(\d+){0,1}(\s){0,1}(\d+){0,1}(\s){0,1}([a-z]*){0,1}$/i, function(msg) {
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
		
		var getFormattedJSONMultiAttachment = function(messageArray,channel,inChannel) {
		
		  var msgData = {
				
				"attachments": []
          };
		  
		  for(var k = 0; k < messageArray.length; k++)
		  {
			var attachment = {
				"fallback": messageArray[k],
				"color": "#cc3300",
				"text": messageArray[k],
				"channel":channel,
				"mrkdwn_in": ["text"]
			}
			
			if( (k+1) == messageArray.length)
			{
				attachment["footer_icon"] = "http://plainstexasdivision.tripod.com/sitebuildercontent/sitebuilderpictures/crossedswords.gif";
				attachment["footer"] = "Combat Script";
			}
			
			msgData['attachments'].push(attachment);
		  }
		  
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
			robot.logger.debug("received token:["+token+"]");
			//robot.logger.debug("stored token is:["+process.env.)
			//username = data.user_name;
			username = getRealNameFromId(data.user_id);
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
						//var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						var msgData = getFormattedJSONMultiAttachment(reply.split("<SPLIT>"),channel_name,true);
						return res.json(msgData);
						break;
					case "init-dm":
						if(parameters != "")
						{
							var initdmParams = parameters.match(/(\+|-){0,1}(\d+)\s+(\d+)\s+(.+)/i) || null;
							if(initdmParams == null)
							{
								reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat init-dm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
							}
							else
							{
								var addBonus = initdmParams[1] || true;
								if(addBonus == "-")
								{
									addBonus = false;
								}
								else
								{
									addBonus = true;
								}
								var bonus = initdmParams[2] || 0;
								bonus = Number(bonus);
								var numMonsters = initdmParams[3] || 0;
								numMonsters = Number(numMonsters);
								var monsterName = initdmParams[4] || "Nameless Horror";
								reply += initdm(username,bonus,addBonus,numMonsters,monsterName);
							}
						}
						else
						{
							reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat init-dm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
						}
						//var msgData = getFormattedJSONAttachment(reply,channel_name,true);
						var msgData = getFormattedJSONMultiAttachment(reply.split("<SPLIT>"),channel_name,true);
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
							var addDmParams = parameters.match(/(\d+)\s+(\d+)\s+(.+)/i) || null;
							if(addDmParams == null)
							{
								reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat init-dm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
							}
							else
							{
								var bonus = addDmParams[1] || 0;
								bonus = Number(bonus);
								var numMonsters = addDmParams[2] || 0;
								numMonsters = Number(numMonsters);
								var monsterName = addDmParams[3] || "Nameless Horror";
								reply += combatAddDM(username,bonus,numMonsters,monsterName);
							}
						}
						else
						{
							reply = "Need to specify the the bonus, number of monsters, and the name of the monsters!\n For example, *_/combat add-dm 2 10 Bugbear_* Rolls initiative for 10 Bugbears, with a +2 bonus.";
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
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
						break;
					case "help":
						reply = helpText();
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
						break;
					case "kill":
						if(parameters != "")
						{
							var playerId = parameters.match(/(\d+)/ig) || -1;
							if(playerId == -1)
							{
								reply = "Need to specify the id or ids of combatant to remove from the fight. Use *_/combat status_* to see the IDs.";
							}
							else
							{
							  robot.logger.debug("original playerId arry set to->"+playerId+"<--");
							  var playerIdArray = new Array();
							  for(var k = 0; k < playerId.length; k++)
  							{
  							  playerIdArray.push(Number(playerId[k]));
  							}
							  
							  robot.logger.debug("Constructed playerIdArray->"+playerIdArray+"<--");
								reply = combatKill(username,playerIdArray);
							}
						}
						else
						{
							reply = "Need to specify the id of combatant to remove from the fight. Use *_/combat status_* to see the IDs.";
						}
						var msgData = getFormattedJSONAttachment(reply,channel_name,true);
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
