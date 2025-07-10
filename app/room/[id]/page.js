"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../../lib/socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Room() {
  const { id } = useParams();
  const router = useRouter();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const remoteAudio = useRef();
  const pc = useRef();
  const localStream = useRef();
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [posX, setPosX] = useState(20);
  const [posY, setPosY] = useState(20);
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!id) return;
    socket.emit("join-room", id);

    socket.on("room-users", ({ users }) => {
      console.log("👥 Room users:", users);
      setJoined(users.length >= 2);
    });

    socket.on("room-closed", () => {
      toast.error("⚠️ 방장이 방을 나가 방이 종료되었습니다.");
      setTimeout(() => router.push("/rooms"), 2000);
    });

    return () => {
      socket.emit("leave-room", id);
      socket.off("room-users");
      socket.off("room-closed");
    };
  }, [id]);

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!muted);
    }
  };

  const toggleFullScreen = () => setIsFullScreen(!isFullScreen);

  const startDrag = (e) => {
    if (isFullScreen) return;
    setDragging(true);
    offset.current = { x: e.clientX - posX, y: e.clientY - posY };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
  };
  const onDrag = (e) => dragging && (setPosX(e.clientX - offset.current.x), setPosY(e.clientY - offset.current.y));
  const stopDrag = () => {
    setDragging(false);
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  };

  const startStream = async (newMode) => {
    if (pc.current) pc.current.close();
    socket.off("signal");

    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]
    });

    let stream;
    if (newMode === "webcam") {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } else {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream = new MediaStream(screen.getVideoTracks());
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach(track => stream.addTrack(track));
      } catch (err) {
        console.warn("🎤 마이크 권한 거부됨:", err);
      }
    }

    localStream.current = stream;
    localVideo.current.srcObject = stream;
    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    pc.current.onicecandidate = (e) => e.candidate && socket.emit("signal", { roomId: id, data: e.candidate });
    pc.current.ontrack = (e) => {
      if (e.track.kind === "video") remoteVideo.current.srcObject = e.streams[0];
      if (e.track.kind === "audio") remoteAudio.current.srcObject = e.streams[0];
    };

    socket.on("signal", async ({ from, data }) => {
      if (from === socket.id) return;
      if (data.type === "offer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket.emit("signal", { roomId: id, data: pc.current.localDescription });
      } else if (data.type === "answer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        await pc.current.addIceCandidate(new RTCIceCandidate(data));
      }
    });

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit("signal", { roomId: id, data: pc.current.localDescription });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#121212" }}>
      <ToastContainer position="top-center" />
      <video ref={localVideo} autoPlay muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      <div
        onClick={toggleFullScreen}
        onMouseDown={startDrag}
        style={{
          position: "absolute",
          top: isFullScreen ? 0 : posY,
          left: isFullScreen ? 0 : posX,
          width: isFullScreen ? "100%" : "clamp(150px, 20vw, 200px)",
          height: isFullScreen ? "100%" : "clamp(100px, 15vh, 150px)",
          border: "2px solid #eee",
          cursor: isFullScreen ? "pointer" : "grab",
          zIndex: 10,
          background: "black",
          transition: "0.3s"
        }}>
        <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <audio ref={remoteAudio} autoPlay />
      </div>

      <div style={{
        position: "absolute",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        zIndex: 20
      }}>
        {joined && (
          <>
            <button onClick={() => startStream("webcam")} style={btnStyle}>웹캠</button>
            <button onClick={() => startStream("screen")} style={btnStyle}>화면 공유</button>
            <button onClick={toggleMute} style={btnStyle}>{muted ? "마이크 켜기" : "마이크 끄기"}</button>
          </>
        )}
      </div>

      {!joined && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#eee", fontSize: "20px"
        }}>
          ❌ 아직 상대방이 없습니다. 전문가를 기다리세요.
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "8px 12px",
  background: "#1e1e1e",
  color: "#eee",
  border: "none",
  borderRadius: "8px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
  cursor: "pointer",
  transition: "0.3s"
};
