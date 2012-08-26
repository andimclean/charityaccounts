var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello Dragon\n');
}).listen(parseInt(process.env.PORT) || 80, process.env.IP || '0.0.0.0');
