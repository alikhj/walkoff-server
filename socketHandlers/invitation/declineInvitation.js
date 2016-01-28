var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function declineInvitation(socket, socketData) {

  var playerID = socketData.playerID
  var invitationIndex = socketData.invitationIndex

  var update = {
    invitations: rethink.row('invitations').deleteAt(invitationIndex),
  }

  r.db.table('players').get(playerID).update(update).
  run(r.connection, function(err, response) {
    
  })
}
