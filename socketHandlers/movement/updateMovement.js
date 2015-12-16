var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function movementUpdated(socket, socketData) {

  var gameScores = socketData.gameScores
  r.db.table('players').get(socketData.playerID).update({
    movementType: socketData.movementType,
    lastUpdate: rethink.now()
  }).run(r.connection, function(err, response) {
    updateScores()
  })

  function updateScores() {
    for (var gameID in gameScores) {

      var playerData = {}
      playerData[socketData.playerID] = {
          score: gameScores[gameID]
      }

      var update = {
        playerData: playerData
      }

      r.db.table('games').get(gameID).update(update).
      run(r.connection, function(err, response) {
      }) //end r.db
    } //end for

    emitScores()
  } //end updateScores

  function emitScores() {

    for (var gameID in gameScores) {

      socket.to(gameID).emit('movement-updated', {
        gameID: gameID,
        playerID: socketData.playerID,
        newScore: gameScores[gameID],
        movementType: socketData.movementType
      })

      console.log(getTimeStamp() + gameID +
      '\n\t update-movement received from ' + socketData.playerID +
      '\n\t newScore: ' + gameScores[gameID])
    }
  }
}
