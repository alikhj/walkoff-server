var express = require('express'),
  httpServer = require('http'),
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
    res.sendFile(path.join(__dirname, './views/index.html'))
  })

io.on('connection', function (socket) {

  console.log('\n****** ' + getTimeStamp() + ' connected ' + socket.id)

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
   * Rejoin an already established game
   * data required:
   * {
   *   gameID: string
   *   socket.player : string
   * }
   */
  socket.on('rejoin-game', function (data) {
    console.log('\n***** ' + getTimeStamp() + 'rejoin-game: ' + data.gameID +
                '\nplayerID: ' + data.playerID)

    socket.join(data.gameID)
    if (data.playerID && !socket.playerID) {
      socket.playerID = data.playerID
    }

    socket.emit('game-rejoined', {
      gameID: data.gameID
    })
  })

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

    console.log('\n***** ' + getTimeStamp() + ' join-game by player ' + data.playerID)
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

    socket.join(games[tmpGameID].gameUUID)

    socket.emit('game-joined', {
      gameID: games[tmpGameID].gameUUID,
      state: data.playerCount === games[tmpGameID].connectedPlayers ? 'starting' : 'waiting',
      playersNeeded: data.playerCount - games[tmpGameID].connectedPlayers
    })

    if (games[tmpGameID].connectedPlayers === games[tmpGameID].playerCount) {
      socket.broadcast.to(games[tmpGameID].gameUUID).emit('game-started', {
        gameID: games[tmpGameID].gameUUID
      })

      delete games[tmpGameID]
    }
  })

  /**
   * Send a new step count to all other players in a game
   * data required:
   * {
   *   gameID: string,
   *   newStepCount: number
   *   playerID: string
   * }
   */
  socket.on('send-steps', function (data) {
    socket.to(data.gameID).emit('steps-update', {
      gameID: data.gameID,
      newStepsCount: data.newStepsCount,
      playerID: data.playerID
    })
    console.log('\n***** ' + getTimeStamp() + '\nplayerID: ' + data.playerID + '\ngameID: ' +
                data.gameID + '\nsteps: ' + data.newStepsCount)
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
    console.log('\n***** ' + getTimeStamp() + ' player disconnected: ' + socket.playerID)
    socket.emit('player-disconnected', {
      playerID: socket.playerID
    })
  })
})

server.listen(2000)
console.info(getTimeStamp() + ' Project butt has been started. Listening on port 2000.')

function getTimeStamp() {
  var date = new Date()
  return date.getHours() + ':' + date.getMinutes() +':' + date.getSeconds()
}
