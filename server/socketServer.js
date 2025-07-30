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

let rooms = {}; // { roomId: { hostId, users: [ {id, nickname} ] } }

io.on("connection", (socket) => {
    console.log(`✅ Connected: ${socket.id}`);

    socket.on("create-room", ({ roomId, roomName, password, postContent, nickname }) => {
        console.log(`🟢 create-room received: ${roomId}, nickname: ${nickname}`);
        rooms[roomId] = {
            roomName,
            password,
            postContent,
            hostId: socket.id,
            users: [{ id: socket.id, nickname }]
        };
        socket.join(roomId);
        console.log(`✅ Room created: ${roomId} by ${nickname}`);
        broadcastRooms();
    });

    socket.on("get-rooms", () => {
        console.log("📥 get-rooms called");
        sendRoomList(socket);
    });

    socket.on("join-room", ({ roomId, password, nickname }) => {
        console.log(`➡️ join-room: ${socket.id} -> ${roomId}, pw=${password}`);
        const room = rooms[roomId];
        if (!room) return socket.emit("room-not-found");

        if (socket.id !== room.hostId && room.password !== password) {
            console.log(`❌ Invalid password for ${roomId}`);
            return socket.emit("invalid-password");
        }

        const isAlreadyInRoom = room.users.find(u => u.id === socket.id);
        if (!isAlreadyInRoom) {
            room.users.push({ id: socket.id, nickname });
        }

        socket.join(roomId);

        setTimeout(() => {
            console.log(`📤 Emitting room-users for ${roomId}:`, JSON.stringify(room.users));
            io.to(roomId).emit("room-users", {
                users: room.users,
                host: room.hostId
            });
        }, 50);

        socket.emit("join-success", { roomId, isHost: socket.id === room.hostId });
        broadcastRooms();

        // ✅ 중복 없는 유저 수 기준으로 판단
        const uniqueUserIds = [...new Set(room.users.map(u => u.id))];
        if (uniqueUserIds.length === 2) {
            const guest = room.users.find(u => u.id !== room.hostId);
            if (guest) {
                console.log(`📞 Triggering start-call to host ${room.hostId} with guest ${guest.nickname}`);
                io.to(room.hostId).emit("start-call");
            }
        }
    });

    socket.on("signal", ({ roomId, data }) => {
        console.log(`📡 signal 수신: ${data?.type || "candidate"}`);
        socket.to(roomId).emit("signal", { from: socket.id, data });
    });

    socket.on("leave-room", (roomId) => {
        handleLeave(socket, roomId);
    });

    socket.on("disconnect", () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        for (let roomId in rooms) {
            handleLeave(socket, roomId);
        }
        broadcastRooms();
    });

    function handleLeave(socket, roomId) {
        const room = rooms[roomId];
        if (!room) return;

        if (room.hostId === socket.id) {
            console.log(`⚠️ Host disconnected, closing room ${roomId}`);
            io.to(roomId).emit("room-closed");
            delete rooms[roomId];
        } else {
            room.users = room.users.filter(u => u.id !== socket.id);
            io.to(roomId).emit("room-users", {
                users: room.users,
                host: room.hostId
            });
            if (room.users.length === 0) delete rooms[roomId];
        }
    }

    function sendRoomList(socket) {
        const list = Object.keys(rooms).map(id => ({
            id,
            roomName: rooms[id].roomName,
            postContent: rooms[id].postContent,
            count: rooms[id].users.length
        }));
        console.log("📤 Sending rooms-updated to one client");
        socket.emit("rooms-updated", list);
    }

    function broadcastRooms() {
        const list = Object.keys(rooms).map(id => ({
            id,
            roomName: rooms[id].roomName,
            postContent: rooms[id].postContent,
            count: rooms[id].users.length
        }));
        console.log("📡 Broadcasting rooms-updated to all clients");
        io.emit("rooms-updated", list);
    }
});

setInterval(() => {
    for (const roomId in rooms) {
        io.in(roomId).allSockets().then(sockets => {
            console.log(`📊 Room ${roomId} sockets:`, Array.from(sockets));
            console.log(`📊 Room ${roomId} users memory:`, JSON.stringify(rooms[roomId].users));
        });
    }
}, 5000);

httpServer.listen(4000, "0.0.0.0", () => {
    console.log("🚀 Server running on http://localhost:4000");
});
