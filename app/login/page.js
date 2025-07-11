"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, child, get } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import bcrypt from "bcryptjs";

export default function Login() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const router      = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();

    const snap = await get(child(ref(rtdb), `users/${id}`));
    if (!snap.exists()) {
      alert("없는 아이디입니다");
      return;
    }

    const { pwHash, role } = snap.val();
    const ok = bcrypt.compareSync(pw, pwHash);
    if (!ok) {
      alert("비밀번호가 틀렸습니다");
      return;
    }

    // 간단한 세션 처리 (예시)
    localStorage.setItem("loginUser", id);
    localStorage.setItem("loginRole", role);

    router.push("/rooms");
  };

  return (
    <div style={wrapper}>
      <h2 style={title}>로그인</h2>

      <form onSubmit={handleLogin} style={form}>
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

        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          <button type="submit" style={primaryBtn}>
            로그인
          </button>

          <button
            type="button"
            onClick={() => router.push("/signup")}
            style={secondaryBtn}
          >
            회원가입
          </button>
        </div>
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

const form  = { width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 };

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
  flex: 1,
  padding: "14px 0",
  background: "#22c55e",
  color: "#121212",
  fontWeight: 600,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const secondaryBtn = {
  flex: 1,
  padding: "14px 0",
  background: "#1e1e1e",
  color: "#eee",
  fontWeight: 600,
  border: "1px solid #333",
  borderRadius: 10,
  cursor: "pointer",
};
