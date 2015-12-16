var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function newGame(socket, socketData) {
  console.log(getTimeStamp() + 'join-game received from ' + socketData.playerID)
	//use tmpGameIDKey as a temporary ID to group all players
	var tmpGameIDKey = socketData.playerIDs.join('')
	var playerID = socketData.playerID
  var playerDataUpdate = {}

  playerDataUpdate[playerID] = {
    score: 0,
    inGame: true
    //add key-values as needed
  }
	//filter the games table for a game object with tmpGameIDKey
	r.db.table('games').filter({
		tmpGameID: tmpGameIDKey
	}).update({
    playerData: playerDataUpdate,
    playerIDs: rethink.row('playerIDs').append(playerID)
  }, {returnChanges: true}).run(r.connection, function(err, response) {
    if (response) {

      if (response.changes) {
        var game = response.changes[0].new_val
        addPlayer(game)
        return
      }
      else {
        console.log(getTimeStamp() + 'tmpGameIDKey is:' +
         '\n\t ' + tmpGameIDKey +
         '\n\t no game with this tmpGameIDKey exists, creating game...'
        )
        var createGame = require('./createGame')(socket, socketData, tmpGameIDKey)
        return
      }
    }
    else {
      console.log('response was undefined')
    }
	})

  function addPlayer(game) {
    var connectedPlayerCount = game.playerIDs.length
    var expectedCount = game.playerCount
    var gameID = game.id
    socket.join(gameID)

    console.log(getTimeStamp() + gameID +
      '\n\t ' + playerID + ' joined the game'
    )
      if (expectedCount == connectedPlayerCount) {
        console.log(getTimeStamp() + gameID +
          '\n\t ' + playerID +
          ' is the last to join this game, the game is starting...'
        )
        var startGame = require('./startGame')(socket, socketData, game)
      }
  }
}
