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
		
		
		var insult_adj = new Array ("artless","bawdy","beslubbering","bootless","brazen",
		"churlish","cockered","clouted","craven","currish","dankish","dissembling",
		"distempered","droning","errant","fawning","fitful","fobbing","froward",
		"frothy","gleeking","gnarling","goatish","gorbellied","greasy","grizzled",
		"haughty","hideous","impertinent","infectious","jaded","jarring","knavish",
		"lewd","loggerheaded","lumpish","mammering","mangled","mewling","paunchy",
		"peevish","pernicious","prating","pribbling","puking","puny","purpled",
		"quailing","queasy","rank","reeky","roguish","roynish","ruttish","saucy",
		"sottish","spleeny","spongy","surly","tottering","unmuzzled","vacant","vain",
		"venomed","villainous","waggish","wanton","warped","wayward","weedy",
		"wenching","whoreson","yeasty", "base-court","bat-fowling","beef-witted","beetle-headed",
		"boil-brained","bunched-backed","clapper-clawed","clay-brained",
		"common-kissing","crook-pated","dismal-dreaming","dizzy-eyed",
		"dog-hearted","dread-bolted","earth-vexing","elf-skinned",
		"empty-hearted","evil-eyed","eye-offending","fat-kidneyed","fen-sucked",
		"flap-mouthed","fly-bitten","folly-fallen","fool-born","full-gorged",
		"guts-griping","half-faced","hasty-witted","heavy-handed","hedge-born",
		"hell-hated","horn-mad","idle-headed","ill-breeding","ill-composed",
		"ill-nurtured","iron-witted","knotty-pated","lean-witted","lily-livered",
		"mad-bread","milk-livered","motley-minded","muddy-mettled","onion-eyed",
		"pale-hearted","paper-faced","pinch-spotted","plume-plucked",
		"pottle-deep","pox-marked","raw-boned","reeling-ripe","rough-hewn",
		"rude-growing","rug-headed","rump-fed","shag-eared","shard-borne",
		"sheep-biting","shrill-gorged","spur-galled","sour-faced",
		"swag-bellied","tardy-gaited","tickle-brained","toad-spotted",
		"unchin-snouted","weak-hinged","weather-bitten","white-livered");

		var insult_nouns = new Array ("apple-john","baggage","barnacle","bladder","boar-pig","bugbear",
		"bum-bailey","canker-blossom","clack-dish","clotpole","coxcomb","codpiece",
		"crutch","cutpurse","death-token","dewberry","dogfish","egg-shell",
		"flap-dragon","flax-wench","flirt-gill","foot-licker","fustilarian","giglet",
		"gudgeon","gull-catcher","haggard","harpy","hedge-pig","hempseed",
		"hedge-pig","horn-beast","hugger-mugger","jack-a-nape","jolthead",
		"lewdster","lout","maggot-pie","malignancy","malkin","malt-worm","mammet",
		"manikin","measle","minimus","minnow","miscreant","moldwarp",
		"mumble-news","nut-hook","pantaloon","pigeon-egg","pignut","puttock",
		"pumpion","rabbit-sucker","rampallion","ratsbane","remnant","rudesby",
		"ruffian","scantling","scullion","scut","skainsmate","snipe","strumpet",
		"varlot","vassal","waterfly","whey-face","whipster","wagtail","younker");

		var getRandomInsult = function() {
			var result = "the ";
			var a = Math.floor(Math.random()*insult_adj.length);
			var b = Math.floor(Math.random()*insult_nouns.length);
	    
			result += insult_adj[a] + " " + insult_nouns[b];
			return result;
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
			   return "@"+callerName+" started combat with " + numCombatants + " belligerents. Everyone roll for initiative!";
			   
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
  				return "@" + callerName+" already rolled initiative `"+robot.brain.get(callerName+"_initScore")+"`. No backsies. You can use `combat setinit [init]` to manually fix your initiative up until the start of combat.";
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
  				var reply = "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+"`.";
  				reply += "\nAll Combatants accounted for.";
  				reply += "\nHere is the combat order:";
  				
  				combatantsArray = combatantsArray.sort(combatantSortByInit);
  				robot.brain.set('combatantsArray',combatantsArray);
  				robot.brain.set('currentTurnIndex',0);
  				for(var k = 0; k < combatantsArray.length; k++)
  				{
  					var order = k + 1;
  					reply += "\n("+order+") @" + combatantsArray[k].name;
  				}
  				reply += "\n*Let the bloodletting begin!*";
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
				return "That's too many monsters for this combat @"+callerName+". I already have " +numRegisteredCombatants+ " fighter(s), out of " +numTotalCombatants+" total spots.";
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
						reply += "\n("+order+") _@" + combatantsArray[k].name + "_";
						firstPlayerName = combatantsArray[k].name;
					}
					else
					{
						reply += "\n("+order+") @" + combatantsArray[k].name;
					}
				}
				reply += "\n*@" + firstPlayerName + ", you're up first!*";
				return reply; 
			}
			else
			{
				var stillNeeded = numTotalCombatants - numRegisteredCombatants;
				return "@" + callerName+" rolled `" + initRoll +"` with a bonus of `" + bonus+"` for a total initative score of `"+initScore+" for " + numMonsters + " " + monsterName + ".\nStill waiting on "+stillNeeded+" combatants."; 
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
					reply += "\n@" + combatantsArray[k].name + " rolled `" +combatantsArray[k].init+"`.";
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
					reply += "\n("+order+") *_@" + combatantsArray[k].name + "_*";
				}
				else
				{
					reply += "\n("+order+") @" + combatantsArray[k].name;
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
					reply += "\n@" + combatantsArray[k].name + " (initiative of " + combatantsArray[k].init + ")";
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
			
			var reply = "Next turn started. @" +combatantsArray[currentTurnIndex].name+" is up!";
      return reply;
		};
	  
	  /* begin 'hear' functions*/
	  robot.hear(/(combat clearall)/i, function(msg) {
			var callerName = msg.message.user.name;			
			clearAll();
			return msg.reply("@"+callerName+" cleared all current combat data.");
		});
		
		robot.hear(/(combat next)/i, function(msg) {
			var callerName = msg.message.user.name;			
			var reply = combatNext(callerName);
			
			return msg.reply(reply);
		});
		
		robot.hear(/(combat end)/i, function(msg) {
			var callerName = msg.message.user.name;
			var reply = combatEnd(callerName);
			return msg.reply(reply);
		});
		
		robot.hear(/(combat start )(\d+)/i, function(msg) {
			var callerName = msg.message.user.name;
			var numCombatants = msg.match[2] || -1;
			var reply = combatStart(callerName,numCombatants);
			return msg.reply(reply);
		});
		
		robot.hear(/combat start$/i, function(msg) {
            var callerName = msg.message.user.name;
			var reply = "Need at least two to tango @"+callerName+"! Usage `combat start [num participants]` where [num participants] is 2 or more.\n";
			return msg.reply(reply);
	
        });
		
		robot.hear(/combat init(\s){0,1}(\d+){0,1}$/i, function(msg) {
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			bonus = Number(bonus);
		
			var reply = combatInit(callerName,bonus);
			return msg.reply(reply);
		});
		
		robot.hear(/combat initdm(\s){0,1}(\d+){0,1}(\s){0,1}(\d+){0,1}(\s){0,1}([a-z]*){0,1}$/i, function(msg) {
			var callerName = msg.message.user.name;
			var bonus = msg.match[2] || 0;
			
			var numMonsters = Number(msg.match[4]) || 1;
			var monsterName = msg.match[6] || "Nameless Monster";
						
			var reply = initdm(callerName,bonus,numMonsters,monsterName);
			return msg.reply(reply);
		});
		
		robot.hear(/(combat setinit (\d+))/i, function(msg) {
			var callerName = msg.message.user.name;		
			var init = msg.match[2] || 0;
			init = Number(init);
			
			var reply = combatSetInit(callerName,init);
			 
			return msg.reply(reply);
		});
		
		robot.hear(/(combat status)/i, function(msg) {
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
			robot.logger.debug("Received a POST request to /hubot/roll");
			  
			var data, channel_name, response_url, command, subcommand, text, token,username;
				   
			data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
			//robot.logger.debug("data:"+util.inspect(data));
			command = data.command;
		   
			token = data.token;
			username = data.user_name;
			channel_name = data.channel_name;
			text = data.text;
			var match = text.match(/([a-z]+)(\s*)(.*)/i);
			  
			if(match != null)
			{
				var subcommand = match[1] || "invalid";
				var parameters = match[2] || null;

				switch(subcommand)
				{
					case "clearall":
						break;
					case "next":
						break;
					case "end":
						break;
					case "start":
						break;
					case "init":
						break;
					case "initdm":
						break;
					case "setinit":
						break;
					case "status":
						break;
					case "help":
						var reply = "/combat tracks your combat status. The following are the commands (in roughly the same order you need to use them in). Bracketed text below are the paramters you need to replace with your own values:";
						reply += "\n\n*_/combat start [NUM COMBATANTS]_* - Start tracking a combat. You need to specify _NUM COMBATANTS_ to set how many combatants are in the fight.";
						reply += "\n\n*_/combat init [BONUS]_* - Each PC needs to run this to roll for initiative. BONUS is your Dex. bonus. Once the correct number of player and monsters have rolled, combat will automatically start.";
						reply += "\n\n*_/combat initdm [BONUS] [NUM MONSTERS] [MONSTER NAME]_* - The DM can run this to quickly add monsters of a single type to a combat.";
						reply += "\n\n*_/combat setinit [INIT]_* - Optional commabnd. Manually set your initiative. Useful if you rolled but forgot to put in the right Dex. bonus.";
						reply += "\n\n*_/combat next_* - Signal to the bot that the current player's turn is over (and it's time for the next player).";
						reply += "\n\n*_/combat status_* - Broadcasts the current order and indicates whomever's turn it is.";
						reply += "\n\n*_/combat end_* - End the combat. You won't be able to start a new combat until you end the old one.";
						reply += "\n\n*_/combat help_* - Prints this message.";
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
						break;
					default:
						var reply = "I don't know how to _" + subcommand + "_! Use _/combat help_ for an explanation of each command.";
						var msgData = getFormattedJSONAttachment(reply,channel_name,false);
						return res.json(msgData);
				}
			}
			else
			{
				var reply = "Missing a command! Use _/combat help_ for an explanation of each command.";
				var msgData = getFormattedJSONAttachment(reply,channel_name,false);
				return res.json(msgData);
			}
		});
		
		//end function definitions
    };

})();
