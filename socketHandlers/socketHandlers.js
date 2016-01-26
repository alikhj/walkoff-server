var r = require('../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../helpers/getTimeStamp')

module.exports = function socketHandlers(server) {
  io = require('socket.io').listen(server)
  io.on('connection', function(socket) {
    console.log(getTimeStamp() + socket.id + ' connected')

    socket.on('player-connected', function(socketData) {
      var playerConnected = require('./playerConnected/playerConnected.js')(socket, socketData)
    })

    socket.on('disconnect', function() {
      var disconnect = require('./disconnect/disconnect.js')(socket)
    })

    socket.on('new-game', function(socketData) {
      var newGame = require('./newGame/newGame.js')(socket, socketData)
    })

    socket.on('leave-game', function(socketData) {
      var leaveGame = require('./leaveGame/leaveGame.js')(socket, socketData)
    })

    socket.on('new-invitation', function(socketData) {
      var newInvitation = require('./invitation/newInvitation.js')(socket, socketData)
    })

    socket.on('check-invitations', function(socketData) {
      var checkInvitations = require('./invitation/checkInvitations.js')(socket, socketData)
    })

    socket.on('accept-invitation', function(socketData) {
      var acceptInvitation = require('./invitation/acceptInvitation.js')(socket, socketData)
    })

    socket.on('update-movement', function(socketData) {
      var updateScore = require('./movement/updateMovement.js')(socket, socketData)
    })

    socket.on('update-item', function(socketData) {
      var updateStatus = require('./updateItem/updateItem.js')(socket, socketData)
    })

    socket.on('weapon-fired', function(socketData) {
      console.log(socketData)
      var chaseWeaponFired = require('./weapons/weapon-fired.js')(io, socketData)
    })
  })
}
