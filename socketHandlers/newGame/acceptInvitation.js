var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function acceptInvitation(socket, socketData) {
  var playerID = socketData.playerID
  var gameID = socketData.invitationID
  var playerUpdate = {invitations: rethink.row('invitations').deleteAt(socketData.index),
  games: rethink.row('games').append(socketData.invitationID)}
  var playerData = {}
  playerData[playerID] = {
    inGame: true
  }

  r.db.table('players').get(playerID).update(playerUpdate).
  run(r.connection, function (err, invitations) {

    r.db.table('games').get(gameID).update({playerData: playerData}, {returnChanges: true})
    .run(r.connection, function(err, response) {
      var game = response.changes[0].new_val
      var playerIDs = game.playerIDs

      r.db.table('players').getAll(rethink.args(playerIDs)).
      pluck('alias', 'id', 'connected', 'games', 'movementType').coerceTo('array').
      run(r.connection, function(err, playerData) {

        socket.join(gameID)
        socket.emit('game-started', {
          gameData: game,
          playerData: playerData
        })

        socket.to(gameID).emit('player-reconnected', {
          playerID: playerID,
          gameID: gameID
        })
      })
    })
  })
}
