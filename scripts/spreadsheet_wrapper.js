// Description:
//   Inventory tracker
//
// Dependencies:
//   google-spreadsheet
//
// Configuration:
//   None
//
// Commands:
//   
// Author:
//   unquist

(function() {
    module.exports = function(robot) {

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
				callback: callbackParam
			});
		};

		//Must be at the end
		module.exports.getSpreadsheetValues = getSpreadsheetValues;
};

})();