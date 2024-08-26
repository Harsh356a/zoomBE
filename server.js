const express = require('express');
const http = require('http');
const {
    v4: uuid
} = require('uuid');
const socketIO = require('socket.io')
const app = express();
const expressHTTPServer = http.createServer(app);
const io = new socketIO.Server(expressHTTPServer);

app.use(express.static('public'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.redirect(`/${uuid()}`)
})


app.get("/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    res.render('index', {
        roomId
    });

})




io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit("newJoining", socket.id);
    });
  
    socket.on("sendOffer", ({ peerId, offer }, roomId) => {
      socket.to(roomId).emit("receiveOffer", { peerId: socket.id, offer });
    });
  
    socket.on("sendAnswer", ({ peerId, answer }, roomId) => {
      socket.to(roomId).emit("receiveAnswer", { peerId: socket.id, answer });
    });
  
    socket.on("sendIceCandidate", ({ peerId, candidate }, roomId) => {
      socket.to(roomId).emit("receiveIceCandidate", { peerId: socket.id, candidate });
    });
  
    socket.on('disconnecting', () => {
      const rooms = Object.keys(socket.rooms);
      rooms.forEach(room => {
        socket.to(room).emit('peerDisconnected', socket.id);
      });
    });
  });


expressHTTPServer.listen(3000)