// ==== socketServer.js (Express + Socket.IO) ====
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

let rooms = {};

io.on("connection", (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);
    socket.join(roomId);
    console.log(`🔗 ${socket.id} joined ${roomId}`);

    io.to(roomId).emit("room-users", rooms[roomId]);
    broadcastRooms();
  });

  socket.on("signal", ({ roomId, data }) => {
    console.log(`📡 Signal from ${socket.id} in room ${roomId}:`, data);
    socket.to(roomId).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log(`💔 Disconnected: ${socket.id}`);
    for (let roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
      io.to(roomId).emit("room-users", rooms[roomId]);
    }
    broadcastRooms();
  });
});

app.get("/rooms", (req, res) => {
  const list = Object.keys(rooms).map(id => ({ id, count: rooms[id].length }));
  res.json(list);
});

function broadcastRooms() {
  const list = Object.keys(rooms).map(id => ({ id, count: rooms[id].length }));
  io.emit("rooms-updated", list);
}

httpServer.listen(4000, () => {
  console.log("🚀 Socket server running on http://localhost:4000");
});