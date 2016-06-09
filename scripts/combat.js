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
		var hasProp = {}.hasOwnProperty;
		
		var insults = ['artless','bawdy','beslubbering','bootless','churlish','cockered','clouted','craven','currish','dankish','dissembling','droning','errant','fawning','fobbing','froward','frothy','gleeking','goatish','gorbellied','impertinent','infectious','jarring','loggerheaded','lumpish','mammering','mangled','mewling','paunchy','pribbling','puking','puny','qualling','rank','reeky','roguish','ruttish','saucy','spleeny','spongy','surly','tottering','unmuzzled','vain','venomed','villainous','warped','wayward','weedy','yeasty','cullionly','fusty','caluminous','wimpled','burly-boned','misbegotten','odiferous','poisonous','fishified','Wart-necked','base-court','bat-fowling','beef-witted','beetle-headed','boil-brained','clapper-clawed','clay-brained','common-kissing','crook-pated','dismal-dreaming','dizzy-eyed','doghearted','dread-bolted','earth-vexing','elf-skinned','fat-kidneyed','fen-sucked','flap-mouthed','fly-bitten','folly-fallen','fool-born','full-gorged','guts-griping','half-faced','hasty-witted','hedge-born','hell-hated','idle-headed','ill-breeding','ill-nurtured','knotty-pated','milk-livered','motley-minded','onion-eyed','plume-plucked','pottle-deep','pox-marked','reeling-ripe','rough-hewn','rude-growing','rump-fed','shard-borne','sheep-biting','spur-galled','swag-bellied','tardy-gaited','tickle-brained','toad-spotted','unchin-snouted','weather-bitten','whoreson','malmsey-nosed','rampallian','lily-livered','scurvy-valiant','brazen-faced','unwashed','bunch-backed','leaden-footed','muddy-mettled','pigeon-livered','scale-sided','apple-john','baggage','barnacle','bladder','boar-pig','bugbear','bum-bailey','canker-blossom','clack-dish','clotpole','coxcomb','codpiece','death-token','dewberry','flap-dragon','flax-wench','flirt-gill','foot-licker','fustilarian','giglet','gudgeon','haggard','harpy','hedge-pig','horn-beast','hugger-mugger','joithead','lewdster','lout','maggot-pie','malt-worm','mammet','measle','minnow','miscreant','moldwarp','mumble-news','nut-hook','pigeon-egg','pignut','puttock','pumpion','ratsbane','scut','skainsmate','strumpet','varlot','vassal','whey-face','wagtail','knave','blind-worm','popinjay','scullian','jolt-head','malcontent','devil-monk','toad','rascal','basket-cockle'];

		var getRandomInsult = function() {
			var index = randint(insults.length) - 1;
			return insults[index];
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
		
		function Combatant (name,init) {
			this.name = name;
			this.init = Number(init);
		};
 
		Combatant.prototype.getName = function() {
			return this.name;
		};
		
		Combatant.prototype.getInit = function() {
			return this.init;
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
		
		robot.hear(/(combat clearall)/i, function(msg) {
			var callerName = msg.message.user.name;			
			clearAll();
			return msg.reply(">@"+callerName+" cleared all current combat data.");
		});
		
		var combatEnd = function (callerName) {
		  
			var combat_started = robot.brain.get('combat_flag');
			
			if(combat_started != 0 && combat_started != 1)
			{
			   robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
			   clearAll();
			   robot.brain.set('combat_flag', 0);
			   return ">No combat started @"+callerName+". Begin with `/combat start`";
			}  
		  if(combat_started == 0)
			{
			   return ">No combat started @"+callerName+". Begin with `/combat start`";
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
			return ">@"+callerName+" is taking the low road. Ending Combat (all combat data cleared).";
		};
		
		
		robot.hear(/(combat end)/i, function(msg) {
			var callerName = msg.message.user.name;
			var reply = combatEnd(callerName);
			return msg.reply(reply);
		});
		
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
				return ">Combat already started @"+callerName+". End with `/combat end`";
			}
		   //Combat has started. First step is to check the number of participants
		   
		   if(numCombatants < 2)
		   {
				var reply = ">Need at least two to tango @"+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
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
			   return ">@"+callerName+" started combat with " + numCombatants + " belligerents. Everyone roll for initiative!";
			   
		};
		
		robot.hear(/(combat start )(\d+)/i, function(msg) {
			var callerName = msg.message.user.name;
			var numCombatants = msg.match[2] || -1;
			var reply = combatStart(callerName,numCombatants);
			return msg.reply(reply);
		});
		
		robot.hear(/combat start$/i, function(msg) {
            var callerName = msg.message.user.name;
			var reply = ">Need at least two to tango @"+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
			return msg.reply(reply);
	
        });
		
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
				  return ">No combat started @"+callerName+". Begin with `/combat start`";
			  }  
			  if(combat_started == 0)
			  {
				  return ">Don't get trigger happy @"+callerName+". Need to start combat before you roll initiative...";
		    }
			  else if(numTotalCombatants == numRegisteredCombatants)
			  {
				  return ">This combat is full up @"+callerName+".";
		  	}
			  else if(robot.brain.get(callerName+"_initScore") != null)
  			{
  				return ">@" + callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies. You can use `combat setinit [init]` to manually fix your initiative up until the start of combat.";
  			}
  			
  			
  			robot.logger.debug("Init request from " + callerName + " with bonus of [" + bonus + "]");
  			
  			var initRoll = rolldie(20);
  			var initScore = initRoll + bonus;
  			var newCombatant = new Combatant(callerName,initScore);
  			robot.brain.set(callerName+"_initScore",initScore);
  			
  			combatantsArray.push(newCombatant);
  			robot.brain.set('combatantsArray',combatantsArray);
  			numRegisteredCombatants += 1;
  			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
  			
  			//ready to start combat?
  			if(numRegisteredCombatants == numTotalCombatants)
  			{
  				var reply = ">@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.";
  				reply += "\n>All Combatants accounted for.";
  				reply += "\n>Here is the combat order:";
  				
  				combatantsArray = combatantsArray.sort(combatantSortByInit);
  				robot.brain.set('combatantsArray',combatantsArray);
  				robot.brain.set('currentTurnIndex',0);
  				for(var k = 0; k < combatantsArray.length; k++)
  				{
  					var order = k + 1;
  					reply += "\n>("+order+") @" + combatantsArray[k].name + " the " + getRandomInsult();
  				}
  				reply += "\n>*Let the bloodletting begin!*";
  				return reply; 
  			}
  			else
  			{
  				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
  				return ">@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.\n>Still waiting on "+stillNeeded+" combatants."; 
  			}
		  
		  };
		  
	    robot.hear(/combat init(\s){0,1}(\d+){0,1}$/i, function(msg) {
			  var callerName = msg.message.user.name;
				var bonus = msg.match[2] || 0;
			  bonus = Number(bonus);
			
			  var reply = combatInit(callerName,bonus);
			  return msg.reply(reply);
		
      });
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
				return ">No combat started @"+callerName+". Begin with `/combat start`";
			}  
			if(combat_started == 0)
			{
				return ">Don't get trigger happy @"+callerName+". Need to start combat before you roll initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return ">This combat is full up @"+callerName+". Add your self to the fight with `combat add [initiative bonus]`";
			}
			
			
			robot.logger.debug("Adding [" + numMonsters + "] to the combat");
			robot.logger.debug("Number of registered = " + numRegisteredCombatants);
			robot.logger.debug("Total number of combatants = " + numTotalCombatants);
						
			if((numRegisteredCombatants + numMonsters) > numTotalCombatants)
			{
				return ">That's too many monsters for this combat @"+callerName+". I already have " +numRegisteredCombatants+ " fighter(s), out of " +numTotalCombatants+" total spots.";
			}
			
			
			
			var initRoll = rolldie(20);
			var initScore = initRoll + Number(bonus);
			for(var k = 0; k < numMonsters; k++)
			{
				var index = k + 1;
				var thisMonsterName = monsterName+"["+index+"]";
				var newCombatant = new Combatant(thisMonsterName,initScore);
				combatantsArray.push(newCombatant);
			}
			
			robot.brain.set('combatantsArray',combatantsArray);
			numRegisteredCombatants += numMonsters;
			robot.brain.set('numRegisteredCombatants',numRegisteredCombatants);
			
			//ready to start combat?
			if(numRegisteredCombatants == numTotalCombatants)
			{
				var reply = ">@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"` for " + numMonsters + " " + monsterName + ".";
				reply += "\n>All Combatants accounted for.";
				reply += "\n>Here is the combat order:";
				
				combatantsArray = combatantsArray.sort(combatantSortByInit);
				robot.brain.set('combatantsArray',combatantsArray);
				robot.brain.set('currentTurnIndex',0);
				var firstPlayerName = "";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var order = k + 1;
					if(k == 0)
					{
						reply += "\n>("+order+") _@" + combatantsArray[k].name + " the " + getRandomInsult() + "_";
						firstPlayerName = combatantsArray[k].name;
					}
					else
					{
						reply += "\n>("+order+") @" + combatantsArray[k].name + " the " + getRandomInsult();
					}
				}
				reply += "\n>*@" + firstPlayerName + ", you're up first!*";
				return reply; 
			}
			else
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				return ">@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+" for " + numMonsters + " " + monsterName + ".\n>Still waiting on "+stillNeeded+" combatants."; 
			}
		};
		
		
		robot.hear(/combat initdm(\s){0,1}(\d+){0,1}(\s){0,1}(\d+){0,1}(\s){0,1}([a-z]*){0,1}$/i, function(msg) {
			//var callerName = msg.message.user.name;
			//for debug only:
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			
			var numMonsters = Number(msg.match[4]) || 1;
			var monsterName = msg.match[6] || "Nameless Monster";
						
			var reply = initdm(callerName,bonus,numMonsters,monsterName);
			return msg.reply(reply);
		});
		
		var combatSetInit = function (callerName, newInit)
		{
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return ">No combat started @"+callerName+". Begin with `/combat start`";
			}  
			else if(combat_started == 0)
			{
				return ">Don't get trigger happy @"+callerName+". Need to start combat before you set initiative...";
			}
			else if(numTotalCombatants == numRegisteredCombatants)
			{
				return ">You cannot set your initiative once the combat has started @"+callerName+".";
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
  		
  		return ">Manually changed @"+callerName+"'s initiative score from `" +oldInit+ "` to `"+newInit+"`.";
		};
		
		robot.hear(/(combat setinit (\d+))/i, function(msg) {
			var callerName = msg.message.user.name;		
			var init = msg.match[2] || 0;
			init = Number(init);
			
			var reply = combatSetInit(callerName,init);
			 
			return msg.reply(reply);
		});
		
		
		robot.hear(/(combat status)/i, function(msg) {
			var callerName = msg.message.user.name;			
				
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return msg.reply(">No combat started @"+callerName+". Begin with `/combat start`");
			}  
			else if(combat_started == 0)
			{
				return msg.reply(">The status is, there's no status @"+callerName+". Need to start combat first.");
			}
			else if(numRegisteredCombatants < numTotalCombatants)
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				var reply = ">Still waiting on "+stillNeeded+" combatants before starting."; 
				reply += "\n>Here is who has already rolled:";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					reply += "\n>@" + combatantsArray[k].name + " the " + getRandomInsult() + " rolled `" +combatantsArray[k].init+"`.";
				}
				return msg.reply(reply);
				
			}
			var currentTurnIndex = robot.brain.get('currentTurnIndex');
			
			var reply = ">Here is the current order, with current combatant highlighted:"; 
			for(var k = 0; k < combatantsArray.length; k++)
			{
				var order = k + 1;
				
				if(currentTurnIndex == k)
				{
					reply += "\n>("+order+") *_@" + combatantsArray[k].name + " the " + getRandomInsult()+"_*";
				}
				else
				{
					reply += "\n>("+order+") @" + combatantsArray[k].name + " the " + getRandomInsult();
				}
				
				
			}
			return msg.reply(reply);
		});
		
		robot.hear(/(combat next)/i, function(msg) {
			var callerName = msg.message.user.name;			
				
			var combat_started = robot.brain.get('combat_flag');
			var numRegisteredCombatants = robot.brain.get('numRegisteredCombatants');
			//array of players
			var combatantsArray = robot.brain.get('combatantsArray');
			var numTotalCombatants = robot.brain.get('numTotalCombatants');
			
			if(combat_started != 0 && combat_started != 1)
			{
				robot.logger.debug("Bad valuefor combat_started ["+combat_started+"]");
				robot.brain.set('combat_flag', 0);
				return msg.reply(">No combat started @"+callerName+". Begin with `/combat start`");
			}  
			else if(combat_started == 0)
			{
				return msg.reply(">No combat started @"+callerName+". Begin with `/combat start`");
			}
			else if(numRegisteredCombatants < numTotalCombatants)
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				var reply = ">Still waiting on "+stillNeeded+" combatants before starting."; 
				reply += "\n>Here is who has already rolled:";
				for(var k = 0; k < combatantsArray.length; k++)
				{
					var order = k + 1;
					reply += "\n>@" + combatantsArray[k].name + " the " + getRandomInsult() + "(initiative of " + combatantsArray[k].init + ")";
				}
				return msg.reply(reply);
				
			}
			var currentTurnIndex = robot.brain.get('currentTurnIndex');
			currentTurnIndex += 1;
			if(currentTurnIndex >= combatantsArray.length)
			{
				currentTurnIndex = 0;
			}
			robot.brain.set('currentTurnIndex',currentTurnIndex);
			
			var reply = ">Next turn started. @" +combatantsArray[currentTurnIndex].name+" is up!";

			return msg.reply(reply);
		});
		
		robot.respond(/test attachment/i, function(msg) {
			var callerName = msg.message.user.name;			
			
      var msgData = {
        channel: msg.message.room,
        /*text: "Test Attachments",*/
        attachments: [
          {
            fallback: "This is the fallback field text",
            pretext: "Combat command executed",
            color: "#cc3300",
            title: "This is a test title",
            title_link: "https://www.google.com",
            text: "https://a.fsdn.com/allura/p/kdicegen/icon You rolled *`20`*",
            /*image_url: "https://a.fsdn.com/allura/p/kdicegen/icon",*/
            mrkdwn_in: ["text"]
          }
        ]
      };
      robot.logger.debug("msgData formatted, now sending");
      robot.adapter.customMessage(msgData);
			robot.logger.debug("msgData sent, now returning");
			return;
		});
		
		
		//end function definitions
    };

})();
