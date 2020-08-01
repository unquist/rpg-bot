// Description:
//   keep alive the redis and hubot instance
//
// Dependencies:
//   None
//
// Configuration:
//
// Commands:
//	 None
//
// Author:
//   unquist

(function() {
		
	module.exports = function(robot) {
		robot.router.post('/hubot/keepalive', function(req, res) {
			robot.logger.debug("Received a POST request to /hubot/keepalive");
			robot.brain.set("keepalive","Last keepalive was: " + Date.now());
		});
		
	};
})();
