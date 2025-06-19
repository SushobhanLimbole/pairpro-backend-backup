const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const socketToRoom = {};
const roomToSockets = {};
const chat = {}; // 💬 Store chat messages by roomId

io.on('connection', (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId }) => {
    console.log(`user joined`);

    if (!roomToSockets[roomId]) {
      roomToSockets[roomId] = [];
    }

    const room = roomToSockets[roomId];

    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }

    if (!room.includes(socket.id)) {
      room.push(socket.id);
      socketToRoom[socket.id] = roomId;
      socket.join(roomId);
    }

    // 💬 Initialize chat store for room
    if (!chat[roomId]) {
      chat[roomId] = [];
    }

    const otherUser = room.find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('user-joined', { socketId: otherUser });
      console.log(`🔁 Sent user-joined to ${socket.id} to connect with ${otherUser}`);
    }

    console.log(`✅ ${socket.id} joined room ${roomId}`);
  });

  // 💬 Chat event
  socket.on('send-message', ({ roomId, message }) => {
    console.log(`💬 Message in room ${roomId}:`, message);

    // Store in chat array
    if (chat[roomId]) {
      chat[roomId].push({ from: socket.id, message, timestamp: Date.now() });
    }

    socket.to(roomId).emit('receive-message', message);
  });

  // 🔌 Disconnect handling
  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    const room = roomToSockets[roomId];
    if (room) {
      roomToSockets[roomId] = room.filter(id => id !== socket.id);

      if (roomToSockets[roomId].length === 0) {
        // ✅ If no users left in room, clean up everything
        delete roomToSockets[roomId];
        delete chat[roomId]; // 💬 Clean up chat memory
        console.log(`🧹 Chat data for room ${roomId} deleted`);
      }
    }

    delete socketToRoom[socket.id];

    const peers = roomToSockets[roomId] || [];
    peers.forEach(peerId => {
      io.to(peerId).emit('user-left', { socketId: socket.id });
    });

    console.log(`❌ User disconnected: ${socket.id}`);
  });
});


server.listen(5000, () => {
  console.log('🚀 Server listening on port 5000');
});