var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function startGame(socket, socketData, game) {
  var gameID = game.id
  r.db.table('games').get(gameID).update({
    gameStarted: rethink.now(),
    lastUpdate: rethink.now(),
    //clear the tmpGameID
    tmpGameID: '',
    //return data that includes the initialized game
  }).run(r.connection, function(err, response) {

    updatePlayerGamesArray()
  })

  function updatePlayerGamesArray() {
    //add the gameID to each player object in the players table
    r.db.table('players').getAll(rethink.args(socketData.playerIDs)).update({
      games: rethink.row('games').append(gameID)
    }).run(r.connection, function(err, response) {

      getPlayerData()
    })
  }

  function getPlayerData() {
    //get alias-ID pairs from players table
    r.db.table('players').getAll(rethink.args(socketData.playerIDs)).
    pluck('alias', 'id').coerceTo('array').
    run(r.connection, function(err, playerData){

      emitData(playerData)
    })
  }

  function emitData(playerData) {
    socket.to(gameID).emit('game-started', {
      gameData: game,
      playerData: playerData
    })
    socket.emit('game-started', {
      gameData: game,
      playerData: playerData
    })
  }
}
