(function() {
    module.exports = function(robot) {
		
		
		robot.hear(function(msg) {

			robot.logger.debug("Bobby B heard: ["+msg+"]");
			
			return;
		});
	};
	
})();
