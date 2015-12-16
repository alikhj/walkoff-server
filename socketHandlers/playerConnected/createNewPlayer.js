var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function createNewPlayer(socket, socketData) {
  var newPlayerObject = {
    id: socketData.playerID,
    alias: socketData.playerAlias,
    movementType: socketData.movementType,
    connected: true,
    lastUpdate: rethink.now(),
    sid: socket.id,
    games: []
  }

  r.db.table('players').insert(newPlayerObject).
  run(r.connection, function(err, response) {
    console.log(getTimeStamp() + socketData.playerID +
      ' does not exist, was added to players table: ' +
      '\n\t id: ' + socketData.playerID +
      '\n\t sid: ' + socket.id
    )
  })
}
