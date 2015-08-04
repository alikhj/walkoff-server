var express = require('express'),
  httpServer = require('http'),
  rethink = require('rethinkdb'),
  path = require('path'),
  app = express(),
  server = httpServer.createServer(app),
  io = require('socket.io').listen(server),
  crypto = require('crypto'),
  uuid = require('uuid'),
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
  if (err) {
   throw new Error('Error connection to rethinkdb: ', err)
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
    createTable()	
  })
}

function createTable() {
  walkoff.tableList().run(connection, function(err, tables) {
    if(err) {
      throw new Error('error getting the list of databases: ', err)
    }

    if (tables.indexOf('games') === -1) {
      walkoff.tableCreate('games').run(connection, function(err, response) {
        if (err) {
          throw new Error('there was a problem creating the games table: ', err)  
        }
        console.log('created games table')
      })    
    } 
   
    if (tables.indexOf('players') === -1) {
      walkoff.tableCreate('players').run(connection, function(err, response) {
        if (err) {
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

  /**
   * Handle socket.io errors
   * data required: none
   */
  // socket.on('error', function (err) {
  //   socket.emit('error', {
  //     message: 'There was an error with the server: ' + err
  //   })
  // })

  /**
   * Join/start a game
   * data required:
   * {
   *   playerIDs: [string],
   *   playerID: string
       playerCount: int
   * }
   */
  socket.on('join-game', function (data) {

    console.log('\n' + getTimeStamp() + ' join-game received ' +
                '\n\t' + data.playerID)
    var tmpGameID = data.playerIDs.join('')

    if (data.playerID && !socket.playerID) {
      socket.playerID = data.playerID
    }

    if (!games[tmpGameID]) {
      games[tmpGameID] = {
        gameUUID: uuid.v4(),
        playerCount: data.playerIDs.length,
        players: data.playerIDs,
        connectedPlayers: 1
      }
    } else {
      games[tmpGameID].connectedPlayers++
    }
    socket.games.push(games[tmpGameID].gameUUID)
    socket.join(games[tmpGameID].gameUUID)
    console.log('\n' + getTimeStamp() + ' ' + data.playerID + ' has joined ' +
                '\n\t ' + games[tmpGameID].gameUUID)

    if (games[tmpGameID].connectedPlayers === games[tmpGameID].playerCount) {
      socket.to(games[tmpGameID].gameUUID).emit('game-started', {
        gameID: games[tmpGameID].gameUUID
      })
      socket.emit('game-started', {
        gameID: games[tmpGameID].gameUUID
      })

      walkoff.table('games').insert(
        { gameID: games[tmpGameID].gameUUID,
          testObject: "kk"  }).run(connection, function(err, response){})
      delete games[tmpGameID]
    }  
  }) 

  socket.on('rejoin-game', function (data) {
    console.log('\n' + getTimeStamp() + ' rejoin-game received ' +
                '\n\tgameID: ' + data.gameID +
                '\n\tplayerID: ' + data.playerID)

    socket.join(data.gameID)
    if (data.playerID && !socket.playerID) {
      socket.playerID = data.playerID
    }
    socket.to(data.gameID).emit('player-reconnected', {
      playerID: data.playerID,
      gameID: data.gameID
    })
    socket.emit('game-rejoined', {
      gameID: data.gameID
    })
  })

  socket.on('last-score-update', function (data) {
    //stick this in a separate function
    socket.emit('score-updated', {
      gameID: data.gameID,
      newScore: data.lastScoreUpdate,
      playerID: data.playerID
    })
    console.log('\n' + getTimeStamp() + ' update-score received' +
                '\n\tgameID: ' + data.gameID +
                '\n\tplayerID: ' + data.playerID +
                '\n\tnewScore: ' + data.newScore)
  })

  socket.on('update-score', function (data) {
    //stick this in a separate function
    socket.to(data.gameID).emit('score-updated', {
      gameID: data.gameID,
      newScore: data.newScore,
      playerID: data.playerID
    })
    console.log('\n' + getTimeStamp() + ' update-score received' +
                '\n\tgameID: ' + data.gameID +
                '\n\tplayerID: ' + data.playerID +
                '\n\tnewScore: ' + data.newScore)
  })

  /**
   * Send a powerup notification to all other players in a game
   * data required:
   * {
   *   powerUpID: number,
   *   powerUpTarget: string,
   *   playerID: string
   * }
   */
  socket.on('send-powerup', function (data) {
    socket.to(data.gameID).emit('powerup-used', {
      powerup: data.powerUpID,
      to: data.powerUpTarget,
      from: data.playerID
    })
  })

  /**
   * Get a list of all the rooms a client is connected to
   * data required: none
   */
  socket.on('get-rooms', function () {
    socket.emit('room-list', {
      rooms: socket.rooms
    })
  })

  /**
   * Get the current socket client's playerID
   * data required: none
   */
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

