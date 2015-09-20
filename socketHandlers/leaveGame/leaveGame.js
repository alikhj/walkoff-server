var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function leaveGame(socket, socketData) {

  r.db.table('players').get(socketData.playerID).getField('games')
  .run(r.connection, function(err, gameIDs) {

    socket.leave(socketData.gameID)
    removeGameIDFromPlayerObject(gameIDs, socketData.gameID, socketData.playerID)

  })

  function removeGameIDFromPlayerObject(gameIDs, gameID, playerID) {
    for (var i = 0; i < gameIDs.length; i++) {
      if (gameIDs[i] == gameID) {

        r.db.table('players').get(playerID).update({
          games: rethink.row('games').deleteAt(i)
        }).run(r.connection, function(err, response) {
          updatePlayerData(gameID, playerID)
        })
      }
    }
  }

  function updatePlayerData(gameID, playerID) {
    var status = 'quit'
    var playerDataUpdate = {}
    playerDataUpdate[playerID] = {
      score: 0,
      status: status
      //add key-values as needed
    }

    r.db.table('games').get(gameID).update({
      playerData: playerDataUpdate
    }, { returnChanges: true }).run(r.connection, function(err, response) {
      console.log(
        getTimeStamp() + gameID +
        '\n\t ' + playerID + ' has left the game'
      )

      socket.to(gameID).emit('status-updated', {
        gameID: gameID,
        newStatus: status,
        playerID: playerID
      })

      var playerCount = response.changes[0].new_val.playerCount
      var newCount = playerCount - 1
      if (newCount == 0) {
        endGame(gameID)

      } else {
        updatePlayerCount(gameID, newCount)
      }
    })
  }

  function updatePlayerCount(gameID, newCount) {
    r.db.table('games').get(gameID).update({
      playerCount: newCount
    }).run(r.connection, function(err, response) {
      console.log(
        getTimeStamp() + gameID +
        '\n\t number of players is now ' + newCount
      )
    })
  }

  function endGame(gameID) {
    r.db.table('games').get(gameID).delete().
    run(r.connection, function(err, response) {
      console.log(
        getTimeStamp() + gameID +
        '\n\t all players have left, the game has ended'
      )
    })
  }
}
