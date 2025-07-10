"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { socket } from "../../../lib/socket";

export default function Room() {
  const { id } = useParams();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const remoteAudio = useRef();
  const pc = useRef();
  const localStream = useRef();
  const [mode, setMode] = useState(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);

  // 드래그 관련
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [posX, setPosX] = useState(20);
  const [posY, setPosY] = useState(20);
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!id) return;
    socket.emit("join-room", id);

    socket.on("room-users", (users) => {
      console.log("👥 Room users:", users);
      if (users.length >= 2) setJoined(true);
    });

    return () => {
      socket.off("room-users");
    };
  }, [id]);

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        console.log(`🎚 마이크 ${track.enabled ? "ON" : "MUTE"}`, track);
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
    console.log("🎬 Switching stream to mode:", newMode);

    if (pc.current) {
      console.log("🛑 Closing existing peer connection");
      pc.current.close();
      pc.current = null;
    }
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
        console.log("🎤 마이크 트랙 추가됨:", mic.getAudioTracks());
      } catch (err) {
        console.warn("🎤 마이크 권한 거부됨:", err);
      }
    }

    console.log("✅ 최종 stream 트랙:", stream.getTracks());
    localStream.current = stream;
    localVideo.current.srcObject = stream;

    stream.getTracks().forEach(track => {
      console.log("➕ PeerConnection에 트랙 추가:", track.kind, track);
      pc.current.addTrack(track, stream);
    });

    pc.current.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("📝 ICE candidate:", e.candidate);
        socket.emit("signal", { roomId: id, data: e.candidate });
      }
    };

    pc.current.ontrack = (e) => {
      console.log("📥 ontrack event:", e.track.kind, e.streams);
      // 안전하게 video/audio 따로 다 넣기
      if (e.track.kind === "video") {
        remoteVideo.current.srcObject = e.streams[0];
      }
      if (e.track.kind === "audio") {
        remoteAudio.current.srcObject = e.streams[0];
      }
    };

    socket.on("signal", async ({ from, data }) => {
      console.log("📡 Signal from", from, ":", data);
      if (from === socket.id) return;

      if (data.type === "offer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket.emit("signal", { roomId: id, data: pc.current.localDescription });
        console.log("📤 Sent answer:", pc.current.localDescription);
      } else if (data.type === "answer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        console.log("📥 Set remote answer");
      } else if (data.candidate) {
        await pc.current.addIceCandidate(new RTCIceCandidate(data));
        console.log("🧊 Added ICE candidate");
      }
    });

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    socket.emit("signal", { roomId: id, data: pc.current.localDescription });
    console.log("📤 Sent offer:", pc.current.localDescription);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "black" }}>
      <video ref={localVideo} autoPlay muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div
        onClick={toggleFullScreen}
        onMouseDown={startDrag}
        style={{
          position: "absolute",
          top: isFullScreen ? 0 : posY,
          left: isFullScreen ? 0 : posX,
          width: isFullScreen ? "100%" : "200px",
          height: isFullScreen ? "100%" : "150px",
          border: "2px solid white",
          cursor: isFullScreen ? "pointer" : "grab",
          zIndex: 10,
          background: "black"
        }}>
        <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <audio ref={remoteAudio} autoPlay />
      </div>

      {joined && (
        <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 20 }}>
          <button onClick={() => { setMode("webcam"); startStream("webcam"); }}>웹캠 모드</button>
          <button onClick={() => { setMode("screen"); startStream("screen"); }}>화면 공유 모드</button>
          <button onClick={toggleMute}>{muted ? "마이크 켜기" : "마이크 끄기"}</button>
        </div>
      )}

      {!joined && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white", fontSize: "20px"
        }}>
          ❌ 아직 상대방이 없습니다. 상대방(전문가)을 기다리세요.
        </div>
      )}
    </div>
  );
}
