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
   throw new Error('Error connection to rethinkdb: ', err)
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
    createTable()
  })
}

function createTable() {
  walkoff.tableList().run(connection, function(err, tables) {
    if(err) {
      throw new Error('error getting the list of databases: ', err)
    }

    if(tables.indexOf('games') === -1) {
      walkoff.tableCreate('games').run(connection, function(err, response) {
        if(err) {
          throw new Error('there was a problem creating the games table: ', err)
        }
        console.log('created games table')
      })
    }

    if(tables.indexOf('players') === -1) {
      walkoff.tableCreate('players').run(connection, function(err, response) {
        if(err) {
          throw new Error('there was a problem creating the games table: ', err)
        }
        console.log('created players table')
      })
    }
  })
}

io.on('connection', function (socket) {

  console.log('\n' + getTimeStamp() + ' ' + socket.id + ' connected')
  socket.games = []
  var playerData = {
    connected: true,
    sid: socket.id, 
    score: '',
    lastUpdated: ''
  }

  socket.on('join-game', function (data) {

    console.log('\n' + getTimeStamp() + ' join-game received from ' + data.playerID)

    var tmpGameID = data.playerIDs.join('')
    var gameID
       //check to see if a game with tmpGameID already exists
    walkoff.table('games').filter(rethink.row("tmpGameID").eq(tmpGameID)).
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
              if(results[0].playerIDs.length === data.count) {
                var update = {
                  gameStarted: rethink.now(),
                  lastUpdated: rethink.now(),
                  tmpGameID: ''
		}
                //walkoff.table('games').get(gameID).update({ tmpGameID: '' }).
                //run(connection, function(err, response){})
	        walkoff.table('games').get(gameID).update(update).
                run(connection, function(err, response){})
	        console.log('\n' + getTimeStamp() + ' ' + gameID +
                            '\n\t all players have joined, the game is starting...')
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
      sid: socket.id
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

  socket.on('send-powerup', function (data) {
    socket.to(data.gameID).emit('powerup-used', {
      powerup: data.powerUpID,
      to: data.powerUpTarget,
      from: data.playerID
    })
  })

  socket.on('get-rooms', function () {
    socket.emit('room-list', {
      rooms: socket.rooms
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
  socket.on('disconnect', function() {
    console.log('\n' + getTimeStamp() + ' player disconnected (this message could be delayed)' +
                '\n\tsid: ' + socket.id +
                '\n\tplayerID: ' + socket.playerID +
                '\n\tleaving games:')
    for (game in socket.games) {
      console.log('\t' + socket.games[game])
      socket.to(socket.games[game]).emit('player-disconnected', {
          playerID: socket.playerID,
          gameID: socket.games[game]
        })
      }
  })
})

server.listen(2000)
console.info(getTimeStamp() + ' walkoff-server started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return date.getHours() + ':' + date.getMinutes() +':' + date.getSeconds()
}
