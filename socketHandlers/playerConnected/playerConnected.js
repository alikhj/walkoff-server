var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function playerConnected(socket, socketData) {

  var update = {
    sid: socket.id,
    connected: true
  }

  r.db.table('players').get(socketData.playerID).update(update).
  run(r.connection, function(err, response) {

    callback(response)
  })

  function callback(response) {

    if (response.skipped == 1) {

      var createNewPlayer =
      require('./createNewPlayer.js')(socket, socketData)
    }

    //if player already exists
    else {
      var updateExistingPlayer =
      require('./updateExistingPlayer.js')(socket, socketData)

    }
  }
}
