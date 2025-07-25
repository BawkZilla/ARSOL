"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../../lib/socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";

const ARComponent = dynamic(
  () => import("../../components/ARComponent"),
  { ssr: false }
);

export default function Room() {
  const { id } = useParams();
  const router = useRouter();
  const localVideo = useRef();
  const remoteVideo = useRef();
  const remoteAudio = useRef();
  const pc = useRef(null);
  const localStream = useRef();

  const [socketId, setSocketId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);
  const [arMode, setArMode] = useState(false);
  
  const [isMobile, setIsMobile] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    socket.on("connect", () => setSocketId(socket.id));
    return () => socket.off("connect");
  }, []);

  useEffect(() => {
    if (!id || !socketId) return;
    socket.emit("join-room", { roomId: id, password: "", nickname: "익명" });

    socket.on("room-users", ({ users }) => setJoined(users.length >= 2));
    socket.on("ask-call-permission", ({ expertNickname }) => setPendingCall(expertNickname));
    socket.on("call-permission-result", ({ allow }) => {
      if (!allow) {
        toast.error("방장이 통화를 거부했습니다.");
        setTimeout(() => router.push("/rooms"), 2000);
      }
    });
    socket.on("force-leave", () => {
      toast.error("방에서 내보내졌습니다.");
      setTimeout(() => router.push("/rooms"), 2000);
    });
    socket.on("room-closed", () => {
      toast.error("방장이 방을 닫았습니다.");
      setTimeout(() => router.push("/rooms"), 2000);
    });
    socket.on("signal", async ({ data }) => {
      if (!pc.current) initPeerConnection();
      if (data.type === "offer") await handlePeerOffer(data);
      else if (data.type === "answer") await pc.current.setRemoteDescription(new RTCSessionDescription(data));
      else if (data.candidate) await pc.current.addIceCandidate(new RTCIceCandidate(data));
    });

    return () => {
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      socket.emit("leave-room", id);
      socket.off("room-users");
      socket.off("ask-call-permission");
      socket.off("call-permission-result");
      socket.off("force-leave");
      socket.off("room-closed");
      socket.off("signal");
    };
  }, [id, socketId, router]);

  const initPeerConnection = () => {
    if (pc.current) pc.current.close();
    console.log("Initializing Peer Connection");
    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      ],
    });
    pc.current.onicecandidate = (e) => {
      if (e.candidate) socket.emit("signal", { roomId: id, data: e.candidate });
    };
    pc.current.ontrack = (e) => {
      if (remoteVideo.current && remoteVideo.current.srcObject !== e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
        remoteAudio.current.srcObject = e.streams[0];
        console.log("Remote stream received");
      }
    };
  };

  const startCall = async (stream) => {
    localStream.current = stream;
    if (localVideo.current && !arMode) {
        localVideo.current.srcObject = stream;
    }
    initPeerConnection();
    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

    try {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        socket.emit("signal", { roomId: id, data: offer });
        console.log("Offer sent");
    } catch (err) {
        console.error("Error creating offer:", err);
    }
  };

  const startHostCall = async (mode = "webcam") => {
    try {
      setArMode(false);
      const constraints = mode === "webcam" ? { video: isMobile ? { facingMode: cameraFacing } : true, audio: true } : undefined;
      const stream = mode === "screen" ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) : await navigator.mediaDevices.getUserMedia(constraints);
      startCall(stream);
    } catch (err) {
      console.error("🚨 host getUserMedia failed:", err);
      toast.error("카메라/마이크 권한을 허용해주세요.");
    }
  };

  const handlePeerOffer = async (offer) => {
    try {
      initPeerConnection();
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("signal", { roomId: id, data: answer });
      console.log("Answer sent");
    } catch (err) {
      console.error("🚨 peer getUserMedia failed:", err);
      toast.error("카메라/마이크 권한을 허용해주세요.");
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
      setMuted(!muted);
    }
  };

  const toggleARMode = () => {
    if (!arMode) {
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      setArMode(true);
    } else {
      setArMode(false);
      startHostCall("webcam"); // Switch back to webcam view when turning off AR
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#121212" }}>
      <ToastContainer position="top-center" />
      
      {arMode ? (
        <ARComponent onStreamReady={startCall} />
      ) : (
        <>
          <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <audio ref={remoteAudio} autoPlay />
          <div style={{ position: "absolute", top: 20, left: 20, width: "200px", border: "1px solid white", zIndex: 10 }}>
            <video ref={localVideo} autoPlay muted style={{ width: "100%", height: "100%" }} />
          </div>
        </>
      )}

      <div style={{
        position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: "10px", zIndex: 20
      }}>
        {joined && (
          <>
            <button onClick={() => startHostCall("webcam")} style={btnStyle}>웹캠</button>
            <button onClick={() => startHostCall("screen")} style={btnStyle}>화면 공유</button>
            <button onClick={toggleARMode} style={btnStyle}>{arMode ? "AR 끄기" : "AR 켜기"}</button>
            <button onClick={toggleMute} style={btnStyle}>{muted ? "마이크 켜기" : "마이크 끄기"}</button>
            {isMobile && (
              <>
                <button onClick={() => setCameraFacing("user")} style={btnStyle}>전면</button>
                <button onClick={() => setCameraFacing("environment")} style={btnStyle}>후면</button>
              </>
            )}
          </>
        )}
      </div>

      {pendingCall && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          background: "#1e1e1e", color: "#eee", padding: "20px", borderRadius: "8px", zIndex: 30
        }}>
          <div style={{ marginBottom: "10px" }}>{pendingCall} 님과 통화를 시작하시겠습니까?</div>
          <button onClick={() => { startHostCall("webcam"); socket.emit("allow-call", { roomId: id, allow: true }); setPendingCall(null); }} style={btnStyle}>허용</button>
          <button onClick={() => { socket.emit("allow-call", { roomId: id, allow: false }); setPendingCall(null); }} style={{ ...btnStyle, background: "#444" }}>거부</button>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "8px 12px", background: "#1e1e1e", color: "#eee", border: "none",
  borderRadius: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.4)", cursor: "pointer", transition: "0.3s"
};

