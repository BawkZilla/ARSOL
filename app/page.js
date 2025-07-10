"use client";

export default function Home() {
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
      <a href="/rooms" style={{
        textDecoration: "none"
      }}>
        <button style={{
          padding: "12px 24px",
          fontSize: "1rem",
          background: "#1e1e1e",
          color: "#eee",
          border: "none",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
          cursor: "pointer",
          transition: "0.3s"
        }}>
          방 목록 보기
        </button>
      </a>
    </div>
  );
}
