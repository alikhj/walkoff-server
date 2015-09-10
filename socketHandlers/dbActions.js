var r = require('../setupDatabase')

exports.updateTable = 
function updateTable(tableID, objectID, updateData, callbackFunc) {
  r.db.table(tableID).get(objectID).update(updateData).
  run(r.connection, function(err, response) {
    callbackFunc(response)
  })
}  

exports.insertObject = function insertObject(tableID, object, callbackFunc) {
  r.db.table(tableID).insert(object).run(r.connection, function(err, response) {
    callbackFunc(response)
  })
}


 

