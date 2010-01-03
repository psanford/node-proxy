/*
 Copyright (c) 2010 Peter Sanford

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

var sys = require('sys'),
    tcp = require('tcp'),
    dns = require('dns');

var STATES = {
  NOTCONNECTED : 0,
  NEW : 1,
  CONNECTING : 2,
  CONNECTED : 3
};

var server = tcp.createServer(function (socket) {
  socket.setEncoding("binary");
  var state = STATES.NOTCONNECTED;
  var server, port, host, headers;
  headers = '';

  var connection;
  var connecting_data = [];

  socket.addListener("connect", function () {
    state = STATES.NEW;
  });
  socket.addListener("receive", function (data) {
    if (state  == STATES.CONNECTING) {
      connecting_data.push(data);
    } else if (state != STATES.CONNECTED) {
      headers += data;
      if ((data =~ "\r\n\r\n")) {
        var lines = headers.split("\r\n");
        var connect = lines.shift();
        var match = connect.match("CONNECT +([^:]+):([0-9]+).*");
        host = match[1];
        port = match[2];
        //sys.debug("connect " + host + " " + port);

        var resolution = dns.resolve4(host);

        resolution.addCallback(function (addresses, ttl, cname) {
          server = addresses[0];
          //sys.debug("server: " + server);

          connection = tcp.createConnection(port, server);
          connection.setEncoding("binary");
          connection.addListener("connect", function () {
            state = STATES.CONNECTED;
            for (var i =0 ; i <  connecting_data.length; i++ ) {
              connection.send(connecting_data[i]);
            }
          });
          connection.addListener("receive", function (data_from_server) {
            socket.send(data_from_server);
          });
          connection.addListener("eof", function (data) {
            socket.close();
          });

          state = STATES.CONNECTING;
          socket.send("HTTP/1.0 200 Connection established\r\n\r\n");
        });
      }
    } else {
      connection.send(data);
    }
  });
  socket.addListener("eof", function () {
    socket.close();
  });
});

server.listen(8001, "localhost");

sys.puts('Server running at http://127.0.0.1:8001/');
