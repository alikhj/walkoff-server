var r = require('../../setupDatabase'),
  rethink = require('rethinkdb'),
  getTimeStamp = require('../../helpers/getTimeStamp')

module.exports = function updateStatus(socket, socketData) {
//create object with updated keys
  socket.to(socketData.gameID).emit('item-updated', {
    gameID: socketData.gameID,
    playerID: socketData.playerID,
    itemType: socketData.itemType,
    itemIndex: socketData.itemIndex,
    itemName: socketData.itemName
  })
  console.log(getTimeStamp() + socketData.gameID +
    '\n\t update-item received from ' + socketData.playerID +
    '\n\t itemType: ' + socketData.itemType
  )
}
