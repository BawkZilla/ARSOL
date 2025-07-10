import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

let rooms = {}; // roomId -> { host: socketId, users: [] }

io.on("connection", (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  socket.on("get-rooms", () => {
    const list = Object.keys(rooms).map(id => ({
      id,
      count: rooms[id].users.length
    }));
    socket.emit("rooms-updated", list);
  });

  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { host: socket.id, users: [] };
    }
    rooms[roomId].users.push(socket.id);
    socket.join(roomId);

    io.to(roomId).emit("room-users", {
      users: rooms[roomId].users,
      host: rooms[roomId].host
    });

    broadcastRooms();
    console.log(`🔗 ${socket.id} joined ${roomId}`);
  });

  socket.on("leave-room", (roomId) => {
    console.log(`👋 ${socket.id} manually left ${roomId}`);
    handleLeave(socket, roomId);
  });

  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log(`💔 Disconnected: ${socket.id}`);
    for (let roomId in rooms) {
      handleLeave(socket, roomId);
    }
    broadcastRooms();
  });

  function handleLeave(socket, roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.users = room.users.filter(id => id !== socket.id);

    if (room.host === socket.id) {
      console.log(`🚨 Host ${socket.id} left ${roomId}, closing room`);
      io.to(roomId).emit("room-closed");
      delete rooms[roomId];
    } else {
      io.to(roomId).emit("room-users", {
        users: room.users,
        host: room.host
      });
      if (room.users.length === 0) {
        delete rooms[roomId];
      }
    }
  }
});

app.get("/rooms", (req, res) => {
  const list = Object.keys(rooms).map(id => ({
    id,
    count: rooms[id].users.length
  }));
  res.json(list);
});

function broadcastRooms() {
  const list = Object.keys(rooms).map(id => ({
    id,
    count: rooms[id].users.length
  }));
  io.emit("rooms-updated", list);
}

httpServer.listen(4000, () => {
  console.log("🚀 Socket server running on http://localhost:4000");
});
