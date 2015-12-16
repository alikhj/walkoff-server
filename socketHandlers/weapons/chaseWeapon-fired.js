var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function chaseWeaponFired(io, socketData) {
  r.db.table('players').get(socketData.toPlayerID).pluck('sid').
  run(r.connection, function(err, response) {
    console.log(getTimeStamp() + 'offense fired on socketData.toPlayerID')

    io.sockets.connected[response.sid].emit('chaseWeapon-received', {
      gameID: socketData.gameID,
      itemType: socketData.itemType,
      rawValue: socketData.rawValue
    })

  })
}
