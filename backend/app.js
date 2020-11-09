const http = require('http');
const url = require('url');
const fs = require('fs');
const spawn = require('child_process').spawn;
const WebSocketServer = require('websocket').server;
const path = require('path');
const tmp = require('tmp');
const initWd = process.cwd();

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;

let niceDateTime = function() {
  let padToFour = number => number <= 99 ? `0${number}`.slice(-2) : number;
  let d = new Date();
  let s = `[${d.getFullYear()}-${padToFour(d.getMonth()+1)}-${padToFour(d.getDate())}]`;
  s += `[${padToFour(d.getHours())}:${padToFour(d.getMinutes())}:${padToFour(d.getSeconds())}]`;
  return s;
}

console.log(`Server listening on ${HOST}:${PORT}`);

let rndChar = function() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
};

let randomId = function() {
  return rndChar() + rndChar() + rndChar() + Date.now();
};

let checkAuth = function(req) {
  // TODO: check authentication
  return true;
};

let getOutputPath = function() {
  // TODO: get output path
  return randomId() + '.js';
};

let compileCode = function(codePath, res, cb) {
  let outputPath = getOutputPath();
  let fsOutputPath = path.join(initWd, 'compile_out', outputPath);
  let childStdout = '', childStderr = '';

  console.log(`${niceDateTime()} Compiling ${codePath} to ${fsOutputPath}`);

  let child = spawn('emcc', [codePath,
                    '-I', 'util/',
                    '-x', 'c++',
                    '-O3',
                    '-s', 'ASYNCIFY',
                    '-s', 'ASYNCIFY_IMPORTS=["emscripten_sleep"]',
                    '--js-library', 'library.js',
                    '--bind',
                    '-o', fsOutputPath]);

  // capture&send stdout/stderr
  child.stdout.on('data', function(data) {
    childStdout += data.toString();
  });
  child.stderr.on('data', function(data) {
    childStderr += data.toString();
  });

  child.on('exit', function (code, signal) {
    if (code == 0)
      res.writeHead(200, {'Content-Type': 'text/json'});
    else
      res.writeHead(500, {'Content-Type': 'text/json'});

    // output results
    let resObj = {
      path: `/code/${outputPath}`,
      code: code,
      signal: signal,
      stdout: childStdout,
      stderr: childStderr,
      msg: code == 0 ? 'Compilation succeeded!' : 'Compilation failed!'
    };

    // send results
    res.end(JSON.stringify(resObj));
    return cb();
  });
};

let httpServer = http.createServer(function (req, res) {
  if (req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(400, {'Content-Type': 'text/json'});
      res.end(`{"msg":"Bad authorization"}`);
      return;
    }

    let body = '';
    req.on('data', function(chunk) {
        body += chunk;
    });

    req.on('end', function() {
      tmp.file(function _tempFileCreated(err, path, fd, cleanupCallback) {
        if (err) {
          res.writeHead(500, {'Content-Type': 'text/json'});
          res.end(`{"msg":"Temporary file creation failed"}`);
          return;
        }

        // write out contents to temp file
        fs.writeFile(path, body, function(err) {
          if (err) {
            res.writeHead(500, {'Content-Type': 'text/json'});
            res.end(`{"msg":"Temporary file creation failed"}`);
            return cleanupCallback();
          }

          // success, now compile it!
          compileCode(path, res, cleanupCallback);
        });
      });
    });
  } else {
    res.writeHead(400, {'Content-Type': 'text/json'});
    res.end(`{"msg":"Invalid request"}`);
  }
});

let wsServer = new WebSocketServer({
  httpServer: httpServer
});

let rooms = {};
const MSG_SUB = 1;
const MSG_UNSUB = 2;
const MSG_SEND = 3;

let subscribe_room = function(conn, room) {
  if (!(room in rooms)) {
    rooms[room] = [];
  }

  // add connection to the room
  rooms[room].push(conn);
};

let unsubscribe_room = function(conn, room) {
  if (!(room in rooms)) { return; }

  // linear search room
  for (var i = 0; i < rooms[room].length; i++) {
    if (rooms[room][i] == conn) {
      rooms[room].splice(i, 1);
      return;
    }
  }
};

let broadcast_room = function(conn, room, msg) {
  if (!(room in rooms)) { return; }

  // linear search room
  for (var i = 0; i < rooms[room].length; i++) {
    if (rooms[room][i] == conn) {
      // don't echo back
      continue;
    } else {
      if (rooms[room][i].connected) {
        connection.sendUTF(msg);
      }
    }
  }
};

wsServer.on('request', function(request) {
  var connection = request.accept('funwithrobots', request.origin);

  console.log(`${niceDateTime()} Connection accepted from ${connection.remoteAddress}`);

  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      let d;
      try { d = JSON.parse(message.utf8Data); d.type; d.room; } catch(e) { return; }
      switch (d.type) {
        case MSG_SUB:
          subscribe_room(connection, d.room);
          break;
        case MSG_UNSUB:
          unsubscribe_room(connection, d.room);
          break;
        case MSG_SEND:
          broadcast_room(connection, d.room, message.utf8Data);
          break;
      }
    }
  });

  connection.on('close', function(reasonCode, description) {
    console.log(`${niceDateTime()} ${connection.remoteAddress} disconnected`);
    // unsubscribe from all rooms (super inefficient, ik)
    for (var room in rooms) {
      if (rooms.hasOwnProperty(room)) unsubscribe_room(connection, room);
    }
  });
});

httpServer.listen(PORT, HOST);
