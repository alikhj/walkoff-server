var r = require('../setupDatabase')

module.exports = function insertObject(tableID, object, callbackFunc) {
  r.db.table(tableID).insert(object).run(r.connection, function(err, response) {
    callbackFunc(response)
  }
}
