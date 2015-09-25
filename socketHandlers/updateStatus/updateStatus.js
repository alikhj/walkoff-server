var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function updateStatus(socket, socketData) {
//create object with updated keys
  var update = {}
  update[socketData.playerID] = {
      status: socketData.newStatus,
    }
  //save update to db before emitting to other players
  r.db.table('games').get(socketData.gameID).update({
    lastUpdate: rethink.now(),
    playerData: update
  }).run(r.connection, function(err, response) {
    emitStatus()
  })

  function emitStatus() {
    socket.to(socketData.gameID).emit('status-updated', {
      gameID: socketData.gameID,
      newStatus: socketData.newStatus,
      playerID: socketData.playerID
    })
    console.log(getTimeStamp() + socketData.gameID +
      '\n\t update-status received from ' + socketData.playerID +
      '\n\t newStatus: ' + socketData.newStatus)
      updatePlayer()
  }

  function updatePlayer() {
    r.db.table('players').get(socketData.playerID).update({
      lastUpdate: rethink.now()
    }).run(r.connection, function(err, response){})
  }
}
