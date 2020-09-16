const http = require('http');
const url = require('url');
const spawn = require('child_process').spawn;

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;

console.log(`Server listening on ${HOST}:${PORT}`);

let randomId = function() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Date.now();
};

let checkAuth = function(req) {
  // TODO: check authentication
};

let getOutputPath = function() {
  // TODO: get output path
  return '/';
};

let compileCode = function(codePath, res) {
  let outputPath = getOutputPath();
  let child = spawn('emcc', [codePath, '-Iutil/', '-O3',
                    '-s', 'ASYNCIFY', '--js-library',
                    'library.js', '--bind', '-o',
                    outputPath])
  child.on('exit', function (code, signal) {
    res.end('child process exited with ' +
            `code ${code} and signal ${signal}`);
  });
};

http.createServer(function (req, res) {
  req;


    if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html" });
        fs.createReadStream("./public/form.html", "UTF-8").pipe(res);
    } else if (req.method === "POST") {
    
        var body = "";
        req.on("data", function (chunk) {
            body += chunk;
        });

        req.on("end", function(){
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(body);
        });
    }



  res.writeHead(200, {'Content-Type': 'text/plain'});
  var q = url.parse(req.url, true).query;
  var txt = q.year + " " + q.month;
  res.end(txt);
}).listen(PORT, HOST);
