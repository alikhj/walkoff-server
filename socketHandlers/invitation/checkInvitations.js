var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function checkInvitations(socket, socketData) {
  var playerID = socketData.playerID
  // var lastInvitationIDClient = socketData.lastInvitationID

  r.db.table('players').get(playerID).getField('invitations').
  run(r.connection, function(err, invitations) {

    if (invitations.length > 0) {
      socket.emit('invitations', {
        invitations: invitations
      })
    }
  })
}
