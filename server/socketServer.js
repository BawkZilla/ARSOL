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

let rooms = {};  // roomId -> { host: socketId, users: [] }

io.on("connection", (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

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

  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);

    for (let roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.users.indexOf(socket.id);

      if (idx !== -1) {
        room.users.splice(idx, 1);

        // 방장이 나가면 방을 폭파
        if (room.host === socket.id) {
          console.log(`🚨 Host ${socket.id} left ${roomId}, closing room`);
          io.to(roomId).emit("room-closed");
          delete rooms[roomId];
        } else {
          // 나머지 유저만 있는 경우 상태 갱신
          io.to(roomId).emit("room-users", {
            users: room.users,
            host: room.host
          });

          // 방에 아무도 없으면 방 삭제
          if (room.users.length === 0) {
            delete rooms[roomId];
          }
        }
      }
    }

    broadcastRooms();
  });
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
