var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function checkInvitations(socket, socketData) {
  var playerID = socketData.playerID

  r.db.table('players').get(playerID).getField('invitations').
  run(r.connection, function(err, invitations) {

    if ((invitations != null) && (invitations.length > 0)) {
      console.log("emitting invitations")
      socket.emit('invitations', {
        invitations: invitations
      })
    }
  })
}
