var express = require('express'),
  httpServer = require('http'),
  path = require('path'),
  app = express(),
  rethink = require('rethinkdb'),
  server = httpServer.createServer(app),
  crypto = require('crypto')

httpServer.globalAgent.maxSockets = 1000

var getTimeStamp = require('./getTimeStamp')
var r = require('./setupDatabase')
var socketHandlers = require('./socketHandlers/socketHandlers')(server)

app.route('/').get(function(req, res) {
  console.log(getTimeStamp() + 'server accessed through browser');
  res.sendFile(path.join(__dirname, './views/index.html'))
})

server.listen(2000)
console.info(getTimeStamp() + ' r.db-server started. Listening on port 2000.')
