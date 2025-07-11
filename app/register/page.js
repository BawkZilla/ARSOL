"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, child, get, set } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import bcrypt from "bcryptjs";

export default function Signup() {
  const [id, setId]     = useState("");
  const [pw, setPw]     = useState("");
  const [role, setRole] = useState("client");   // 'client' | 'expert'
  const router          = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!id.trim() || !pw.trim()) {
      alert("모든 칸을 채워 주세요");
      return;
    }

    const userRef = child(ref(rtdb), `users/${id}`);

    // 이미 존재하는 아이디 확인
    if ((await get(userRef)).exists()) {
      alert("이미 존재하는 아이디입니다");
      return;
    }

    // 비밀번호 salting + 해싱
    const pwHash = bcrypt.hashSync(pw, 10);

    // RTDB에 저장
    await set(userRef, { role, pwHash });

    alert("회원가입 완료! 로그인해 주세요");
    router.push("/login");
  };

  return (
    <div style={wrapper}>
      <h2 style={title}>회원가입</h2>

      <form onSubmit={handleSignup} style={form}>
        <input
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          style={input}
          required
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={input}
          required
        />

        {/* 역할 선택 */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ ...input, padding: "12px 14px" }}
        >
          <option value="client">고객</option>
          <option value="expert">전문가</option>
        </select>

        <button type="submit" style={primaryBtn}>
          회원가입
        </button>
      </form>
    </div>
  );
}

/* ---------- 인라인 스타일 ---------- */
const wrapper = {
  minHeight: "100vh",
  background: "#121212",
  color: "#eee",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "0 20px",
};

const title = { fontSize: "2rem", marginBottom: "28px" };

const form = { width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 };

const input = {
  width: "100%",
  padding: "14px 16px",
  background: "#1e1e1e",
  border: "1px solid #333",
  borderRadius: 10,
  color: "#eee",
  fontSize: "1rem",
};

const primaryBtn = {
  width: "100%",
  padding: "14px 0",
  background: "#22c55e",
  color: "#121212",
  fontWeight: 600,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  marginTop: 4,
};
