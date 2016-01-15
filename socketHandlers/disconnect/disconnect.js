var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function disconnect(socket) {
  r.db.table('players').filter({
    sid: socket.id
  }).update({ connected: false }, {returnChanges: true}).
  run(r.connection, function(err, response) {
    if (typeof response === 'undefined') {
      console.log(getTimeStamp() + 'disconnect response was undefined')
    }
    if (typeof response.changes === 'undefined') {
      console.log(getTimeStamp() + 'browser disconnected'); return
    }

    if (response.changes[0]) {
      var player = response.changes[0].new_val
      notifyGames(player)
    }
    else {
      //error handling if socket id doesn't exist
    }

  })

  function notifyGames(player) {
    var playerID = player.id
    var games = player.games

    console.log(getTimeStamp() + playerID + ' disconnected')

    for(var i = 0; i < games.length; i++) {
      var gameID = games[i]

      socket.to(gameID).emit('player-disconnected', {
        playerID: playerID,
        gameID: gameID
      })

      console.log(getTimeStamp() + playerID + ' was disconnected from ' + gameID)
    }
  }
}
