var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function acceptInvitation(socket, socketData) {

  convertInvitatonToGame(socketData.playerID, socketData.invitationID, socketData.index)

  function convertInvitatonToGame(playerID, invitationID, invitationIndex) {

    var update = {
      invitations: rethink.row('invitations').deleteAt(invitationIndex),
      games: rethink.row('games').append(invitationID)
    }

    r.db.table('players').get(playerID).update(update).
    run(r.connection, function(err, response) {

      getGameData(playerID, invitationID)
    })
  }

  function getGameData(playerID, gameID) {

    var playerData = {}
    playerData[playerID] = {
      inGame: true
    }

    r.db.table('games').get(gameID).update({playerData: playerData}, {returnChanges: true})
    .run(r.connection, function(err, response) {
      var game = response.changes[0].new_val
      var playerIDs = game.playerIDs

      getPlayerData(game, gameID, playerIDs)
    })
  }

  function getPlayerData(gameData, gameID, playerIDs) {

    r.db.table('players').getAll(rethink.args(playerIDs)).
    pluck(
      'alias',
      'id',
      'connected',
      'movementType'
    ).coerceTo('array').run(r.connection, function(err, playerData) {

      joinGame(gameID)
      emitGameStarted(gameData, playerData)
    })
  }

  function joinGame(gameID) {

    socket.join(gameID)
  }

  function emitGameStarted(gameData, playerData) {

    socket.emit('game-started', {
      gameData: gameData,
      playerData: playerData
    })
  }
}
