var rethink = require('rethinkdb'),
  dbActions = require('../dbActions')
  getTimeStamp = require('../../getTimeStamp')

module.exports = function createNewPlayerObject(socket, socketData) {
    var newPlayerObject = {
      id: socketData.playerID,
      alias: socketData.playerAlias,
      connected: true,
      lastUpdate: rethink.now(),
      sid: socket.id,
      games: []
    }

    dbActions.insertObject(
      'players',
      newPlayerObject,
      insertNewPlayerCallback
    )

    function insertNewPlayerCallback(response) {
      console.log(getTimeStamp() + socketData.playerID +
      ' does not exist, was added to players table: ' +
      '\n\t id: ' + socketData.playerID +
      '\n\t sid: ' + socket.id
      )
  }
}
