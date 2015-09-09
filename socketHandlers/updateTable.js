var r = require('../setupDatabase')

module.exports = function updateTable(tableID, objectID, updateData, callbackFunc) {
  r.db.table(tableID).get(objectID).update(updateData).
  run(r.connection, function(err, response) {
    callbackFunc(response)
  })  
}
