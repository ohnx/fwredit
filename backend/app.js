const http = require('http');
const url = require('url');
const fs = require('fs');
const spawn = require('child_process').spawn;
const path = require('path');
const tmp = require('tmp');
const initWd = process.cwd();

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;

console.log(`Server listening on ${HOST}:${PORT}`);

let randomId = function() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Date.now();
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
  let child = spawn('emcc', [codePath, '-Iutil/', '-x', 'c++', '-O3',
                    '-s', 'ASYNCIFY', '--js-library',
                    'library.js', '--bind', '-o',
                    fsOutputPath]);

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

http.createServer(function (req, res) {
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
}).listen(PORT, HOST);
