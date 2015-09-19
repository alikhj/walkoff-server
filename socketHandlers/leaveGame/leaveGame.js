var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function leaveGame(socket, socketData) {
  var gameID = socketData.gameID
  var playerID = socketData.playerID
  var index
  console.log('leaving game: ' + gameID)
  r.db.table('players').get(playerID).getField('games')
  .run(r.connection, function(err, gamesArray) {
    console.log(gamesArray.length + 'asdasd')
    for (var i = 0; i < gamesArray.length; i++) {
      console.log('dsa' + gamesArray[i])
      if (gamesArray[i] == gameID) {

r.db.table('players').get(playerID).update({
     games: rethink.row('games').deleteAt(i)
   }).run(r.connection, function(err, response) {})

         console.log('asd' + i)
      }
    } 
     })

}


