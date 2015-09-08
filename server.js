var express = require('express'),
  httpServer = require('http'),
  path = require('path'),
  app = express(),
  rethink = require('rethinkdb'),
  server = httpServer.createServer(app),
  io = require('socket.io').listen(server),
  crypto = require('crypto'),
  uuid = require('uuid'),
  tmpGameIDs = {},
  games = {}

httpServer.globalAgent.maxSockets = 1000

app.route('/').get(function(req, res) {
  console.log(getTimeStamp() + 'server accessed through browser');
  res.sendFile(path.join(__dirname, './views/index.html'))
})

var r = require('./setupDatabase')

io.on('connection', function(socket) {
  console.log(getTimeStamp() + socket.id + ' connected')

  socket.on('player-connected', function(socketData) {
    //check if player exists, and update with new sid
    r.db.table('players').get(socketData.playerID).update({
      sid: socket.id,
      connected: true
    }).run(r.connection, function(err, response) {
      //if player does not exist
      if (response.skipped == 1) {
        r.db.table('players').insert({
          id: socketData.playerID,
          alias: socketData.playerAlias,
          connected: true,
          lastUpdate: rethink.now(),
          sid: socket.id,
          games: []
        }).run(r.connection, function(err, response) {
          console.log(getTimeStamp() + socketData.playerID +
            ' does not exist, was added to players table:' +
            '\n\t id: ' + socketData.playerID + '\n\t sid: ' +socket.id
          )
        })
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
                '\n\t client has no local gameData, emitting...'
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
            console.log(getTimeStamp() + socketData.playerID + ' no existing games to join')
          }
        })
      }
    })
  })

  socket.on('disconnect', function() {
  //find the player object in the players table with this socket id
    r.db.table('players').filter({
      sid: socket.id
    }).coerceTo('array').run(r.connection, function(err, playerArray) {
      if (playerArray.length > 0) {
        var player = playerArray[0]
        var playerID = player.id
        var games = player.games
        r.db.table('players').get(playerID).update({
          connected: false
        }).run(r.connection, function(err, response) {
          console.log(getTimeStamp() + playerID + ' disconnected')
          //loop through player games and emit disr.connection notice
          for (var i = 0; i < games.length; i++) {
            var gameID = games[i]
            console.log(getTimeStamp() + playerID + ' was disconnected from ' + gameID)
            socket.to(gameID).emit('player-disconnected', {
              playerID: playerID,
              gameID: gameID
            })
          }
        })
      }
    })
  })

  socket.on('create-game', function(socketData) {
    console.log(getTimeStamp() + 'join-game received from ' + socketData.playerID)
    //use tmpGameIDKey as a temporary ID to group all players
    var tmpGameIDKey = socketData.playerIDs.join('')
    var playerID = socketData.playerID
    var gameID
    //filter the games table for a game object with tmpGameIDKey
    r.db.table('games').filter({
      tmpGameID: tmpGameIDKey
    }).coerceTo('array').run(r.connection, function(err, newGameArray) {
      //if the game object doesn't exist, create it when the first player
      //connects to the server with a tmpGameIDKey
      if (newGameArray.length == 0) {
        console.log(getTimeStamp() + 'tmpGameIDKey is:' +
	       '\n\t ' + tmpGameIDKey +
         '\n\t no game with this tmpGameIDKey exists, creating game...'
        )
        var newGameUpdate = {
          tmpGameID: tmpGameIDKey,
          playerCount: socketData.count,
          playerData: {},
          playerIDs: [playerID]
        }
        //insert player data object into newGameUpdate
        newGameUpdate.playerData[playerID] = {
          score: 0
          //add other key-values as needed
        }
        //update the games table
        r.db.table('games').insert(newGameUpdate).
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
      } //if the game object already exists
      else {
        var newGame = newGameArray[0]
        //initialize gameID from the game data pulled from the db
        gameID = newGame.id
        socket.join(gameID)
        //connectedPlayerCount includes this socket (+1)
        var connectedPlayerCount = newGame.playerIDs.length + 1
        //create playerDataUpdate object to update games table
        var playerDataUpdate = {}
        playerDataUpdate[playerID] = {
          score: 0
          //add key-values as needed
        }
        //if the last player is joining
        if (connectedPlayerCount == newGame.playerCount) {
          //update the game object with player info and game details
          r.db.table('games').get(gameID).update({
            gameStarted: rethink.now(),
            lastUpdate: rethink.now(),
            //clear the tmpGameID
            tmpGameID: '',
            playerData: playerDataUpdate,
            playerIDs: rethink.row('playerIDs').append(playerID)
            //return data that includes the initialized game
          },{ returnChanges: true }).run(r.connection, function(err, gameChanges) {
            //add the gameID to each player object in the players table
            r.db.table('players').getAll(rethink.args(socketData.playerIDs)).update({
              games: rethink.row('games').append(gameID)
            }).run(r.connection, function(err, playerChanges) {
              //get alias-ID pairs from players table
              r.db.table('players').getAll(rethink.args(socketData.playerIDs)).
              pluck('alias', 'id').coerceTo('array').
              run(r.connection, function(err, playerData){
                var gameData = gameChanges.changes[0].new_val
                console.log(getTimeStamp() + gameID +
                  '\n\t ' + playerID +
                  ' is the last to join this game, the game is starting...'
                )

                socket.to(gameID).emit('game-started', {
                  gameData: gameData,
                  playerData: playerData
                })

                socket.emit('game-started', {
                  gameData: gameData,
                  playerData: playerData
                })

              })
            })
          })
        } //if the player is not the first or the last
        else {
          //add player information to the games object
          r.db.table('games').get(gameID).update({
            playerData: playerDataUpdate,
            playerIDs: rethink.row('playerIDs').append(playerID)
          }).run(r.connection, function(err, response) {
            console.log(getTimeStamp() + gameID +
              '\n\t ' + playerID + ' joined this game'
            )
          })
        }
      }
    })
  })

  socket.on('update-score', function(data) {
    //create object with updated keys
    var update = {}
    update[data.playerID] = {
        score: data.newScore
      }
      //save update to db before emitting to other players
    r.db.table('games').get(data.gameID).update({
      lastUpdate: rethink.now(),
      playerData: update
    }).run(r.connection, function(err, response) {
      socket.to(data.gameID).emit('score-updated', {
        gameID: data.gameID,
        newScore: data.newScore,
        playerID: data.playerID
      })
      console.log(getTimeStamp() + data.gameID +
        '\n\t update-score received from ' + data.playerID +
        '\n\t newScore: ' + data.newScore)
    })
  })

  socket.on('get-player-id', function() {
    socket.emit('player-id', { playerID: socket.playerID })
  })

//close io.on...
})

server.listen(2000)
console.info(getTimeStamp() +
' r.db-server started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return '\n' + reformat(date.getHours()) + ':' + reformat(date.getMinutes()) + ':' +
    reformat(date.getSeconds()) + ' '

  function reformat(number) {
    if (number < 10) {
      var reformattedNumber = '0' + number
      return reformattedNumber
    }
    else { return number }
  }
}

