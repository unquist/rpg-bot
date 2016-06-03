module.exports = (robot) ->
    robot.respond /What is best in life?/i, (res) ->
      res.send "To crush your enemies, to see them driven before you, and to hear the lamentations of the women."
