
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes/routes.js')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('ip', process.env.IP || "0.0.0.0");
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('mongodb',process.env.DB || "charityaccounts");
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

routes.bind(app);

http.createServer(app).listen(parseInt(app.get('port')), function(){
  console.log("Express server listening on port " + app.get('port'));
});