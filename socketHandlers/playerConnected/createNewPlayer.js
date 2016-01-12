var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function createNewPlayer(socket, socketData) {
  var newPlayerObject = {
    id: socketData.playerID,
    alias: socketData.playerAlias,
    movementType: socketData.movementType,
    connected: false,
    lastUpdate: rethink.now(),
    sid: socketData.sid,
    games: [],
    invitations: []
  }

  if (socket) {
    newPlayerObject.sid = socket.id
    newPlayerObject.connected = true
  }

  if (socketData.invitationGameID) {
    newPlayerObject.invitations.push(socketData.invitationGameID)
  }

  r.db.table('players').insert(newPlayerObject).
  run(r.connection, function(err, response) {
    console.log(getTimeStamp() + socketData.playerID +
      ' does not exist, was added to players table: ' +
      '\n\t id: ' + socketData.playerID +
      '\n\t sid: '
    )
  })
}
