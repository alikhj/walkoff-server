var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function updateScore(socket, socketData) {
//create object with updated keys
  var update = {}
  update[socketData.playerID] = {
      score: socketData.newScore
    }
    //save update to db before emitting to other players
  r.db.table('games').get(socketData.gameID).update({
    lastUpdate: rethink.now(),
    playerData: update
  }).run(r.connection, function(err, response) {
    emitScore()
  })

  function emitScore() {
    socket.to(socketData.gameID).emit('score-updated', {
      gameID: socketData.gameID,
      newScore: socketData.newScore,
      playerID: socketData.playerID
    })
    console.log(getTimeStamp() + socketData.gameID +
      '\n\t update-score received from ' + socketData.playerID +
      '\n\t newScore: ' + socketData.newScore)
      updatePlayer()
  }

  function updatePlayer() {
    r.db.table('players').get(socketData.playerID).update({
      lastUpdate: rethink.now()
    }).run(r.connection, function(err, response){})
  }
}
