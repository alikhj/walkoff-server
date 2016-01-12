var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function gameInvitation(socket, socketData) {
  var gameID
  var invitedPlayersDictionary = socketData.invitedPlayers
  var invitedPlayerIDs = Object.keys(invitedPlayersDictionary)
  var newGameData = {
    gameStarted: rethink.now(),
    lastUpdate: rethink.now(),
    playerCount: invitedPlayerIDs.length,
    playerIDs: invitedPlayerIDs
  }

  createNewGameWithGameData(newGameData)

  function createNewGameWithGameData(gameData) {
    r.db.table('games').insert(newGameData).run(r.connection, function(err, response) {
      if (response) {
        gameID = response.generated_keys[0]
        checkForPlayers()
      } else {
        console.log("error creating game and gameID")
      }
    })
  }

  function checkForPlayers() {
    r.db.table('players').getAll(rethink.args(invitedPlayerIDs)).getField('id')
    .coerceTo('array').run(r.connection, function(err, existingPlayerIDs) {

      var newPlayerIDs = []
      for (invitedPlayerID in invitedPlayersDictionary) {

        if (existingPlayerIDs.indexOf(invitedPlayerID) == -1) {
          newPlayerIDs.push(invitedPlayerID)
        }
      }

      updatePlayers(existingPlayerIDs, newPlayerIDs)
    })
  }

  function updatePlayers(existingPlayerIDs, newPlayerIDs) {
    var update = {invitations: rethink.row('invitations').append(gameID)}
    r.db.table('players').getAll(rethink.args(existingPlayerIDs)).update(update).
    run(r.connection, function(err, response) {

      if (newPlayerIDs.length > 0) {
        var newPlayersUpdate = []
        for (i = 0; i < newPlayerIDs.length; i++) {
          var id = newPlayerIDs[i]
          var newPlayerUpdate = {
            id: id,
            alias: invitedPlayersDictionary[id],
            movementType: null,
            connected: false,
            lastUpdate: rethink.now(),
            sid: null,
            games: [],
            invitations: [gameID]
          }
          newPlayersUpdate.push(newPlayerUpdate)
        }

        r.db.table('players').insert(newPlayersUpdate).
        run(r.connection, function(err, response) {
          updateGame()
        })

      } else {
        updateGame()
      }

    })
  }

  function updateGame() {
    var playerData = {}

    for (invitedPlayerID in invitedPlayersDictionary) {
      playerData[invitedPlayerID] = {
        score: 0,
        inGame: false
      }
    }

    r.db.table('games').get(gameID).update({playerData: playerData}).
    run(r.connection, function(err, response) {

    })
  }
}
