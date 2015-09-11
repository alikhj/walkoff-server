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

    socket.on('new-game', function(socketData) {
      var newGame = require('./newGame/newGame.js')(socket, socketData)
     })

    socket.on('update-score', function(socketData) {
      var updateScore = require('./updateScore/updateScore.js')(socket, socketData)

    })
    
  })
}
