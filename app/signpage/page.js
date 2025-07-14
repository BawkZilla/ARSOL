"use client";
import { useState }           from "react";
import { useRouter }          from "next/navigation";
import { getDatabase, ref, get, set } from "firebase/database";
import { app }               from "@/lib/firebase";   
import bcrypt                 from "bcryptjs";

export default function Auth() {
  const db      = getDatabase(app);          
  const router  = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [job,      setJob]      = useState("사용자");

  /* ---------- 회원가입 ---------- */
  const handleSignup = async () => {
    if (!nickname || !password || !confirm) return alert("모든 항목 필수");
    if (password !== confirm)               return alert("비밀번호 불일치");

    const userRef = ref(db, `users/${nickname}`);
    const snap    = await get(userRef);
    if (snap.exists())                      return alert("이미 존재하는 닉네임");

    const hashed = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    await set(userRef, { password: hashed, job })
      .then(() => {
        alert("회원가입 완료! 로그인 해 주세요");
        setIsLogin(true);
        setPassword(""); setConfirm("");
      })
      .catch(err => alert("저장 오류: "+err.code));   // ⚠️ 오류 로그
  };

  /* ---------- 로그인 ---------- */
  const handleLogin = async () => {
    if (!nickname || !password) return alert("닉네임/비밀번호 입력");

    const userRef = ref(db, `users/${nickname}`);
    const snap    = await get(userRef);
    if (!snap.exists())         return alert("존재하지 않는 닉네임");

    const user = snap.val();
    if (!bcrypt.compareSync(password, user.password))
      return alert("비밀번호 오류");
    localStorage.setItem("nickname", nickname); // 로그인 이후 닉네임 저장 처리
    router.push("/rooms");
  };

  /* ---------- 스타일 ---------- */
  const inputStyle = {
    padding: "10px",
    fontSize: "1rem",
    borderRadius: "8px",
    border: "1px solid #555",
    background: "#1e1e1e",
    color: "#eee",
  };
  const btnStyle = {
    padding: "12px 24px",
    fontSize: "1rem",
    background: "#1e1e1e",
    color: "#eee",
    border: "none",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
    cursor: "pointer",
  };

  /* ---------- UI ---------- */
  return (
    <div style={{
      minHeight: "100vh",
      background: "#121212",
      color: "#eee",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "20px"
    }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>🚀 ARsol</h1>

      {/* 공통 입력: 닉네임 */}
      <input
        placeholder="닉네임 입력"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        style={inputStyle}
      />

      {/* 로그인 전용 입력 */}
      {isLogin && (
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
      )}

      {/* 회원가입 전용 입력 */}
      {!isLogin && (
        <>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={inputStyle}
          />
          <select
            value={job}
            onChange={e => setJob(e.target.value)}
            style={inputStyle}
          >
            <option value="전문가">전문가</option>
            <option value="사용자">사용자</option>
          </select>
        </>
      )}

      {/* 주요 액션 버튼 */}
      {isLogin ? (
        <button onClick={handleLogin} style={btnStyle}>로그인</button>
      ) : (
        <button onClick={handleSignup} style={btnStyle}>회원가입</button>
      )}

      {/* 보조 전환 버튼 */}
      {isLogin ? (
        <button
          onClick={() => { setIsLogin(false); setPassword(""); }}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}
        >
          회원가입 하기
        </button>
      ) : (
        <button
          onClick={() => { setIsLogin(true); setPassword(""); setConfirm(""); }}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}
        >
          로그인으로 돌아가기
        </button>
      )}
    </div>
  );
}
