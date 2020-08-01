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
			try{
				robot.brain.set("keepalive","Last keepalive was: " + Date.now());
				var foo = robot.brain.get("keepalive");
				return res.status(200).send('Keep alive request succeeded!')
			}
			catch (err)
			{
				robot.logger.debug("Caught error: " + err.message);
				return res.status(500).send('Error -> ' + err.message);
			}
		});
		
	};
})();
