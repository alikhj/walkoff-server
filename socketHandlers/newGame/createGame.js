var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function createGame(socket, socketData, tmpGameIDKey) {
  var playerID = socketData.playerID
  var gameID = socketData.gameID
  var newGame = {
    tmpGameID: tmpGameIDKey,
    playerCount: socketData.playerCount,
    playerData: {},
    playerIDs: [playerID]
  }
  //insert player data object into newGameUpdate
  newGame.playerData[playerID] = {
    score: 0,
    status: '🏁'
    //add other key-values as needed
  }
  //update the games table
  r.db.table('games').insert(newGame).
  run(r.connection, function(err, response) {
    console.log(getTimeStamp() + response.generated_keys +
      '\n\t new game created'
    )
    //initialize the rethink id as the gameID
    gameID = response.generated_keys
    //create the room by joining it
    socket.join(gameID)
    console.log(getTimeStamp() + gameID +
      '\n\t ' + playerID + ' is the first to join this game'
    )
  })
}
