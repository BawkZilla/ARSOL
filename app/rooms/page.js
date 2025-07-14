"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../../lib/socket";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("전체");
  const router = useRouter();

  useEffect(() => {
    socket.emit("get-rooms");
    socket.on("rooms-updated", (updatedRooms) => {
      console.log("rooms-updated:", updatedRooms);
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("rooms-updated");
    };
  }, []);

  const getStatus = (room) => (room.count >= 2 ? "상담 중" : "대기 중");

  const tryJoinRoom = (room) => {
    if (getStatus(room) === "상담 중") return;
    const nickname = localStorage.getItem("nickname") || "익명";
    const inputPw = prompt(`${room.roomName} 방 비밀번호를 입력하세요:`);
    if (!inputPw) return;

    console.log("emit join-room", { roomId: room.id, pw: inputPw });

    socket.off("invalid-password");
    socket.off("join-success");

    socket.on("invalid-password", () => {
      console.log("invalid-password received");
      alert("비밀번호가 틀렸습니다.");
    });

    socket.on("join-success", ({ roomId }) => {
      console.log("join-success received", roomId);
      router.push(`/room/${roomId}`);
    });

    socket.emit("join-room", { roomId: room.id, password: inputPw, nickname });
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      background: "#121212",
      color: "#eee",
      padding: "20px"
    }}>
      <h2 style={{ fontSize: "2rem", marginBottom: "20px" }}>상담 방 게시판 (실시간)</h2>
      <div style={{ display: "flex", gap: "10px", marginBottom: "30px" }}>
        {["전체", "대기 중", "상담 중"].map(tag => (
          <button key={tag} onClick={() => setFilter(tag)}
            style={{
              padding: "8px 16px",
              background: filter === tag ? "#22c55e" : "#1e1e1e",
              color: "#eee",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}>
            {tag}
          </button>
        ))}
      </div>
      <button onClick={() => router.push("/create")}
        style={{
          padding: "10px 20px",
          background: "#1e1e1e",
          color: "#eee",
          border: "none",
          borderRadius: "8px",
          marginBottom: "30px",
          cursor: "pointer"
        }}>
        방 만들기
      </button>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "20px"
      }}>
        {rooms.filter(room => filter === "전체" || getStatus(room) === filter)
          .map(room => (
            <div key={room.id} onClick={() => tryJoinRoom(room)}
              style={{
                background: getStatus(room) === "상담 중" ? "#2c2c2c" : "#1e1e1e",
                borderRadius: "10px",
                padding: "20px",
                cursor: getStatus(room) === "상담 중" ? "not-allowed" : "pointer",
                color: "#eee"
              }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "8px" }}>방 이름: {room.roomName}</div>
              <div style={{ fontSize: "0.9rem", color: "#bbb", marginBottom: "6px" }}>
                게시글: {room.postContent}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#bbb", marginBottom: "6px" }}>
                현재 인원: {room.count} / 2
              </div>
              <div style={{
                marginTop: "10px",
                display: "inline-block",
                padding: "2px 6px",
                background: getStatus(room) === "상담 중" ? "#ff4444" : "#22c55e",
                borderRadius: "6px",
                fontSize: "0.8rem",
                whiteSpace: "pre-line",
                wordBreak: "keep-all",
                textAlign: "center"
              }}>{getStatus(room)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
