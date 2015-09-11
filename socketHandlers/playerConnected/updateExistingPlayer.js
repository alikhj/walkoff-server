var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function updateExistingPlayer(socket, socketData) {

  console.log(getTimeStamp() + socketData.playerID +
    ' updated with new sid in players table: ' +
    '\n\t sid: ' + socket.id
  )

  console.log(getTimeStamp() + socketData.playerID +
    ' checking for existing games... '
  )

  //pull player's gameData
  r.db.table('players').get(socketData.playerID).getField('games').do(
  function(gameIDs) {
    return r.db.table('games').getAll(rethink.args(gameIDs)).coerceTo('array')

  }).run(r.connection, function(err, gameData) {
    updatePlayer(gameData)
  })

  var playerIDs = []

  function updatePlayer(gameData) {
    //loop through game objects and join each game
    if (gameData && gameData.length > 0) {

      joinGames(gameData)

      if (socketData.clientGamesCount == 0) {

        console.log(getTimeStamp() + socketData.playerID +
          '\n\t client has no local gameData, emitting gameData from server...'
        )

        r.db.table('players').getAll(rethink.args(playerIDs)).
        pluck('id', 'alias').distinct().
        run(r.connection, function(err, playerData) {
          //emit games and players data to the player
          socket.emit('all-data', {
            gameData: gameData,
            playerData: playerData
          })

        })
      }

    } //end if

    else {
      console.log(getTimeStamp() + socketData.playerID +
      ' no existing games to join')
    }
  }

  function joinGames(gameData) {
    for (var i = 0; i < gameData.length; i++) {
      var game = gameData[i]
      var gameID = game.id

      console.log(getTimeStamp() + socketData.playerID +
        '\n\t rejoining game: ' + '\n\t ' + gameID
      )

      socket.join(gameID)
      //tell players in games that player has reconnected
      socket.to(gameID).emit('player-reconnected', {
        playerID: socketData.playerID,
        gameID: gameID
      })
      playerIDs = playerIDs.concat(game.playerIDs)

    } //end for
  }
}
