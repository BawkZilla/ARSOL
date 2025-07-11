"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MainPage() {
  const [nickname, setNickname] = useState("");
  const router = useRouter();

  const handleLogin = () => {
    if (!nickname) return alert("닉네임을 입력하세요");
    localStorage.setItem("nickname", nickname);
    router.push("/rooms");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#121212", color: "#eee", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px" }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>🚀 ARsol</h1>
      <input type="text" placeholder="닉네임 입력" value={nickname} onChange={(e) => setNickname(e.target.value)} style={{ padding: "10px", fontSize: "1rem", borderRadius: "8px", border: "1px solid #555", background: "#1e1e1e", color: "#eee" }} />
      <button onClick={handleLogin} style={{ padding: "12px 24px", fontSize: "1rem", background: "#1e1e1e", color: "#eee", border: "none", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0,0,0,0.4)", cursor: "pointer" }}>로그인</button>
    </div>
  );
}
