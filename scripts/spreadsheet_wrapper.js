var google = require("googleapis");
var util = require("util");

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
		callback: callbackParam(err,data)
	});
};








//Must be at the end
module.exports.getSpreadsheetValues = getSpreadsheetValues;