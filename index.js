var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs-extra');
var path = require('path');
var Promise = require("bluebird");
var bodyParser = require('body-parser');
var base64 = require("./impl/base64");
var restservices = require("./impl/restservices");
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var proc;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', express.static(path.join(__dirname, 'stream')));

//Manda el fichero index.html al recibir una / en el navegador
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var sockets = {};

//io-> framework de conexión de entrada y salida de sockets
io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

  socket.on('reboot', function() {
    exec('sudo shutdown -r now', function(error, stdout, stderr){ console.log(stdout) });
  });

  socket.on('poweroff', function() {
    exec('sudo shutdown now', function(error, stdout, stderr){ console.log(stdout) });
  });

  socket.on('takephoto', function() {
    console.log('Tomar una Foto');
    pauseStreaming();
    //copiar la imagen que se captura del streaming
    try {
      fs.copySync('./stream/image_stream.jpg', './stream/image_photo.jpg')
      console.log('copy success!');
      // convert image to base64 encoded string
      var base64str = base64.base64_encode('./stream/image_photo.jpg');
      console.log('image convert base64');
      //send image rest invocation
      var inputParams = {
        image: base64str,
        demozone: "MADRID"
      };
      var result = restservices.sh_facerecogprocess(inputParams);

      Promise.resolve(result)
        .then(function(result) {
          console.log("RESULTADO PARECIDO RAZONABLE: " + result.found);
          //console.log(result);
          if (result.found) {
            console.log("sending match");
            io.sockets.emit('match', result.customer);
          } else {
            console.log("sending nomatch");
            io.sockets.emit('nomatch', '');
          }

        });
    } catch (err) {
      console.error(err);
    }

    startStreaming(io);
  });
});

app.post('/event', function(req, res) {
  console.log('Presence: ' + req.body.presence);
  res.send('OK');
  if (req.body.presence) {
    io.sockets.emit('buttonPhoto', '');
  } else {
    io.sockets.emit('hidebuttonPhoto', '');
  }
});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  console.log('Stop Streaming...');
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
    console.log('unwatchfile...');
  }
}

function pauseStreaming() {
  console.log('Pause Streaming...');
  app.set('watchingFile', false);
  if (proc) proc.kill();
  //    fs.unwatchFile('./stream/image_stream.jpg');
}

function startStreaming(io) {
  console.log("Start streaming...");
//  console.log("watchingfile:" + app.get('watchingFile'));

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  var args = ["-n", "-w", "400", "-h", "510", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];
  //  var args = [ "-p", "100,100,640,480", "-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];
  proc = spawn('raspistill', args);
  if (proc.pid) {
    console.log('Watching for changes... PID: ' + proc.pid);
  } else {
    console.log('Error spawning raspistill!!!');
  }

  app.set('watchingFile', true);
//  console.log("llega aquí?");
  fs.watchFile('./stream/image_stream.jpg', {
    interval: 100
  }, function(current, previous) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
  })
}
