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

app.route('/')
  .get(function (req, res) {
    console.log('hit the web url');
    res.sendFile(path.join(__dirname, './views/index.html'))
  })

var connection
var walkoff

rethink.connect({
  host: 'localhost',
  port: 28015,
}, function(err, conn) {
  if(err) {
   throw new Error('cannot connecto to rethinkdb: ', err)
  }

  connection = conn
  createDatabase()
})

function createDatabase() {
  rethink.dbList().run(connection, function(err, dbs) {
    if(err) {
      throw new Error('Error getting the list of databases: ', err)
    }

    if(dbs.indexOf('walkoff') === -1) {
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
    if(err) {
      throw new Error('error getting the list of databases: ', err)
    }
    createTableWithName('games')
    createTableWithName('players')
    function createTableWithName(tableName) {
      if(tables.indexOf(tableName) === -1) {
        walkoff.tableCreate(tableName).run(connection, function(err, response) {
          if(err) {
            throw new Error('error creating table with name: ' + tableName)
          }
          console.log('table created with name: ' + tableName)
        })
      }
    }
  })
}

io.on('connection', function (socket) {

  console.log('\n' + getTimeStamp() + ' ' + socket.id + ' connected')
  socket.games = []
  var playerData = {
    connected: true,
    score: '',
    lastUpdated: ''
  }

  socket.on('player-connected', function (data) {
    //check if player exists, and update with new sid
    walkoff.table('players').get(data.playerID).update({
      sid: socket.id,
      lastUpdated: rethink.now()
    }).run(connection, function(err, response) {
     //if player does not exist
     if (response.skipped == 1) {
        walkoff.table('players').insert({
          id: data.playerID,
          sid: socket.id,
	        lastUpdated: rethink.now()
      	}).run(connection, function(err, response){
      	  console.log('\n' + getTimeStamp() + ' ' + data.playerID +
            		      ' does not exist, adding to players table:' +
            		      '\n\t id: ' + data.playerID +
            		      '\n\t sid: ' + socket.id)
	      })
      //if player already exists
      } else {
        console.log('\n' + getTimeStamp() + ' ' + data.playerID +
        ' updated with new sid in players table: ' +
        '\n\t sid: ' + socket.id)

        //check if player was in games before disconnection
        var filter = {}
        filter[data.playerID] = {
          connected: false
        }
        walkoff.table('games').filter(filter).
        run(connection, function(err, gamesCursor) {
          if(gamesCursor) {
            gamesCursor.toArray(function(err, gamesContainingPlayer) {
              for (var game in gamesContainingPlayer) {
                console.log('\n' + getTimeStamp() + ' ' + data.playerID +
                            '\n\t rejoining game: ' +
                            '\n\t ' + gamesContainingPlayer[game].id)
                socket.join(gamesContainingPlayer[game].id)
                //send player gameID and players
                socket.emit('game-rejoined', {
                  gameID: gamesContainingPlayer[game].id,
                  playerIDs: gamesContainingPlayer[game].playerIDs
                })
                //update connected status in game to 'true'
                var update = {}
                update[data.playerID] = {
                  connected: true,
                  lastUpdated: rethink.now()
                }
                walkoff.table('games').get(gamesContainingPlayer[game].id).
                update(update).run(connection, function(err, response){})
              }
            })
          }
        })
      }
    })
  })

  socket.on('disconnect', function() {
    walkoff.table('players').filter({sid: socket.id}).
    run(connection, function(err, playerCursor) {
      playerCursor.toArray(function(err, player) {

        if(player.length) {
          var update = {}
          update[player[0].id] = {
            connected: false
          }
          //updated 'connected' to false for player in all games
	        walkoff.table('games').update(update).
          run(connection, function(err, response) {
            console.log('\n' + getTimeStamp() + ' ' + player[0].id +
                        ' disconnected, notifying gamerooms...')
            //pull all game ids to emit disconnection notice
            walkoff.table('games').filter(update).
            run(connection, function(err, gamesCursor) {
              gamesCursor.toArray(function(err, gamesContainingPlayer) {
                for (var game in gamesContainingPlayer) {
                  console.log('\n' + getTimeStamp() + ' ' + player[0].id +
                              '\n\t emitting disconnection notice to ' +
                              '\n\t ' + gamesContainingPlayer[game].id)
                    socket.to(gamesContainingPlayer[game].id).
                    emit('player-disconnected', {
                    playerID: player[0].id,
                    gameID: gamesContainingPlayer[game].id
                  })
                }
              })
            })
          })
        }
      })
    })
  })

  socket.on('join-game', function (data) {

    console.log('\n' + getTimeStamp() + ' join-game received from ' + data.playerID)

    var tmpGameID = data.playerIDs.join('')
    var gameID
       //check to see if a game with tmpGameID already exists
       //is there better syntax for filtering?
    walkoff.table('games').filter(rethink.row('tmpGameID').eq(tmpGameID)).
    run(connection, function(err, cursor) {
      cursor.toArray(function(err, results) {
        //if the game doesn't exist, create the game object when the first
        //player connects to the server
        if(!results.length) {
          console.log('\n' + getTimeStamp() + ' ' + tmpGameID +
                      '\n\t no game with this tmpGameID exists, creating game...')
          var game = {
            tmpGameID: tmpGameID,
	          playerCount: data.count,
            playerIDs: []
          }

          //add the first player that connected to the array
	  game[data.playerID] = playerData
          game[data.playerID].lastUpdated = rethink.now()
          //user playerIDs as a key to access player objects
          game.playerIDs.push(data.playerID)
          walkoff.table('games').insert(game).
          run(connection, function(err, response) {
            console.log('\n' + getTimeStamp() + ' ' + response.generated_keys +
                        '\n\t new game created')

            //declare gameID as rethink's id for the object
            gameID = response.generated_keys
            socket.join(gameID)
            console.log('\n' + getTimeStamp() + ' ' + gameID +
                        '\n\t player 1 is ' + data.playerID)
          })

        //if a game does exist, add the player key-value until the number of
        //connected players equals the player count
        } else {
          gameID = results[0].id
	  //create updated playerIDs array to copy into game object later
          results[0].playerIDs.push(data.playerID)
	  //create and define a new player object to copy into game object later
          var newPlayer = {}
          newPlayer[data.playerID] = playerData
          newPlayer[data.playerID].lastUpdated = rethink.now()
	  //update game with new player
          walkoff.table('games').get(gameID).update(newPlayer).
          run(connection, function(err, response) {
            //join the game room
	    socket.join(gameID)
            console.log('\n' + getTimeStamp() + ' ' + gameID +
              '\n\t player ' + results[0].playerIDs.length + ' is: ' + data.playerID)
            //update game.playerIDs array with new playerID
            walkoff.table('games').get(gameID).update
            ({playerIDs: results[0].playerIDs}).
            run(connection, function(err, response) {
              //once the number of connected players equals the player count,
              //start the game and update tmpGameID to "" so the same set of players
              //(ie the same tmpGameID) can be reused, if necessary
              console.log('\n' + getTimeStamp() + ' ' + gameID +
                          '\n\t all players have joined, the game is starting...')
              if(results[0].playerIDs.length === data.count) {
                var update = {
                  gameStarted: rethink.now(),
                  lastUpdated: rethink.now(),
                  tmpGameID: ''
		          }
              console.log('\n' + getTimeStamp() + ' ' + gameID +
                          '\n\t tmpGameID was cleared')
              //walkoff.table('games').get(gameID).update({ tmpGameID: '' }).
              //run(connection, function(err, response){})
	            walkoff.table('games').get(gameID).update(update).
              run(connection, function(err, response){})
              socket.to(gameID).emit('game-started', { gameID: gameID })
              socket.emit('game-started', { gameID: gameID })
             }
	         })
         })
        }
      })
    })
  })

  socket.on('rejoin-game', function (data) {
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
    walkoff.table('games').get(data.gameID).run(connection, function(err, gameData) {
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

  socket.on('update-score', function (data) {
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
      console.log('\n' + getTimeStamp() + ' ' +  data.gameID +
                  '\n\t update-score received from ' + data.playerID +
                  '\n\t newScore: ' + data.newScore)
    })
  })

  socket.on('get-player-id', function () {
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
console.info(getTimeStamp() + ' walkoff-server started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return reformat(date.getHours()) + ':' +
 	 reformat(date.getMinutes()) + ':' +
	 reformat(date.getSeconds())

  function reformat(number) {
    if (number < 10) {
      var reformattedNumber = '0' + number
      return reformattedNumber
    } else { return number }
  }
}
