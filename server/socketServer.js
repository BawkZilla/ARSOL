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

let rooms = {};

io.on("connection", (socket) => {
    console.log(`Connected: ${socket.id}`);

    socket.on("create-room", ({ roomId, roomName, password, postContent, nickname }) => {
        rooms[roomId] = {
            roomName,
            password,
            postContent,
            hostId: socket.id,
            hostNickname: nickname,
            users: [{ id: socket.id, nickname }]
        };
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${nickname}`);
        broadcastRooms();
    });

    socket.on("get-rooms", () => sendRoomList(socket));

    socket.on("join-room", ({ roomId, password, nickname }) => {
        console.log(`join-room: ${socket.id} -> ${roomId}, pw=${password}`);
        const room = rooms[roomId];
        if (!room) return socket.emit("room-not-found");

        if (socket.id !== room.hostId && room.password !== password) {
            console.log(`Invalid password for ${roomId}`);
            return socket.emit("invalid-password");
        }

        if (socket.id === room.hostId) {
            if (!room.users.find(u => u.id === socket.id)) {
                room.users.unshift({ id: socket.id, nickname: room.hostNickname });
            }
        } else {
            room.users.push({ id: socket.id, nickname });
        }

        socket.join(roomId);

        // emit 조금 늦게 해서 join-room socket.join 완료 후 broadcast
        setTimeout(() => {
            console.log(`Emitting room-users for ${roomId}`, JSON.stringify(room.users));
            io.to(roomId).emit("room-users", {
                users: room.users,
                host: room.hostId
            });
        }, 50);

        socket.emit("join-success", { roomId });
        broadcastRooms();

        if (room.users.length === 2) {
            const expert = room.users.find(u => u.id !== room.hostId);
            if (expert) {
                console.log(`Ask host for call permission with ${expert.nickname}`);
                io.to(room.hostId).emit("ask-call-permission", { expertNickname: expert.nickname });
            }
        }
    });

    socket.on("allow-call", ({ roomId, allow }) => {
        const room = rooms[roomId];
        if (!room) return;
        const expert = room.users.find(u => u.id !== room.hostId);
        if (!expert) return;

        if (allow) {
            io.to(expert.id).emit("call-permission-result", { allow: true });
        } else {
            io.to(expert.id).emit("call-permission-result", { allow: false });
            io.to(expert.id).emit("force-leave");
            room.users = room.users.filter(u => u.id !== expert.id);
            io.to(roomId).emit("room-users", {
                users: room.users,
                host: room.hostId
            });
        }
    });

    socket.on("signal", ({ roomId, data }) => {
        console.log(`📡 signal 수신: ${data?.type || "candidate"}`);
        socket.to(roomId).emit("signal", { from: socket.id, data });
    });

    socket.on("ar-mode-change", ({ roomId, arMode }) => {
        console.log(`AR mode change in room ${roomId} from ${socket.id}. New mode: ${arMode}`);
        socket.to(roomId).emit("peer-ar-mode-changed", { arMode });
    });

    socket.on("leave-room", (roomId) => handleLeave(socket, roomId));

    socket.on("disconnect", () => {
        console.log(`Disconnected: ${socket.id}`);
        for (let roomId in rooms) handleLeave(socket, roomId);
        broadcastRooms();
    });

    function handleLeave(socket, roomId) {
        const room = rooms[roomId];
        if (!room) return;

        if (room.hostId !== socket.id) {
            room.users = room.users.filter(u => u.id !== socket.id);
        }

        if (room.hostId === socket.id) {
            console.log(`Host disconnected, closing room ${roomId}`);
            io.to(roomId).emit("room-closed");
            delete rooms[roomId];
        } else {
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
        socket.emit("rooms-updated", list);
    }

    function broadcastRooms() {
        const list = Object.keys(rooms).map(id => ({
            id,
            roomName: rooms[id].roomName,
            postContent: rooms[id].postContent,
            count: rooms[id].users.length
        }));
        io.emit("rooms-updated", list);
    }
});

setInterval(() => {
    for (const roomId in rooms) {
        io.in(roomId).allSockets().then(sockets => {
            console.log(`>> 현재 ${roomId} 방 실제 연결 소켓:`, Array.from(sockets));
            console.log(`>> 서버 기억 속 ${roomId} users 배열:`, JSON.stringify(rooms[roomId].users));
        });
    }
}, 1000);

httpServer.listen(4000,'0.0.0.0', () => {
    console.log("Server running on http://localhost:4000");
});
