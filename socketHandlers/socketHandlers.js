var r = require('../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../helpers/getTimeStamp')

module.exports = function socketHandlers(server) {
  io = require('socket.io').listen(server)
  io.on('connection', function(socket) {
    console.log(getTimeStamp() + socket.id + ' connected')

    socket.on('player-connected', function(socketData) {
      var playerConnected = require('./playerConnected/playerConnected')(socket, socketData)
    })

    socket.on('disconnect', function() {
      var disconnect = require('./disconnect/disconnect')(socket)
    })

    socket.on('create-game', function(socketData) {
      var createGame = require('./createGame/createGame.js')(socket, socketData)
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
}

