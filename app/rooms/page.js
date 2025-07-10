"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../../lib/socket";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("전체");
  const router = useRouter();

  useEffect(() => {
    fetch("http://localhost:4000/rooms")
      .then(res => res.json())
      .then(setRooms)
      .catch(err => console.error("방 목록 불러오기 실패:", err));

    socket.on("rooms-updated", (updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("rooms-updated");
    };
  }, []);

  const createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    router.push(`/room/${roomId}`);
  };

  const getStatus = (room) => {
    return room.count >= 2 ? "상담 중" : "대기 중";
  };

  const filteredRooms = rooms.filter(room => {
    const status = getStatus(room);
    return filter === "전체" || status === filter;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#121212",
      color: "#eee",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <h2 style={{ fontSize: "2rem", marginBottom: "20px" }}>🚀 상담 게시판</h2>
      
      {/* 필터 버튼 */}
      <div style={{
        display: "flex",
        gap: "10px",
        marginBottom: "30px",
        flexWrap: "wrap",
        justifyContent: "center"
      }}>
        {["전체", "대기 중", "상담 중"].map(tag => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            style={{
              padding: "8px 16px",
              background: filter === tag ? "#22c55e" : "#1e1e1e",
              color: "#eee",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              transition: "0.3s"
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      <button
        onClick={createRoom}
        style={{
          padding: "10px 20px",
          marginBottom: "30px",
          background: "#1e1e1e",
          color: "#eee",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          transition: "0.3s"
        }}
        onMouseOver={(e) => e.currentTarget.style.background = "#333"}
        onMouseOut={(e) => e.currentTarget.style.background = "#1e1e1e"}
      >
        ➕ 방 만들기
      </button>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        width: "100%",
        maxWidth: "900px"
      }}>
        {filteredRooms.length === 0 && (
          <div style={{ textAlign: "center", color: "#aaa" }}>해당 조건의 방이 없습니다.</div>
        )}

        {filteredRooms.map(room => {
          const status = getStatus(room);
          const isFull = status === "상담 중";
          return (
            <div
              key={room.id}
              onClick={() => {
                if (!isFull) {
                  router.push(`/room/${room.id}`);
                }
              }}
              style={{
                background: isFull ? "#2c2c2c" : "#1e1e1e",
                borderRadius: "10px",
                padding: "20px",
                color: isFull ? "#888" : "#eee",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                transition: "transform 0.3s, box-shadow 0.3s",
                cursor: isFull ? "not-allowed" : "pointer"
              }}
              onMouseOver={(e) => {
                if (!isFull) {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.6)";
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
              }}
            >
              <div style={{ fontSize: "1.2rem" }}>🔗 방 ID: {room.id}</div>
              <div style={{ fontSize: "0.9rem", color: "#bbb" }}>
                현재 인원: {room.count} / 2
              </div>
              <div style={{
                marginTop: "auto",
                alignSelf: "flex-start",
                padding: "4px 8px",
                background: status === "상담 중" ? "#ff4444" : "#22c55e",
                borderRadius: "6px",
                fontSize: "0.8rem"
              }}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
