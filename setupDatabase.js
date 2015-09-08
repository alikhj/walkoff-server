var rethink = require('rethinkdb')
var connection
var db

rethink.connect({
  host: 'localhost',
  port: 28015,
}, function(err, conn) {
  if (err) {
    throw new Error(getTimeStamp() + 'cannot connect to rethinkdb: ', err)
  }
  connection = conn
  exports.connection = connection
  createDatabase()
})

function createDatabase() {
  rethink.dbList().run(connection, function(err, dbs) {
    if (err) {
      throw new Error(getTimeStamp() +
        'error getting the list of databases: ', err)
    }
    if (dbs.indexOf('db') === -1) {
      rethink.dbCreate('db').run(connection, function(err, response) {
        console.log('created db database')
      })
    }
    db = rethink.db('db')
    exports.db = db
    createTables()
  })
}

function createTables() {
  db.tableList().run(connection, function(err, tables) {
    if (err) {
      throw new Error(getTimeStamp() +
        'error getting the list of databases: ', err)
    }
    createTableWithName('games')
    createTableWithName('players')

    function createTableWithName(tableName) {
      if (tables.indexOf(tableName) === -1) {
        db.tableCreate(tableName).run(connection, function(err,
          response) {
          if (err) {
            throw new Error(getTimeStamp() +
              'error creating table with name: ' + tableName)
          }
          console.log('table created with name: ' + tableName)
        })
      }
    }
  })
}

