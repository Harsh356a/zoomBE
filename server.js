const express = require('express');
const http = require('http');
const { v4: uuid } = require('uuid');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const rooms = new Map();

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.redirect(`/${uuid()}`);
});

app.get("/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    res.render('index', { roomId });
});

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        rooms.get(roomId).forEach(userId => {
            socket.emit('userJoined', userId);
        });
        
        rooms.get(roomId).add(socket.id);
        socket.to(roomId).emit('userJoined', socket.id);
        
        socket.on('disconnect', () => {
            if (rooms.has(roomId)) {
                rooms.get(roomId).delete(socket.id);
                socket.to(roomId).emit('userLeft', socket.id);
                
                if (rooms.get(roomId).size === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });

    socket.on("sendOffer", ({ to, offer }) => {
        socket.to(to).emit("receiveOffer", { from: socket.id, offer });
    });

    socket.on("sendAnswer", ({ to, answer }) => {
        socket.to(to).emit("receiveAnswer", { from: socket.id, answer });
    });

    socket.on("sendIceCandidate", ({ to, candidate }) => {
        socket.to(to).emit("receiveIceCandidate", { from: socket.id, candidate });
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});