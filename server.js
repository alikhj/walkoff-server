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
  console.log('hit the web url');
  res.sendFile(path.join(__dirname, './views/index.html'))
})
var connection
var walkoff
rethink.connect({
  host: 'localhost',
  port: 28015,
}, function(err, conn) {
  if (err) {
    throw new Error('cannot connecto to rethinkdb: ', err)
  }
  connection = conn
  createDatabase()
})

function createDatabase() {
  rethink.dbList().run(connection, function(err, dbs) {
    if (err) {
      throw new Error('Error getting the list of databases: ', err)
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
      throw new Error('error getting the list of databases: ', err)
    }
    createTableWithName('games')
    createTableWithName('players')

    function createTableWithName(tableName) {
      if (tables.indexOf(tableName) === -1) {
        walkoff.tableCreate(tableName).run(connection, function(err,
          response) {
          if (err) {
            throw new Error('error creating table with name: ' +
              tableName)
          }
          console.log('table created with name: ' + tableName)
        })
      }
    }
  })
}

io.on('connection', function(socket) {
  console.log('\n' + getTimeStamp() + ' ' + socket.id + ' connected')
  socket.games = []
  socket.on('player-connected', function(data) {
    //check if player exists, and update with new sid
    walkoff.table('players').get(data.playerID).update({
      sid: socket.id,
      connected: true,
      alias: data.alias,
    }).run(connection, function(err, response) {
      //if player does not exist
      if (response.skipped == 1) {
        walkoff.table('players').insert({
            id: data.playerID,
            alias: data.alias,
            connected: true,
            sid: socket.id,
          }).run(connection, function(err, response) {
            console.log('\n' + getTimeStamp() + ' ' + data.playerID +
              ' does not exist, was added to players table:' +
              '\n\t id: ' + data.playerID + '\n\t sid: ' +
              socket.id)
          })
          //if player already exists
      } else {
        console.log('\n' + getTimeStamp() + ' ' + data.playerID +
            ' updated with new sid in players table: ' +
            '\n\t sid: ' + socket.id)
          //check if player was in games before disconnection
        var filter = {
          players: {}
        }
        filter.players[data.playerID] = {}
        walkoff.table('games').filter(filter).
        run(connection, function(err, gamesCursor) {
          if (gamesCursor) {
            gamesCursor.toArray(function(err,
              gamesContainingPlayer) {
              for (var game in gamesContainingPlayer) {
                console.log('\n' + getTimeStamp() + ' ' +
                  data.playerID + '\n\t rejoining game: ' +
                  '\n\t ' + gamesContainingPlayer[game].id
                )
                socket.join(gamesContainingPlayer[game].id)
                  //send player gameID and players
                socket.emit('game-rejoined', {
                  gameID: gamesContainingPlayer[game].id,
                  players: gamesContainingPlayer[game].players
                })
              }
            })
          }
        })
      }
    })
  })

  socket.on('disconnect', function() {
    walkoff.table('players').filter({
      sid: socket.id
    }).
    run(connection, function(err, playerCursor) {
      playerCursor.toArray(function(err, player) {
        if (player.length) {
          var playerID = player[0].id
            //update 'connected' to false
          walkoff.table('players').get(playerID).update({
            connected: false,
            lastUpdate: rethink.now()
          }).
          run(connection, function(err, response) {
            console.log('\n' + getTimeStamp() + ' ' +
                playerID + ' disconnected')
              //pull all game ids to emit disconnection notice
            var filter = {
              players: {}
            }
            filter.players[playerID] = {}
            walkoff.table('games').filter(filter).
            run(connection, function(err, gamesCursor) {
              gamesCursor.toArray(function(err,
                gamesContainingPlayer) {
                for (var game in
                  gamesContainingPlayer) {
                  console.log('\n' + getTimeStamp() +
                    ' ' + playerID +
                    '\n\t emitting disconnection notice to ' +
                    '\n\t ' +
                    gamesContainingPlayer[game].id
                  )
                  socket.to(gamesContainingPlayer[
                    game].id).
                  emit('player-disconnected', {
                    playerID: playerID,
                    gameID: gamesContainingPlayer[
                      game].id
                  })
                }
              })
            })
          })
        }
      })
    })
  })

  socket.on('join-game', function(data) {
    console.log('\n' + getTimeStamp() + ' join-game received from ' +
        data.playerID)
    //use tmpGameIDkey as a temporary ID to gather all players
    var tmpGameIDkey = data.playerIDs.join('')
    var gameID
    var playerID = data.playerID
    //check to see if a game with tmpGameIDkey already exists
    walkoff.table('games').filter({
      tmpGameID: tmpGameIDkey
    }).run(connection, function(err, gameCursor) {
      gameCursor.toArray(function(err, game) {
        //if the game doesn't exist, create the game object when the first
        //player with the tmpGameIDkey connects to the server
        if (!game.length) {
          console.log('\n' + getTimeStamp() + ' ' +
            tmpGameIDkey +
            '\n\t no game with this tmpGameIDkey exists, creating game...'
          )
          var newGame = {
            tmpGameID: tmpGameIDkey,
            playerCount: data.count,
            players: {}
          }
          newGame.players[playerID] = {
            score: 0,
            lastUpdate: rethink.now()
          }
          //insert the new game object into the db
          walkoff.table('games').insert(newGame).
          run(connection, function(err, response) {
            console.log('\n' + getTimeStamp() + ' ' +
              response.generated_keys +
              '\n\t new game created'
            )
            //initialize the rethink id as the gameID
            gameID = response.generated_keys
              //create the new game room and join it
            socket.join(gameID)
            console.log('\n' + getTimeStamp() + ' ' +
              gameID + '\n\t player 1 is ' + playerID
            )
          })
        } else {
          //if the game already exists, the game object is not null
          //initialize gameID from game data pulled from the db
          gameID = game[0].id
          //create a new player object, used to update the db
          var players = {}
          players[playerID] = {
            score: 0,
            lastUpdate: rethink.now()
          }
          walkoff.table('games').get(gameID).update({
            players: players
          }).run(connection, function(err, response) {
            //join the game after updating the db
            socket.join(gameID)
            //count the players by adding one to the game data pulled earlier
            var playerCount = Object.keys(game[0].players).length + 1
            console.log('\n' + getTimeStamp() + ' ' +
              gameID + '\n\t player ' + playerCount +
              ' is: ' + playerID
            )
            if (playerCount === data.count) {
              var update = {
                gameStarted: rethink.now(),
                lastUpdate: rethink.now(),
                tmpGameID: ''
              }
	      rethink.do(walkoff.table('games').get(gameID).getField('players').keys(),
	        function(playerObjects) {
		  return walkoff.table('players').getAll(rethink.args(playerObjects)).
		  pluck(['alias', 'id']).coerceTo('array');
		}
	      ).run(connection, function(err, playersArray) {
	        walkoff.table('games').get(gameID).update(update).
                run(connection, function(err, response) {
                  console.log('\n' + getTimeStamp() + ' ' + gameID +
                    '\n\t all players have joined, the game is starting...'
                  )  
                  socket.to(gameID).emit('game-started', {
                    gameID: gameID,
		    players: playersArray
                  })
                  socket.emit('game-started', {
                    gameID: gameID,
            	    players: playersArray
                  })
                })
	      }) 
            }
          })
        }
      })
    })
  })

  socket.on('rejoin-game', function(data) {
    console.log('\n' + getTimeStamp() + ' ' + data.gameID +
        '\n\t rejoin-game received from: ' + data.playerID)
      //rejoin game and use gameID to retrieve all game data
      //update all scores with historic steps data
    socket.join(data.gameID)
    var update = {}
    update[data.playerID] = {
      connected: true,
    }
    walkoff.table('games').get(data.gameID).
    update(update).run(connection, function(err, response) {})
    walkoff.table('games').get(data.gameID).run(connection, function(
      err, gameData) {
      console.log('\n' + getTimeStamp() + ' ' + data.gameID +
          '\n\t fetching all game data for ' + data.playerID)
        //tell other players in the game that this player has reconnected
      socket.to(data.gameID).emit('player-reconnected', {
          playerID: data.playerID,
          gameID: data.gameID
        })
        //send the player the gameData
      socket.emit('game-rejoined', {
        gameID: data.gameID,
        gameData: gameData
      })
    })
  })

  socket.on('update-score', function(data) {
    //create object with updated keys
    var update = {
      lastUpdated: rethink.now()
    }
    update[data.playerID] = {
        lastUpdated: rethink.now(),
        score: data.newScore
      }
    //save update to db before emitting to other players
    walkoff.table('games').get(data.gameID).update(update).
    run(connection, function(err, response) {
      socket.to(data.gameID).emit('score-updated', {
        gameID: data.gameID,
        newScore: data.newScore,
        playerID: data.playerID
      })
      console.log('\n' + getTimeStamp() + ' ' + data.gameID +
        '\n\t update-score received from ' + data.playerID +
        '\n\t newScore: ' + data.newScore)
    })
  })

  socket.on('get-player-id', function() {
      socket.emit('player-id', {
        playerID: socket.playerID
      })
    })
    /**
     * Send a player disconnection notice to all other players in the game
     * data required: none
     */
})

server.listen(2000)
console.info(getTimeStamp() +
  ' walkoff-server started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return reformat(date.getHours()) + ':' + reformat(date.getMinutes()) + ':' +
    reformat(date.getSeconds())

  function reformat(number) {
    if (number < 10) {
      var reformattedNumber = '0' + number
      return reformattedNumber
    } else {
      return number
    }
  }
}
