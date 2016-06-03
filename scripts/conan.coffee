module.exports = (robot) ->
    robot.respond /What is best in life?/i, (res) ->
      res.send "To crush your enemies, to see them driven before you, and to hear the lamentations of the women."
      
    robot.respond /riddle of steel/i, (res) ->
      res.send "http://orig05.deviantart.net/fa98/f/2010/228/3/2/the_riddle_of_steel_by_urban_barbarian.jpg"
