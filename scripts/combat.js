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
		var dice_roller = require('./rolldice');
		var spreadsheet_wrapper = require('./spreadsheet_wrapper');
		
		var hasProp = {}.hasOwnProperty;
		
		const PC_TYPE = 0;
		const MONSTER_TYPE = 1;
		const NPC_TYPE = 2;
		
		const NOT_USING_MONSTER_HP = -999999999;
		
		//const names for the redis keys
		const REDIS_KEY_COMBAT_PREFIX = "combat_script:";
		const REDIS_KEY_COMBAT_STARTED_FLAG = "combat_flag";
		const REDIS_KEY_COMBATANTS_ARRAY = "combatantsArray";
		const REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS = "numRegisteredCombatants";
		const REDIS_KEY_CURRENT_TURN_INDEX = "currentTurnIndex";
		const REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS = "numTotalCombatants";
		const REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT = "pc_graveyard";
		const REDIS_KEY_DM_USERNAME = "dm_username";
		
		var death_euphemisms = new Array('is now at room temperature' ,'bit the dust' ,'bought a one-way ticket' ,'bought the farm ' ,'cashed out his chips' ,'checked out' ,'croaked' ,'is taking a dirt nap' ,'became worm food' ,'flatlined' ,'was fragged' ,'gave up the ghost' ,'is kaput' ,'joined his ancestors' ,'kicked the bucket' ,'kicked the can' ,'has left the building' ,'paid the piper' ,'shuffled off the mortal coil' ,'is six feet under' ,'sleeps with the fishes' ,'was terminated with extreme prejudice' ,'is tits up' ,'took a permanent vacation' ,'returned to dust' ,'walked the plank','forgot to keep breathing','punched his ticket','took the long walk');
		
		var setBrainValue = function(key,value)
		{
			robot.brain.set(REDIS_KEY_COMBAT_PREFIX+key,value);
		};
		
		var getBrainValue = function(key)
		{
			return robot.brain.get(REDIS_KEY_COMBAT_PREFIX+key);
		};
		
		var deleteBrainValue = function(key)
		{
			delete robot.brain.data._private[REDIS_KEY_COMBAT_PREFIX+key];
		};
		
		var getRandomDeathEuphemism = function() {
			var index = Math.floor(Math.random()*death_euphemisms.length);
			var euphemism = death_euphemisms[index];
			return euphemism; 
		};
		
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
			reply += "\n\n*_/combat setdm_* - OPTIONAL: Configures the calling player as the DM. If set, it activates the optional monster HP functionality where only the DM can see monster HP."
			reply += "\n\n*_/combat start [NUM COMBATANTS]_* - Start tracking a combat. You need to specify _NUM COMBATANTS_ to set how many combatants are in the fight.";
			reply += "\n\n*_/combat init [BONUS]_* - Each PC needs to run this to roll for initiative. BONUS is your Dex. bonus. If character sheet integration has been performed, this will automatically use the value in your sheet.  Adding the BONUS param will always override the automatic functionality. Once the correct number of player and monsters have rolled, combat will automatically start.";
			reply += "\n\n*_/combat init-dm [BONUS] [NUM MONSTERS] [MONSTER NAME] [HP DICE]_* - The DM can run this to quickly add monsters of a single type to a combat. The option [HP DICE] command sets the random starting health for each monster.";
			reply += "\n\n*_/combat init-npc [BONUS] [NUM NPC] [NAME/TYPE]_* - Initialize [NUM NPC] NPCs with [NAME/TYPE] into combat (including pets, familiars, mounts).";
			reply += "\n\n*_/combat setinit [INIT]_* - Optional command to manually set your initiative. Useful if you rolled but forgot to put in the right Dex. bonus.";
			reply += "\n\n*_/combat next [REPEAT]_* - Signal to the bot that the current player's turn is over (and it's time for the next player). The optional [REPEAT} parameter allows you to move the turn order forward that many times. So if it's goblin A's turn, `/combat next 3` will complete A, B, and C's turns.";
			reply += "\n\n*_/combat status_* - Broadcasts the current order and indicates whomever's turn it is.";
			reply += "\n\n*_/combat kill [ID]_* - Remove combatant with [ID] from the combat. Can provide multiple IDs separated by a space.";
			reply += "\n\n*_/combat dmg [IDs] hp [DMG]_* - Apply [DMG] worth of damage to [IDs]. Only useful if monster HP is activated. ";
			reply += "\n\n*_/combat end_* - End the combat. You can't start a new combat until you end the old one.";
			reply += "\n\n*_/combat help_* - Prints this message.";
			return reply;
		};
		
		var randint = function(sides) {
            return Math.round(Math.random() * (sides - 1)) + 1;
        };
		
		//just a lazy wrapper for randint
		var rolldie = function(sides) {
            return randint(sides);
        };
		
		function Combatant (name,id,init,type,monsterType,hitpoints) {
			this.name = name;
			this.id = id;
			this.tieBreaker = rolldie(10000);
			this.init = Number(init);
			this.type = Number(type);
			this.monsterType = monsterType;
			this.currentHitpoints = Number(hitpoints);
			this.totalHitpoints = Number(hitpoints);
			this.percentDamage = function(){
				if(currentHitpoints <= 0)
				{
					return 0;
				}
				return (currentHitpoints/totalHitpoints) * 100;
			};
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
			deleteBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG)
			deleteBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS)
			deleteBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS)
			deleteBrainValue(REDIS_KEY_COMBATANTS_ARRAY)
			deleteBrainValue(REDIS_KEY_CURRENT_TURN_INDEX)
			deleteBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT)
			deleteBrainValue(REDIS_KEY_DM_USERNAME);
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
		  
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			
			if(combat_started != 0 && combat_started != 1)
			{
			   robot.logger.debug("Bad value for combat_started ["+combat_started+"]");
			   clearAll();
			   setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
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
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
			//TODO: any other cleanup work (like removing persistent variables)
			deleteBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			deleteBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			deleteBrainValue(REDIS_KEY_CURRENT_TURN_INDEX);
			deleteBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT)
			
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			if(combatantsArray != null)
			{
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var key = combatantsArray[k].name + "_initScore";
					deleteBrainValue(key)
				}
			}
			deleteBrainValue(REDIS_KEY_COMBATANTS_ARRAY)
		};
		

		var combatStart = function(callerName,numCombatants) {
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			robot.logger.debug("numCombatants = ["+numCombatants+"]"); 

			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 1);
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
			setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
			//array of players. currently empty
			var combatantsArray = [];
			setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
			//who is in the fight?
			var numTotalCombatants = numCombatants;
			setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
			
			//create an empty graveyard for PCs
			setBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT, new Array());
			
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 1);
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
			else if(numberOfPCs == 2)
			{
				reply += "*" + combatantsArray[0].name + "* and *" + combatantsArray[1].name + "* are fighting";
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
			var countMonsterTypes = 0;
			for(var type in combatantTypes)
			{
				if(type != "PC" && type != "NPC")
				{
					countMonsterTypes += 1;
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
			robot.logger.debug("reply before pruning:["+reply+"]");
			reply = reply.substring(0,reply.length-1);
			robot.logger.debug
			//add a final "and"
			var lastCommaIndex = reply.lastIndexOf(",");
			if(lastCommaIndex != -1)
			{
				reply = reply.substring(0,lastCommaIndex) + ", and" + reply.substring(lastCommaIndex + 1, reply.length);
			}
			reply += ".\n<SPLIT>";
			
			
			
			if(firstPlayer.type == PC_TYPE) {
				  reply += "\n*" + firstPlayer.name + ", you're up first!*";
			  } else {
				  reply += "\n*" + firstPlayer.name + ", you're up first!*";
			  }	
			
			reply += "\nHere is the combat order:";
			
			
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
			

			return reply; 
		};

		var combatInit = function(callerName, bonus) {
		    var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return combatAdd(callerName, bonus);
			}
			else if(getBrainValue(callerName+"_initScore") != null)
			{
				return callerName+" already rolled initiative `"+getBrainValue(callerName+"_initScore")+"`. No backsies. You can use *_/combat setinit [init]_* to manually fix your initiative, up until the start of combat.";
			}
  			
  			
  			robot.logger.debug("Init request from " + callerName + " with bonus of [" + bonus + "]");
  						
  			var initRoll = rolldie(20);
  			var initScore = initRoll + bonus;
			numRegisteredCombatants += 1;
			
  			var newCombatant = new Combatant(callerName,numRegisteredCombatants,initScore,PC_TYPE,"PC");
  			setBrainValue(callerName+"_initScore",initScore);
  			
  			combatantsArray.push(newCombatant);
  			setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);

  			setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
  			
  			//ready to start combat?
  			if(numRegisteredCombatants == numTotalCombatants)
  			{
				combatantsArray = combatantsArray.sort(combatantSortByInit);
  				setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
  				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,0);
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
		
		

		var initdm = function(callerName,bonus,addBonus,numMonsters,monsterName,hit_dice) {
			robot.logger.debug("DM Init request from " + callerName + " with bonus of [" + bonus + "]");
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return combatAddDM(callerName,bonus,addBonus, numMonsters,monsterName) 
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
			
			//need to set HP if using
			var HP = NOT_USING_MONSTER_HP;
			if(hit_dice != null && hit_dice != "N/A")
			{
				var dice_match = hit_dice.match(/(\d+)(d)(\d+)(\+|-){0,1}(\d+){0,1}/i);
				if(dice_match != null)
				{
					robot.logger.debug("Found dice_match:["+util.inspect(dice_match)+"]");
					var num = dice_match[1] || 1;
					var sides = dice_match[3] || 6;
					var bonusType = dice_match[4] || "";
					var bonus = dice_match[5] || 0;
					
					HP = dice_roller.getRollResults(sides,num).rollsTotal;
					robot.logger.debug("Random HP before bonus is ["+HP+"]");
					if(bonusType == "+")
					{
						HP = HP + Number(bonus);
					}
					else if(bonusType == "-")
					{
						HP = HP - Number(bonus);
					}
					robot.logger.debug("Random HP after bonus is ["+HP+"]");
				}
			}
					
			
			//if the BOSS keyword is used, and there's only one monster, then the monster name should be the name, with "Boss" in the parenthetical.
			if(monsterName.indexOf("BOSS") != -1 && numMonsters == 1)
			{
				numCombatantsIndex += 1;
				monsterName = monsterName.replace("BOSS","").trim();
				var thisMonsterName = monsterName + " (boss villain)";
				var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE,"boss villain",HP);
				combatantsArray.push(newCombatant);
			}
			else
			{
				for(var k = 0; k < numMonsters; k++)
				{
					var index = k + 1;
					numCombatantsIndex += 1;
					var thisMonsterName = enemy_name.getRandomEnemyName() + " (" + monsterName +")";
					var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE,monsterName,HP);
					combatantsArray.push(newCombatant);
				}
			}
			setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
			numRegisteredCombatants += numMonsters;
			setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
			
			//ready to start combat?
			if(numRegisteredCombatants == numTotalCombatants)
			{
			  
				combatantsArray = combatantsArray.sort(combatantSortByInit);
				setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,0);
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
		
		var initNPC = function(callerName,bonus,addBonus,numNPCs,npcName){
			robot.logger.debug("NPC Init request from " + callerName + " with bonus of [" + bonus + "]");
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat before you roll initiative for an NPC...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return combatAddNPC(callerName,bonus,addBonus,numNPCs,npcName);
			}
			
			if((numRegisteredCombatants + numNPCs) > numTotalCombatants)
			{
				var remainingSpots = numTotalCombatants - numRegisteredCombatants;
				return "That's too many NPCs for this combat "+callerName+". You can add " + remainingSpots + " NPCs maximum.\nI already have " +numRegisteredCombatants+ " fighter(s), out of " +numTotalCombatants+" total spots. ";
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
			for(var k = 0; k < numNPCs; k++)
			{
				var index = k + 1;
				numCombatantsIndex += 1;
				var newCombatant = new Combatant(npcName+" (NPC)",numCombatantsIndex,initScore,NPC_TYPE,"NPC");
				combatantsArray.push(newCombatant);
			}
			
			setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
			numRegisteredCombatants += numNPCs;
			setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
			
			
			//ready to start combat?
			if(numRegisteredCombatants == numTotalCombatants)
			{
			  
				combatantsArray = combatantsArray.sort(combatantSortByInit);
				setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,0);
				var firstPlayer = combatantsArray[0];
			  
				var reply = callerName+" rolled `" + initRoll +"` with a modifier of `" + bonusDescription+"` for a total initative score of `"+initScore+"` for " + npcName + " the NPC.<SPLIT>";
								
				reply += constructInitReplyMessage(combatantsArray,firstPlayer);
			
				return reply; 
			}
			else
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				return callerName+" rolled `" + initRoll +"` with a modifier of `" + bonusDescription+"` for a total initative score of `"+initScore+"` for " + npcName + " the NPC.\nStill waiting on "+stillNeeded+" combatants."; 
			}

		};
		
		var combatSetInit = function (callerName, newInit) {
		
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
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
  		
  		
  		var oldInit = getBrainValue(callerName+"_initScore");
  		setBrainValue(callerName+"_initScore",newInit)
  		
  		for(var k = 0; k < combatantsArray.length; k++)
  		{
  		  if(combatantsArray[k].name == callerName)
  		  {
  		    combatantsArray[k].init = newInit;
  		  }
  		}
  		
  		setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
  		
  		return "Manually changed "+callerName+"'s initiative score from `" +oldInit+ "` to `"+newInit+"`.";
		};
		
		var combatStatus = function(callerName) {
		
		  var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
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
					} else {
						reply += "\n" + combatantsArray[k].name + " _[id:"+combatantsArray[k].id+"]_ rolled `" +combatantsArray[k].init+"`.";
					}
					
				}
				return reply;
				
			}
			var currentTurnIndex = getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX);
			
			var isTheCallingUserTheDM = isUserDM(callerName);
			
			var reply = "Here is the current order, with current combatant highlighted:"; 
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				
				var HP_string = "";
				//if the calling player is the DM, and this is a monster, report on its HP
				if(isTheCallingUserTheDM && combatantsArray[k].type == MONSTER_TYPE)
				{
					HP_string = ", HP:" + combatantsArray[k].hitpoints;
				}
				
				if(currentTurnIndex == k)
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					} else {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+HP_string+"]_";
					}
					
				}
				else
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					} else {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+HP_string+"]_";
					}
				}
			}
			return reply;
		};
			
		var combatNext = function(callerName,repeat) {
		  var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
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
					} else {
						reply += "\n" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")" + "  _[id:"+combatantsArray[k].id+"]_";
					}
					
				}
				return reply;
				
			}
			
			
			
			var currentTurnIndex = getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX);
			var reply = "";
			
			if(repeat > 1)
			{
				reply = "Advancing `"+repeat+"` turns. ";
				for(var k = 0; k < repeat; k++)
				{
					currentTurnIndex += 1;
					if(currentTurnIndex >= combatantsArray.length)
					{
						currentTurnIndex = 0;
					}
				}
			}
			else
			{
				currentTurnIndex += 1;
				if(currentTurnIndex >= combatantsArray.length)
				{
					currentTurnIndex = 0;
				}
			}
			
			
			setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
			
			
			
			if(combatantsArray[currentTurnIndex].type == PC_TYPE) {
				reply += "Next turn started. *" +combatantsArray[currentTurnIndex].name+"* is up!";
			} else {
				reply += "Next turn started. *" +combatantsArray[currentTurnIndex].name+"* is up!";
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
					} else {
						reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
					}
					
				}
				else
				{
					if(combatantsArray[k].type == PC_TYPE) {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					} else {
						reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
					}
				}
			}
			
			
			return reply;
		};
	  
	  var combatAdd = function(callerName,bonus) {
		var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
		var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
		//array of players
		var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
		var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
		
		if(combat_started != 0 && combat_started != 1)
		{
  			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+". Need to start combat and roll initiative before you add yourself...";
		}
		else if(getBrainValue(callerName+"_initScore") != null)
  		{
  			return callerName+" already rolled initiative `"+getBrainValue(callerName+"_initScore")+"`. No backsies.\nYou can use `combat setinit [init]` to manually fix your initiative up until the start of combat.";
  		}
  			
  			
  		robot.logger.debug("Add request from " + callerName + " with bonus of [" + bonus + "]");
  			
  		var initRoll = rolldie(20);
  		var initScore = initRoll + Number(bonus);
		numRegisteredCombatants += 1;
		numTotalCombatants += 1;
			
  		var newCombatant = new Combatant(callerName,numRegisteredCombatants,initScore,PC_TYPE);
  		setBrainValue(callerName+"_initScore",initScore);
  			
		//now we have the new combatant and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX));
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
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
			}
		}
		
		setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);

  		setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
  		setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New player "+callerName+" rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
		  
	  };
	  
	  var combatAddNPC = function(callerName,bonus,addBonus,numNPCs,npcName) {
		var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
		var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
		//array of players
		var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
		var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
		
		if(combat_started != 0 && combat_started != 1)
		{
  			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+". Need to start combat before you add an NPC...";
		}

		
  		robot.logger.debug("Add request from " + callerName + " with bonus of [" + bonus + "]");
  			
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
		
		/*
		numRegisteredCombatants += 1;
		numTotalCombatants += 1;
			
  		var newCombatant = new Combatant(npcName,numRegisteredCombatants,initScore,NPC_TYPE,"NPC");
  		
  			
		//now we have the new combatant and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX));
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
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
			}
		}
		
		setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);

  		setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
  		setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New NPC "+npcName+" rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		*/
		var numCombatantsIndex = numRegisteredCombatants;
		var newNPCCombatants = new Array();
		for(var k = 0; k < numNPCs; k++)
		{
			var index = k + 1;
			numCombatantsIndex += 1;
			var newCombatant = new Combatant(npcName+" (NPC)",numRegisteredCombatants,initScore,NPC_TYPE,"NPC");
			newNPCCombatants.push(newCombatant);
		}		
		
		numRegisteredCombatants += numNPCs;
		numTotalCombatants += numNPCs;
			
 			
		//now we have the new monsters and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX));
		var currentCombatant = combatantsArray[currentTurnIndex];
		
		//now add the new player and resort the array
		for(var i = 0; i < newNPCCombatants.length; i++)
		{
			combatantsArray.push(newNPCCombatants[i]);
		}
  		
  		combatantsArray = combatantsArray.sort(combatantSortByInit);
		
		//loop through the new array, find the player whose turn it is, and reset the index
		for(var i = 0; i < combatantsArray.length; i++)
		{
			if(combatantsArray[i].id == currentCombatant.id)
			{
				currentTurnIndex = i;
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
			}
		}
		
		setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);

  		setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
  		setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New NPC(s) "+npcName+" rolled `"+initRoll+"` with a bonus of `"+bonus+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
		  
	  };
	  
	  
	  var combatAddDM = function(callerName,bonus,addBonus,numMonsters,monsterName) {
		var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
		var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
		//array of players
		var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
		var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
		
		if(combat_started != 0 && combat_started != 1)
		{
  			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
			return "No combat started "+callerName+". Begin with `/combat start`";
		}  
		if(combat_started == 0)
		{
			return "Don't get trigger happy "+callerName+".\nNeed to start combat and roll initiative before you add more monsters...";
		}
	    
 			
  			
  		robot.logger.debug("Add request from " + callerName + " with bonus of [" + bonus + "]");
  			
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
		var newMonsterCombatants = new Array();
		for(var k = 0; k < numMonsters; k++)
		{
			var index = k + 1;
			numCombatantsIndex += 1;
			var thisMonsterName = enemy_name.getRandomEnemyName() + " (" + monsterName +")";
			var newCombatant = new Combatant(thisMonsterName,numCombatantsIndex,initScore,MONSTER_TYPE);
			newMonsterCombatants.push(newCombatant);
		}		
		
		numRegisteredCombatants += numMonsters;
		numTotalCombatants += numMonsters;
			
 			
		//now we have the new monsters and their init. But need to make sure the turn counter 
		// stays correct before re-sorting.
		var currentTurnIndex = Number(getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX));
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
				setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
			}
		}
		
		setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);

  		setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
  		setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
  		
		//now construct our response_type
		var reply = "New monsters ("+monsterName+") rolled `"+initRoll+"` with a modifier of `"+bonusDescription+"` for total initiative `"+initScore+"`.\nHere is the new order, with current combatant highlighted:"; 
		for(var k = 0; k < combatantsArray.length; k++)
		{
			var order = k + 1;
			if(currentTurnIndex == k)
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
		  	
		};
		
		
	var combatKill = function(callerName,combatantIdArray,deathMessage) {
		var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);

		if(combat_started != 0 && combat_started != 1)
		{
			robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
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
				robot.logger.debug("Caught error while trying to kill player: ["+error+"]");
				return "Error occured during kill request: ["+error+"]";
			}

		}
		var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
		//array of players
		var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
		var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
		
		var currentTurnIndex = getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX);
		var currentPlayer = combatantsArray[currentTurnIndex];
		
		//now construct our response message.
		var reply = "";
		
		var deathEuphemism = "";
		if(deathMessage != "")
		{
			deathEuphemism = deathMessage;
		}
		else
		{
			deathEuphemism = getRandomDeathEuphemism();
		}
		
		robot.logger.debug("deathEuphemism="+deathEuphemism);
		
		if(combatantsToBeKilled.length < 1)
		{
			return "No valid Ids found. No combatants removed from combat."; 
		}
		else if(combatantsToBeKilled.length == 1)
		{
			reply += "_*" + combatantsToBeKilled[0].name + "*_ "  + deathEuphemism + "\n";
		}
		else
		{
			for(var k = 0; k < combatantsToBeKilled.length; k++)
			{
				reply += "_*" + combatantsToBeKilled[k].name + "*_ "  + deathEuphemism + ".\n";
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
			
			var graveYardArray = getBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT);
			if(graveYardArray.length == 1)
			{
				reply += graveYardArray[0].name + " was killed during the fight.\n";
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
			
			var graveYardArray = getBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT);
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
				} else {
					reply += "\n("+order+") *_" + combatantsArray[k].name + "_*" + "  _[id:"+combatantsArray[k].id+"]_";
				}
				
			}
			else
			{
				if(combatantsArray[k].type == PC_TYPE) {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				} else {
					reply += "\n("+order+") " + combatantsArray[k].name + "  _[id:"+combatantsArray[k].id+"]_";
				}
			}
		}
		return reply;		
	};

	  
		//kill off a comnatant and return their Combatant object
		var killPlayerWithId = function(callerName,combatantId) {
		
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);
			var numRegisteredCombatants = getBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS);
			//array of players
			var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
			var numTotalCombatants = getBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS);
			
			
			
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
					var key = REDIS_KEY_COMBAT_PREFIX+combatantToBeKilled.name+"_initScore";
					if(hasProp.call(robot.brain.data._private, key))
					{
						deleteBrainValue(key)
					}
					var graveYardArray = getBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT);
					graveYardArray.push(combatantToBeKilled);
					setBrainValue(REDIS_KEY_ARRAY_OF_PC_KILLED_IN_COMBAT,graveYardArray);
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
				setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
				combatantsArray.splice(indexOfCombatantToBeKilled,1);
				setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
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
				setBrainValue(REDIS_KEY_NUMBER_OF_REGISTERED_COMBATANTS,numRegisteredCombatants);
				setBrainValue(REDIS_KEY_TOTAL_NUMBER_OF_COMBATANTS,numTotalCombatants);
				
				var currentTurnIndex = getBrainValue(REDIS_KEY_CURRENT_TURN_INDEX);
				var currentPlayer = combatantsArray[currentTurnIndex];
				
				//robot.logger.debug("2. currentPlayer, util.inspect="+util.inspect(currentPlayer));
				//robot.logger.debug("3. combatantToBeKilled, util.inspect="+util.inspect(combatantToBeKilled));
				robot.logger.debug("2. currentTurnIndex, util.inspect="+util.inspect(currentTurnIndex));
				robot.logger.debug("3. combatantsArray.length, util.inspect="+util.inspect(combatantsArray.length));
				
				//if we removing the player whose turn it is currently (which should rarely if ever happpen) need to do some extra work
				if(currentPlayer.id == combatantToBeKilled.id)
				{
					robot.logger.debug("3.5. combatantsArray, util.inspect="+util.inspect(combatantsArray));
					//set the index to whomever comes after them.
					var newCurrentPlayer;
					if((currentTurnIndex+1) >= combatantsArray.length)
					{
						newCurrentPlayer = combatantsArray[0];
					}
					else
					{
						//this doesn't work where current turn index is 1, and the length is 2?
						newCurrentPlayer = combatantsArray[currentTurnIndex+1];
					}
					robot.logger.debug("4. newCurrentPlayer, util.inspect="+util.inspect(newCurrentPlayer));
					//remove the killed player from the combatantsArray
					combatantsArray.splice(indexOfCombatantToBeKilled,1);
					setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
					for(var k = 0; k < combatantsArray.length; k++)
					{
						robot.logger.debug("5["+k+"]. combatantsArray[k], util.inspect="+util.inspect(combatantsArray[k]));
						robot.logger.debug("5["+k+"]. newCurrentPlayer, util.inspect="+util.inspect(newCurrentPlayer));
						if(combatantsArray[k].id == newCurrentPlayer.id)
						{
							currentTurnIndex = k;
							setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
							break;
						}
					}
				}
				else
				{
					//remove the killed player from the combatantsArray
					combatantsArray.splice(indexOfCombatantToBeKilled,1);
					setBrainValue(REDIS_KEY_COMBATANTS_ARRAY,combatantsArray);
					
					//we know who's turn it should be. Just need to reset the turn index to the correct value.
					for(var k = 0; k < combatantsArray.length; k++)
					{
						if(combatantsArray[k].id == currentPlayer.id)
						{
							currentTurnIndex = k;
							setBrainValue(REDIS_KEY_CURRENT_TURN_INDEX,currentTurnIndex);
							break;
						}
					}
				}
				
				return combatantToBeKilled;
			}
		
		};
		
		
		var setDM = function(callerName) {
			setBrainValue(REDIS_KEY_DM_USERNAME,callerName);
			return "Setting _*"+callerName+"*_ as the DM.";
		};
		
		var isUserDM = function(callerName)
		{
			var dm_username = getBrainValue(REDIS_KEY_DM_USERNAME);
			if(callerName == dm_username)
			{
				return true;
			}
			else
			{
				return false;
			}
		};
		
		var clearDM = function()
		{
			deleteBrainValue(REDIS_KEY_DM_USERNAME);
			return "DM value cleared. No DM currently set.";
		};
		
		var combatDamage = function(callerName,playerIdArray,damage)
		{
			var combat_started = getBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG);

			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				setBrainValue(REDIS_KEY_COMBAT_STARTED_FLAG, 0);
				return "No combat started "+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return "Don't get trigger happy "+callerName+". Need to start combat and roll initiative before you damage anyone...";
			}
			
			robot.logger.debug("Damage request from " + callerName + " for IDs [" + playerIdArray + "]");   
			
			var damagedCombatants = new Array();
			for(var k = 0; k < playerIdArray.length; k++)
			{
				try{
					var combatantId = playerIdArray[k];
	
					var combatantsArray = getBrainValue(REDIS_KEY_COMBATANTS_ARRAY);
					
					var indexOfCombatantToBeDamaged = -1;
					for(var i = 0; i< combatantsArray.length; i++)
					{
						var currentCombatant = combatantsArray[i];
						if(currentCombatant.id == combatantId)
						{
							indexOfCombatantToBeDamaged = i;
							break;
						}
					}
			
					if(indexOfCombatantToBeDamaged == -1)
					{
						robot.logger.debug("Didn't find player with ID ["+combatantIdArray[k]+"]");
					}
					else
					{
						var combatantToDamage = combatantsArray[indexOfCombatantToBeDamaged];
						
						if(combatantToDamage.type != MONSTER_TYPE)
						{
							return "Error occured during damage request: combatant ["+combatantToDamage.name+"] is a PC or NPC and does not have HP set in this system."; 
						}
						else if(combatantToDamage.currentHitpoints == NOT_USING_MONSTER_HP)
						{
							return "Error occured during damage request: monster ["+combatantToDamage.name+" ("+combatantToDamage.monsterType+")] does not have HP.";
						}
						damagedCombatants.push(combatantToDamage);
						combatantToDamage.currentHitpoints = combatantToDamage.currentHitpoints - damage;
					}
				}
				catch (error)
				{
					robot.logger.debug("Caught error while trying to damage player: ["+error+"]");
					return "Error occured during damage request: ["+error+"]";
				}

			}
			if(damagedCombatants.length < 1)
			{
				return "Error occured during damage request: no valid monster ids found";
			}
			
			//now we have an array of damaged combatants. need to tell the DM which monsters need to be killed, and how hurt the others are
						
			var reply = "";
			for(var i = 0; i < damagedCombatants.length; i++)
			{
				var damagedCombatant = damagedCombatants[i];
				if(damagedCombatant.currentHitpoints < 1)
				{
					reply += "_*" + damagedCombatant.name + "*_ [id:"+damagedCombatant.id+"] is dead: "+damagedCombatant.currentHitpoints+" HP.\n";
				}
				else
				{
					reply += "_*" + damagedCombatant.name + "*_ [id:"+damagedCombatant.id+"] at "+damagedCombatant.percentDamage+"% HP ("+damagedCombatant.currentHitpoints+"/"+damagedCombatant.totalHitpoints+").\n";
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
			var match = text.match(/([a-z]+-{0,1}[a-z]{0,3})(\s*)(.*)/i);
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
					var repeat = 1;
					if(parameters != "")
					{
						repeat = parameters.match(/\d+/i) || 1;
					}
					reply = combatNext(username,repeat);
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
				case "init-g":
					var bonus = -1;
					if(parameters != "")
					{
						bonus = parameters.match(/\d+/i) || -1;
					}
					
					if(bonus == -1)
					{
						//if bonus is -1, no bonus param was provided. we should thus assume that the player wants to pull the value from their spreadsheet.
						spreadsheet_wrapper.getSpreadsheetValues('1Z9J9onWvwjS8bsXEfdz36jFdFSOHnvJVymFAt_2RUI0','Party Loot!A11:A17',function(err, data) {
							if (err) {
								robot.logger.debug("getSpreadsheetValues error:"+err);
								return msg.reply(err);
							}
							reply = combatInit(username,Number(bonus));
							var msgData = getFormattedJSONMultiAttachment(reply.split("<SPLIT>"),channel_name,true);
							return res.json(msgData);	
						});
						return "";
					}
					reply = combatInit(username,Number(bonus));
					//var msgData = getFormattedJSONAttachment(reply,channel_name,true);
					if(reply == "")
					{
						return;
					}
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
							//check and see if the "monsterName" param has a HD request
							var hit_die_match = monsterName.match(/(\d+)(d)(\d+)([+-]{1}\d+){0,1}/ig) || "";
							var hit_die = "N/A";
							if(hit_die_match != null && hit_die_match != "")
							{
								//robot.logger.debug("Found hit die match:["+util.inspect(hit_die_match)+"]");
								hit_die =  hit_die_match.toString();
								//robot.logger.debug("Setting hit_die to:"+hit_die);
								//robot.logger.debug("monsterName before trim:["+monsterName+"]");
								monsterName = monsterName.replace(hit_die,"").trim();
								//robot.logger.debug("monsterName after trim:["+monsterName+"]");
							}
							reply += initdm(username,bonus,addBonus,numMonsters,monsterName,hit_die);
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
				case "init-npc":
					if(parameters != "")
					{
						var initNPCParams = parameters.match(/(\+|-){0,1}(\d+)\s+(\d+)\s+(.+)/i) || null;
						if(initNPCParams == null)
						{
							reply = "Need to specify the the bonus, number, and the name of the NPC!\n For example, *_/combat init-npc 2 5 steve the dog_* Rolls initiative for 5 steve the dogs, with a +2 bonus.";
						}
						else
						{
							var addBonus = initNPCParams[1] || true;
							if(addBonus == "-")
							{
								addBonus = false;
							}
							else
							{
								addBonus = true;
							}
							var bonus = initNPCParams[2] || 0;
							bonus = Number(bonus);
							var numNPCs = initNPCParams[3] || 0;
							numNPCs = Number(numNPCs);
							if(numNPCs < 1)
							{
								reply = "The number of NPCs must be 1 or more!\n For example, *_/combat init-npc 2 5 steve the dog_* Rolls initiative for 5 'steve the dogs', with a +2 bonus.";
								var msgData = getFormattedJSONMultiAttachment(reply.split("<SPLIT>"),channel_name,true);						
								return res.json(msgData);
							}
							var npcName = initNPCParams[4] || "Johnson";
							
							reply += initNPC(username,bonus,addBonus,numNPCs,npcName);
						}
					}
					else
					{
						reply = "Need to specify the the bonus, number, and the name of the NPC!\n For example, *_/combat init-npc 2 5 steve the dog_* Rolls initiative for 5 steve the dogs, with a +2 bonus.";
					}
					//var msgData = getFormattedJSONAttachment(reply,channel_name,true);
					var msgData = getFormattedJSONMultiAttachment(reply.split("<SPLIT>"),channel_name,true);
					
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
						var deathMessageMatch = parameters.match(/(\s{1}[a-z]+([a-z|\s|'])*)*/ig) || "";
						robot.logger.debug("matched deathMessageMatch param=["+deathMessageMatch+"]");	
									
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
							
							var deathMessage = "";
							if(deathMessageMatch != "")
							{
								/*
								for(var d = 0; d < deathMessageMatch.length; d++)
								{
									if(deathMessageMatch[d] != "")
									{
										deathMessage = deathMessageMatch[d];
									}
								}
								*/
								robot.logger.debug("deathMessageMatch before filter["+deathMessageMatch+"]");
								deathMessageMatch = deathMessageMatch.filter(function(n){ return n != "" });
								robot.logger.debug("deathMessageMatch before filter["+deathMessageMatch+"]");
								deathMessage = deathMessageMatch[0];
							}
							
							robot.logger.debug("found trimmed deathMessage param=["+deathMessage+"]");
							reply = combatKill(username,playerIdArray,deathMessage);
						}
					}
					else
					{
						reply = "Need to specify the id of combatant to remove from the fight. Use *_/combat status_* to see the IDs.";
					}
					var msgData = getFormattedJSONAttachment(reply,channel_name,true);
					return res.json(msgData);
					break;
				case "dmg":
					if(parameters != "")
					{
						var parameters_string = parameters.toString();
						var dmg_paramaters = parameters_string.match(/([\d\s]+) (hp) (\d+)/i) || -1;
									
						if(dmg_paramaters == null || dmg_paramaters == -1)
						{
							robot.logger.debug("dmg_paramaters null or -1. dmg_paramaters=["+dmg_paramaters+"], parameters_string=["+parameters_string+"]");
							reply = "Need to specify the id or ids of combatant to damage, and the amount of damage to apply. Use *_/combat status_* to see the IDs.";
						}
						else
						{
							robot.logger.debug("dmg_paramaters=["+dmg_paramaters+"]");
							var id_string = dmg_paramaters[1] || "NA";
							if(id_string == "NA")
							{
								robot.logger.debug("id_string was empty. id_string=["+id_string+"]");
								reply = "Need to specify the id or ids of combatant to damage, and the amount of damage to apply. Use *_/combat status_* to see the IDs.";
							}
							else
							{		
								var id_array = id_string.split(" ");
								for(var k = 0; k < id_array.length; k++)
								{
									id_array[k] = Number(id_array[k].trim());
								}
								
								var damage = Number(dmg_paramaters[3]) || -1;
								robot.logger.debug("id_array =["+util.inspect(id_array)+"], HP damage = ["+damage+"]");
								reply = combatDamage(username,id_array,damage);
							}
						}
					}
					else
					{
						robot.logger.debug("parameters was an empty string");
						reply = "Need to specify the id or ids of combatant to damage, and the amount of damage to apply. Use *_/combat status_* to see the IDs.";
					}
					var msgData = getFormattedJSONAttachment(reply,channel_name,false);
					return res.json(msgData);
					break;
				case "setdm":
					reply = setDM(username);
					var msgData = getFormattedJSONAttachment(reply,channel_name,true);
					return res.json(msgData);
					break;
				case "cleardm":
					reply = clearDM(username);
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
