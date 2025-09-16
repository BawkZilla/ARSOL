"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "../../lib/socket";
import { ToastContainer, toast } from "react-toastify";

export default function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [postContent, setPostContent] = useState("");
  const router = useRouter();

  const handleCreate = () => {
    if (!roomName || !password || !postContent) {
      toast.error("모든 항목을 입력해주세요.");
      return;
    }
    const nickname = localStorage.getItem("nickname") || "익명";
    const roomId = Math.random().toString(36).substring(2, 8);
    socket.emit("create-room", { roomId, roomName, password, postContent, nickname });
    router.push(`/room/${roomId}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#121212", color: "#eee", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", padding: "20px" }}>
      <ToastContainer position="top-center" />
      <h1 style={{ fontSize: "2rem" }}>방 만들기</h1>
      <input type="text" placeholder="방 제목" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={inputStyle} />
      <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
      <textarea placeholder="게시물 내용" value={postContent} onChange={(e) => setPostContent(e.target.value)} style={{ ...inputStyle, height: "100px" }} />
      <button onClick={handleCreate} style={buttonStyle}>방 생성</button>
    </div>
  );
}

const inputStyle = {
  padding: "10px",
  fontSize: "1rem",
  borderRadius: "8px",
  border: "1px solid #555",
  background: "#1e1e1e",
  color: "#eee",
  width: "80%",
  maxWidth: "400px"
};
const buttonStyle = {
  padding: "12px 24px",
  fontSize: "1rem",
  background: "#1e1e1e",
  color: "#eee",
  border: "none",
  borderRadius: "10px",
  boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
  cursor: "pointer"
};
