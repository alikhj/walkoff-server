var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../getTimeStamp'),
  dbActions = require('../dbActions')  

module.exports = function playerConnected(socket) {

  socket.on('player-connected', function(socketData) {
    //check if player exists, and update with new sid
    console.log(socketData + 'asdasda')
    var playerConnectedUpdate = {
      sid: socket.id,
      connected: true
    }

    dbActions.updateTable(
      'players', 
       socketData.playerID, 
       playerConnectedUpdate, 
       updatePlayerCallback
    )
    
    function updatePlayerCallback(response) {
      if (response.skipped == 1) {
        var createNewPlayer = 
        require('./createNewPlayer')(socket, socketData)
      } //if player already exists

      else {

        console.log(getTimeStamp() + socketData.playerID +
          ' updated with new sid in players table: ' +
          '\n\t sid: ' + socket.id
        )

        console.log(getTimeStamp() + socketData.playerID +
          ' checking for existing games... '
        )

        //check if player was in games before disr.connection
        r.db.table('players').get(socketData.playerID).getField('games').do(
        function(gameIDs) {
          return r.db.table('games').getAll(rethink.args(gameIDs)).coerceTo('array')

        }).run(r.connection, function(err, gameData) {
          var playerIDs = []

          //loop through game objects and join each game
          if (gameData && gameData.length > 0) {
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

            //only fire the code below if the player needs it
            //ie, if the app was reopened and gamesCount = 0
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
        })
      } 
    }
  })
}
