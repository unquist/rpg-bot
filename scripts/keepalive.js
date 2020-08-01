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
			robot.brain.set("keepalive","Last keepalive was: " + Date.now());
		});
		
	};
})();
