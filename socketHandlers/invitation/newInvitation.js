var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function newInvitation(socket, socketData) {
  var gameID
  var invitation
  var invitedPlayersDictionary = socketData.invitedPlayers
  var invitedPlayerIDs = Object.keys(invitedPlayersDictionary)
  var newGameData = {
    gameStarted: rethink.now(),
    lastUpdate: rethink.now(),
    playerCount: invitedPlayerIDs.length,
    playerIDs: invitedPlayerIDs
  }

  var gameData
  var playerData

  createNewGame(newGameData)

  function createNewGame(gameData) {
    r.db.table('games').insert(gameData).run(r.connection, function(err, response) {
      if (response) {
        gameID = response.generated_keys[0]

        checkForNewPlayers()
      } else {

        console.log("error creating game and gameID")
      }
    })
  }

  function checkForNewPlayers() {
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
    invitation = {
      gameID: gameID,
      playerID: socketData.playerID,
      alias: socketData.alias
    }

    r.db.table('players').getAll(rethink.args(existingPlayerIDs)).
    update({invitations: rethink.row('invitations').append(invitation)}).
    run(r.connection, function(err, response) {

      if (newPlayerIDs.length > 0) {
        insertNewPlayers(newPlayerIDs)

      } else {

        addPlayerDataToGame()
      }
    })
  }

  function insertNewPlayers(newPlayerIDs) {

    var newPlayers = []
    for (i = 0; i < newPlayerIDs.length; i++) {
      var id = newPlayerIDs[i]
      var newPlayer = {
        id: id,
        alias: invitedPlayersDictionary[id],
        movementType: '🏁',
        connected: false,
        lastUpdate: rethink.now(),
        sid: null,
        games: [],
        invitations: [invitation]
      }

      newPlayers.push(newPlayer)
    }

    r.db.table('players').insert(newPlayers).
    run(r.connection, function(err, response) {

      addPlayerDataToGame()
    })
  }

  function addPlayerDataToGame() {
    var playerData = {}

    for (invitedPlayerID in invitedPlayersDictionary) {
      playerData[invitedPlayerID] = {
        score: 0,
        inGame: true
      }
    }

    r.db.table('games').get(gameID).update({playerData: playerData}).
    run(r.connection, function(err, response) {

      socketData['index'] = -1
      socketData['invitationID'] = gameID
      var acceptInvitation = require('./acceptInvitation.js')(socket, socketData)
    })
  }
}
