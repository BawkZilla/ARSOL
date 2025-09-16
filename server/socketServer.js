import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingInterval: 30000, 
    pingTimeout: 60000   
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
            users: [{ id: socket.id, nickname }],
            pendingReview: false
        };
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${nickname}`);
        broadcastRooms();
    });

    socket.on("get-rooms", () => sendRoomList(socket));

    socket.on("join-room", ({ roomId, password, nickname }) => {
        console.log(`join-room: ${socket.id} -> ${roomId}, pw=${password}`);
        const room = rooms[roomId];
        if (!room || room.pendingReview) return socket.emit("room-not-found");

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

    socket.on('peer-click', ({ roomId, coords }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('place-object', { coords });
        }
    });

    socket.on('peer-select',({ roomId, tool, text }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('tool-select', { tool, text });
        }
    });

    socket.on('peer-placed',({roomId}) => {
        console.log("get success");
        socket.to(roomId).emit('place-success');
    });

    socket.on('annotation-added', ({ roomId, annotation }) => {
        socket.to(roomId).emit('annotation-added', annotation);
    });

    socket.on('delete-annotation', ({ roomId, annotationId }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('delete-annotation', { annotationId });
        }
    });

    socket.on('delete-all-annotations', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('delete-all-annotations');
        }
    });

    socket.on('update-object-transform', ({ roomId, objectId, position, rotation }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('update-object-transform', { objectId, position, rotation });
        }
    });

    socket.on('request-object-transform', ({ roomId, objectId }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            io.to(room.hostId).emit('request-object-transform', { objectId });
        }
    });

    socket.on('send-object-transform', ({ roomId, objectId, position, rotation }) => {
        const room = rooms[roomId];
        if (room && room.users) {
            const specialist = room.users.find(u => u.id !== room.hostId);
            if (specialist) {
                io.to(specialist.id).emit('send-object-transform', { objectId, position, rotation });
            }
        }
    });

    const forwardToHost = (eventName) => {
        socket.on(eventName, ({ roomId, ...rest }) => {
            const room = rooms[roomId];
            if (room && room.hostId) {
                io.to(room.hostId).emit(eventName, rest);
            }
        });
    };

    forwardToHost('draw-start');
    forwardToHost('draw-move');
    forwardToHost('draw-end');

    socket.on("leave-room", (roomId) => {
        handleLeave(socket, roomId);
        broadcastRooms();
    });

    socket.on("delete-room", (roomId) => {
        console.log(`Host disconnected, closing room ${roomId}`);
        delete rooms[roomId];
        broadcastRooms();
    });

    socket.on("review-declined", (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.pendingReview = false;
            broadcastRooms();
        }
    });

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
            room.pendingReview = true;
            io.to(roomId).emit("room-users", {
                users: room.users,
                host: room.hostId
            });
            io.to(roomId).emit("peer-disconnected");
            if (room.users.length === 0) delete rooms[roomId];
        }
    }

    function getRoomList() {
        return Object.keys(rooms)
            .filter(id => !rooms[id].pendingReview) // Filter rooms
            .map(id => ({
                id,
                roomName: rooms[id].roomName,
                postContent: rooms[id].postContent,
                count: rooms[id].users.length
            }));
    }

    function sendRoomList(socket) {
        socket.emit("rooms-updated", getRoomList());
    }

    function broadcastRooms() {
        io.emit("rooms-updated", getRoomList());
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