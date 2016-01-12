var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function weaponFired(io, socketData) {
  r.db.table('players').get(socketData.toPlayerID).pluck('sid').
  run(r.connection, function(err, response) {

    io.sockets.connected[response.sid].emit('weapon-received', {
      gameID: socketData.gameID,
      itemType: socketData.itemType,
      rawValue: socketData.rawValue
    })

  })
}
