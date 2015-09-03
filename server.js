var express = require('express'),
  httpServer = require('http'),
  rethink = require('rethinkdb'),
  path = require('path'),
  app = express(),
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
var connection
var walkoff
rethink.connect({
  host: 'localhost',
  port: 28015,
}, function(err, conn) {
  if (err) {
    throw new Error(getTimeStamp() + 'cannot connect to rethinkdb: ', err)
  }
  connection = conn
  createDatabase()
})

function createDatabase() {
  rethink.dbList().run(connection, function(err, dbs) {
    if (err) {
      throw new Error(getTimeStamp() + 'error getting the list of databases: ', err)
    }
    if (dbs.indexOf('walkoff') === -1) {
      rethink.dbCreate('walkoff').run(connection, function(err, response) {
        console.log('created walkoff database')
      })
    }
    walkoff = rethink.db('walkoff')
    createTables()
  })
}

function createTables() {
  walkoff.tableList().run(connection, function(err, tables) {
    if (err) {
      throw new Error(getTimeStamp() + 'error getting the list of databases: ', err)
    }
    createTableWithName('games')
    createTableWithName('players')

    function createTableWithName(tableName) {
      if (tables.indexOf(tableName) === -1) {
        walkoff.tableCreate(tableName).run(connection, function(err,
          response) {
          if (err) {
            throw new Error(getTimeStamp() + 'error creating table with name: ' +
              tableName)
          }
          console.log('table created with name: ' + tableName)
        })
      }
    }
  })
}

io.on('connection', function(socket) {
  console.log(getTimeStamp() + socket.id + ' connected')
  socket.games = []
  socket.on('player-connected', function(data) {
    //check if player exists, and update with new sid
    walkoff.table('players').get(data.playerID).update({
      sid: socket.id,
      connected: true
    }).run(connection, function(err, response) {
      //if player does not exist
      if (response.skipped == 1) {
        walkoff.table('players').insert({
            id: data.playerID,
	    connected: true,
            sid: socket.id,
            games: []
          }).run(connection, function(err, response) {
            console.log(getTimeStamp() + data.playerID +
              ' does not exist, was added to players table:' +
              '\n\t id: ' + data.playerID + '\n\t sid: ' +
              socket.id)
          })
      //if player already exists
      }
      else {
        console.log(getTimeStamp() + data.playerID +
            ' updated with new sid in players table: ' +
            '\n\t sid: ' + socket.id)
        console.log(getTimeStamp() + data.playerID +
            ' checking for existing games... ')
        //check if player was in games before disconnection
        walkoff.table('players').get(data.playerID).getField('games').do(
        function(existingGames) {
	  //set connected to true in all games
          //pull gameIDs from player object and use them to getAll game objects
          //return game objects in an array
          return walkoff.table('games').getAll(rethink.args(existingGames)).
          coerceTo('array')
        }).
        run(connection, function(err, existingGames) {
          //loop through game objects and join each game
          if (existingGames) {
            for (var i = 0; i < existingGames.length; i++) {
              var gameID = existingGames[i].id
              console.log(getTimeStamp() + data.playerID +
                '\n\t rejoining game: ' + '\n\t ' + gameID)
              socket.join(gameID)
	      //tell players in games that player has reconnected
	      socket.to(gameID).emit('player-reconnected', {
		playerID: playerID,
		gameID: gameID
	      })
            }
            //emit the array of games to the player
            socket.emit('join-games', {
              games: existingGames
            })
          }
            else {
              console.log(getTimeStamp() + data.playerID +
                  ' no existing games to join')
            }
          })
        }
      })
    })

  socket.on('disconnect', function() {
    //find the player object in the players table with this socket it
    walkoff.table('players').filter({
      sid: socket.id
    }).coerceTo('array').run(connection, function(err, player) {
      if(player.length == 1) {
        var playerID = player[0].id
	var games = player[0].games
	walkoff.table('players').get(playerID).update({connected: false}).
	run(connection, function(err, response) {
	  console.log(getTimeStamp() + playerID + ' disconnected')
	  for (var i = 0; i < games.length; i++) {
	    var gameID = games[i]
	    console.log(getTimeStamp() + playerID + ' has left ' + gameID)
	    socket.to(gameID).emit('player-disconnected', {
	      playerID: playerID,
	      gameID: gameID
	    })
	  }
	})
      } 
    })
  })

  socket.on('join-game2', function(socketData) {
    console.log(getTimeStamp() + 'join-game received from ' + data.playerdID)
    //use tmpGameIDKey as a temporary ID to group all players
    var tmpGameIDKey = socketData.playerIDs.join('')
    var playerID = socketData.playerID
    var gameID
    //filter the games table for a game object with tmpGameIDKey
    walkoff.table('games').filter({tmpGameID: tmpGameIDKey}).
    run(connection, function(err, newGame) {
      //if the game object doesn't exist, create it when the first player
      //connects to the server with a tmpGameIDKey
      if(!newGame) {
        console.log(getTimeStamp() + tmpGameIDKey +
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
        walkoff.table('games').insert(newGameUpdate).
        run(connection, function(err, response) {
          console.log(getTimeStamp() + response.generated_keys +
            '\n\t new game created'
          )
          //initialize the rethink id as the gameID
          gameID = response.generated_keys
          socket.join(gameID)
          console.log(getTimeStamp() + gameID +
            '\n\t player 1 is ' + playerID
          )
        })
      //if the game object already exists
      } else { 
        //initialize gameID from the game data pulled from the db
        gameID = newGame.id
        //connectedPlayerCount includes this socket (+1)
        var connectedPlayerCount = newGame.playerIDs.length + 1
        //create playerDataUpdate object to update games table
        var playerDataUpdate
        playerDataUpdate[playerID] = {
          score: 0
          //add key-values as needed
        }
        //if the last player is joining
        if (connectedPlayerCount == newGame.count) {
          //update the games table with player info and game details
          walkoff.table('games').get(gameID).update({
            gameStarted: rethink.now(),
            lastUpdate: rethink.now(),
            //clear the tmpGameID
            tmpGameID: '', 
            playerData: playerDataUpdate,
            playerIDs: rethink.row('playerIDs').append(playerID)
          //return data that includes the initialized game
          },{ returnChanges: true }).
          run(connection, function(err, changes) {
            walkoff.table('players').getAll(rethink.args(socketData.playerIDs)).
            update({ 
              games: rethink.row('games').append(gameID) 
            },{ returnChanges: true }).run(connection, function(err, response) {
              //unwrap response to get aliases
              console.log(getTimeStamp() + gameID +
                '\n\t all players have joined, the game is starting...'
              ) 
            })
          })
        }
      }
    }
  })
         //if the game already exists, the game object is not null
          //initialize gameID from game data pulled from the db
          var updatedGameData
	  gameID = game[0].id
          //create a new player object, used to update the db
          var playerDataUpdate = {}
          playerDataUpdate[playerID] = {
            score: 0,
          }
          walkoff.table('games').get(gameID).update({
            playerData: playerDataUpdate,
	    playerIDs: rethink.row('playerIDs').append(playerID)
          },{ returnChanges: true }).run(connection, function(err, response) {
	    if (response.replaced == 1) {
	      updatedGameData = response 	
	    }
            //join the game after updating the db
            socket.join(gameID)
            //add to the player count
            var playerCount = game[0].playerIDs.length + 1
            console.log(getTimeStamp() + gameID +
              '\n\t player ' + playerCount + ' is: ' + playerID)
	    //when the last player joins...
            if (playerCount === data.count) {
                            //update the game object before starting the game
              walkoff.table('games').get(gameID).update(gameUpdate).
              run(connection, function(err, response) {
                console.log(getTimeStamp() +  gameID +
                  '\n\t all players have joined, the game is starting...'
                )
                //add gameID to all players object's game array
                walkoff.table('players').getAll(rethink.args(data.playerIDs))
                .update({
                  games: rethink.row('games').append(gameID)
                }).run(connection, function(err, response) {})
                //pull the game object and put it in an array
                walkoff.table('games').get(gameID)
                .run(connection, function(err, newGame) {
                  //tell all clients to make game objects
                  socket.to(gameID).emit('join-games', {
                    games: [newGame],
                  })
                  socket.emit('join-games', {
                    games: [newGame],
                  })
                })
              })
            }
          })
        }
      })
    })
  })

  socket.on('update-score', function(data) {
    //create object with updated keys
    var update = {}
    update[data.playerID] = {
        score: data.newScore
      }
      //save update to db before emitting to other players
    walkoff.table('games').get(data.gameID).update({
      players: update
    }).
    run(connection, function(err, response) {
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
      socket.emit('player-id', {
        playerID: socket.playerID
      })
    })
})

server.listen(2000)
console.info(getTimeStamp() +
  ' walkoff-server started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return '\n' + reformat(date.getHours()) + ':' + reformat(date.getMinutes()) + ':' +
    reformat(date.getSeconds()) + ' '

  function reformat(number) {
    if (number < 10) {
      var reformattedNumber = '0' + number
      return reformattedNumber
    }
    else {
      return number
    }
  }
}
