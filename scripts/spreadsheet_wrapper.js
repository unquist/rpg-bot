// Description:
//   Party Info Google Spreadsheet wrapper
//
// Dependencies:
//   google-spreadsheet
//
// Configuration:
//   None
//
// Commands:
//   hubot google-sheet [RANGE] -  required command to authenticate access to your Google spreadsheets
// Author:
//   unquist

(function() {
    module.exports = function(robot) {

		var google = require("googleapis");
		var util = require("util");

		var partyInfoSpreadsheetId = process.env.PARTY_INFO_SPREADSHEET_ID || "<NOT SET>"; 

		var username_query = "A7:V7";
		
		var partyInfoSpreadsheetRedisKey = "partyinfo:";
		var intializedRedisKey = partyInfoSpreadsheetRedisKey + "initialized"
		
		var getSpreadsheetValues = function(spreadSheetId,range,callbackParam){
			
			if(!robot.brain.get(intializedRedisKey))
			{
				var userObjectFromRobot = robot.brain.users();
				
				//first, get a list of all user names
				var userArray = new Array();
				
				for (var key in userObjectFromRobot) 
				{
					var user_name = userObjectFromRobot[key].name;
					userArray.push(user_name);
					robot.logger.debug("initializing party spreadsheet info; username = "+user_name);
				}

				/*
				getSpreadsheetValues(partyInfoSpreadsheetId,username_query,function(err, data){
					
					if(err)
					{
						robot.logger.debug("Error initializing party spreadsheet info:"+err);
					}
					// [ Slack User ][ cheesesandwich ][  ][  ][ Slack User ][ gatsbythegreat ][  ][  ][ Slack User ][ mandrews ][  ][  ][ Slack User ][ seussalot ][  ][  ][ Slack User ][ hamishthaggis ][  ][  ][ Slack User ][ moresault ]
					for(var k = 0; k < data.values.length; k++)
					{
						
						
					}
					
				});
				*/
				
				var serviceClient = google['sheets']("v4");
				robot.emit("googleapi:request", {
					service: "sheets",
					version: "v4",
					endpoint: "spreadsheets.values.get",
					params: {
						spreadsheetId: partyInfoSpreadsheetId,
						range: username_query
					},
					callback: function(err, data) {
						if (err) {
							robot.logger.debug("getSpreadsheetValues error:"+err);
							return err;
						}
						robot.logger.debug("within first callback.");
						robot.logger.debug("data returned:"+util.inspect(data));
						// [ Slack User ][ cheesesandwich ][  ][  ][ Slack User ][ gatsbythegreat ][  ][  ][ Slack User ][ mandrews ][  ][  ][ Slack User ][ seussalot ][  ][  ][ Slack User ][ hamishthaggis ][  ][  ][ Slack User ][ moresault ]
						for(var k = 0; k < data.values[0].length; k++)
						{
							if(data.values[0][k] != "" && data.values[0][k].indexOf("Slack User") == -1)
							{
								robot.logger.debug("inner results loop -> data.values[k] =["+data.values[0][k]+"]");
								var indexOfUser = userArray.findIndex(function(name){return name == data.values[0][k]});
								var cellLetter = String.fromCharCode(index + 65 + 1);
								robot.logger.debug("code->robot.brain.set(partyInfoSpreadsheetRedisKey+data.values[0][k],cellLetter);");
								robot.logger.debug("interpreted->robot.brain.set("+partyInfoSpreadsheetRedisKey+data.values[0][k]+","+cellLetter+");");
							}
							
						}
						//robot.brain.set(intializedRedisKey,"true");
						robot.logger.debug("robot.brain.set(intializedRedisKey,'true');");
						
						
						//now the code should be initialized and we need to call the original call back command
						var serviceClient = google['sheets']("v4");
						robot.emit("googleapi:request", {
							service: "sheets",
							version: "v4",
							endpoint: "spreadsheets.values.get",
							params: {
								spreadsheetId: spreadSheetId,
								range: range
							},
							callback: callbackParam
						});
					}
				});
			}
			else
			{
				var serviceClient = google['sheets']("v4");
				robot.emit("googleapi:request", {
					service: "sheets",
					version: "v4",
					endpoint: "spreadsheets.values.get",
					params: {
						spreadsheetId: spreadSheetId,
						range: range
					},
					/*
					callback: function(err, data) {
						if (err) {
							robot.logger.debug("getSpreadsheetValues error:"+err);
							return err;
						}

						return data;
					}*/
					callback: callbackParam
				});
			}
		};
					
		
		robot.respond(/google-sheet (\S+)$/, function(msg) 
		{
			if(partyInfoSpreadsheetId == "<NOT SET>")
			{
				return msg.reply("The PARTY_INFO_SPREADSHEET_ID environment variable has not been set.")
			}
			var rangeParam = msg.match[1] || "NA";
			
			if(rangeParam == "NA")
			{
				return msg.reply("Need to specifiy a valid range to query. Example `A1:A5`.");
			}
			
			getSpreadsheetValues(partyInfoSpreadsheetId,rangeParam,function(err, data){
				if (err) {
					return msg.reply("getSpreadsheetValues error in google-sheet call:"+err);
				}
				var result = "\n";
				robot.logger.debug("data:"+util.inspect(data));
				if(data.values)
				{
					for(var k = 0; k < data.values.length; k++)
					{
						/*
						if(data.values[k].length > 0)
						{
							for(var i = 0; i < data.values[k].length; i++)
							{
								result += "["+k+"]["+i+"] " + data.values[k][i] + "\n";
							}
						}
						else
						{
							result += "["+k+"] "+data.values[k]+"\n";
						}
						*/
						for(var i = 0; i < data.values[k].length; i++)
						{
								result += "[ " + data.values[k][i] + " ]";
						}
						result += "\n";
					}
				}
				else
				{
					result = "No values in <"+rangeParam+">";
				}
				return msg.reply(result);
				
			});
			
		});


		//Must be at the end
		module.exports.getSpreadsheetValues = getSpreadsheetValues;
};

})();