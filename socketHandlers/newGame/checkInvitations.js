var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function checkInvitations(socket, socketData) {
  r.db.table('players').get(socketData.playerID).getField('invitations').
  run(r.connection, function (err, invitations) {

    if (invitations && invitations.length > 0) {
      console.log('emitting new invitations')
      socket.emit('new-invitations', {
        invitations: invitations
      })

    } else {
      console.log('no invitations')
    }
  })
}
