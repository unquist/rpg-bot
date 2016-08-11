// Description:
//   google authentication
//
// Dependencies:
//   googleapis
//
// Configuration:
//   None
//
// Commands:
//	 
// Author:
//   unquist

var AUTH_PATH, BRAIN_KEY, GOOGLE_API_CLIENT_ID, GOOGLE_API_CLIENT_SECRET, GOOGLE_API_SCOPES, HEROKU_URL, HUBOT_URL, OAuth2, SAFETY_MARGIN, client, google, ref, updateCredential;

var util = require("util");

google = require("googleapis");

OAuth2 = google.auth.OAuth2;

ref = process.env, HUBOT_URL = ref.HUBOT_URL, HEROKU_URL = ref.HEROKU_URL, GOOGLE_API_CLIENT_ID = ref.GOOGLE_API_CLIENT_ID, GOOGLE_API_CLIENT_SECRET = ref.GOOGLE_API_CLIENT_SECRET, GOOGLE_API_SCOPES = ref.GOOGLE_API_SCOPES;

HUBOT_URL = HUBOT_URL || HEROKU_URL || ("http://" + (require("os").hostname()));

if (HUBOT_URL[HUBOT_URL.length - 1] === "/") {
	HUBOT_URL = HUBOT_URL.slice(0, -1);
}

AUTH_PATH = "/auth/googleapi";

BRAIN_KEY = "googleapi:credential";

SAFETY_MARGIN = 5 * 60 * 1000;

client = new OAuth2(GOOGLE_API_CLIENT_ID, GOOGLE_API_CLIENT_SECRET, "" + HUBOT_URL + AUTH_PATH + "/callback");

google.options({
auth: client
});

updateCredential = function(robot, callback) {
	var credential;
	credential = robot.brain.get(BRAIN_KEY);
	if (!credential) {
		return callback(new Error("Needs authorization. Authorize at " + HUBOT_URL + AUTH_PATH));
	}
	client.setCredentials(credential);
	if (Date.now() > credential.expiry_date - SAFETY_MARGIN) {
		return client.refreshAccessToken(function(err, credential) {
			if (err) {
				return callback(err);
			}
			robot.brain.set(BRAIN_KEY, credential);
			return callback(null);
		});
	} else {
		return callback(null);
	}
};

module.exports = function(robot) {
	robot.respond(/googleapi auth(orize)?$/, function(msg) {
		return msg.send("Authorize at " + HUBOT_URL + AUTH_PATH);
	});
	
	
	robot.router.get(AUTH_PATH, function(req, res) {
		return res.redirect(client.generateAuthUrl({
			access_type: "offline",
			approval_prompt: "force",
			scope: GOOGLE_API_SCOPES.split(",").map(function(e) {
				return "https://www.googleapis.com/auth/" + (e.trim());
			})
		}));
	});
	robot.router.get(AUTH_PATH + "/callback", function(req, res) {
		return client.getToken(req.query.code, function(err, credential) {
			if (err) {
				return res.send(err.message);
			}
			robot.brain.set(BRAIN_KEY, credential);
			return res.send("Authorization has succeeded!");
		});
	});
	return robot.on("googleapi:request", function(arg) {
		var callback, endpoint, params, service, version;
		service = arg.service, version = arg.version, endpoint = arg.endpoint, params = arg.params, callback = arg.callback;
		if (version[0] !== "v") {
			version = "v" + version;
		}
		return updateCredential(robot, function(err) {
			var serviceClient;
			if (err) {
				return callback(err);
			}
			serviceClient = google[service](version);
			
			var endpointSplit = endpoint.split(".");
			//robot.logger.debug("endpointSplit="+endpointSplit);
			return endpointSplit.reduce((function(a, e) {
				//robot.logger.debug("a=["+a+"], e=["+e+"]");
				return a[e];
			}), serviceClient)(params, callback);
		});
	});
};