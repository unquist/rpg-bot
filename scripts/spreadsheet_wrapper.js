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

		var username_query = "A6:V6";
		
		var partyInfoSpreadsheetRedisKey = "partyinfo:";
		var intializedRedisKey = partyInfoSpreadsheetRedisKey + "initialized"
		
		//check and see if the spreadsheet has been initialized.
		/*
		if(!robot.brain.get(intializedRedisKey))
		{
			
			getSpreadsheetValues(partyInfoSpreadsheetId,username_query,function(err, data){
				if(err)
				{
					robot.logger.debug("Error initializing party spreadsheet info:"+err);
				}
				//var ""
			});
			
			robot.brain.set(intializedRedisKey,"true");
		}
		*/
		
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
				var result = "";
				robot.logger.debug("data:"+util.inspect(data));
				if(data.values)
				{
					for(var k = 0; k < data.values.length; k++)
					{
						
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
						
					}
				}
				else
				{
					result = "No values in <"+rangeParam+">";
				}
				return msg.reply(result);
				
			});
			
		});
		
		 
		
		var getSpreadsheetValues = function(spreadSheetId,range,callbackParam){
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
		};

		//Must be at the end
		module.exports.getSpreadsheetValues = getSpreadsheetValues;
};

})();