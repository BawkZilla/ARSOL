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
  const pc = useRef();
  const localStream = useRef();
  const arStreamRef = useRef(null);

  const [socketId, setSocketId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [posX, setPosX] = useState(20);
  const [posY, setPosY] = useState(20);
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const [isMobile, setIsMobile] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [arMode, setArMode] = useState(false); // 내 AR 모드 상태
  const [isPeerInArMode, setIsPeerInArMode] = useState(false); // 상대방 AR 모드 상태

  // ARComponent로부터 stream이 준비되면 호출될 콜백
  const handleArStreamReady = (stream) => {
    arStreamRef.current = stream;
    toast.success("AR 씬 준비 완료! 자동으로 공유를 시작합니다.");
    startArCall(); // 스트림이 준비되면 바로 통화 시작
  };

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        setIsMobile(true);
      }
    }
  }, []);

  useEffect(() => {
    socket.on("connect", () => setSocketId(socket.id));
    return () => socket.off("connect");
  }, []);

  useEffect(() => {
    if (!id || !socketId) return;
    socket.emit("join-room", { roomId: id, password: "", nickname: "익명" });
  }, [id, socketId]);

  useEffect(() => {
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
      if (data.type === "offer") await handlePeerOffer(data);
      else if (data.type === "answer") await pc.current.setRemoteDescription(new RTCSessionDescription(data));
      else if (data.candidate) await pc.current.addIceCandidate(new RTCIceCandidate(data));
    });
    // 상대방의 AR 모드 변경을 감지
    socket.on("peer-ar-mode-changed", ({ arMode: peerArStatus }) => {
      setIsPeerInArMode(peerArStatus);
      if (peerArStatus) {
        toast.info("상대방이 AR 모드로 전환했습니다.");
      } else {
        toast.info("상대방이 웹캠 모드로 전환했습니다.");
      }
    });

    return () => {
      socket.emit("leave-room", id);
      socket.off("room-users");
      socket.off("ask-call-permission");
      socket.off("call-permission-result");
      socket.off("force-leave");
      socket.off("room-closed");
      socket.off("signal");
      socket.off("peer-ar-mode-changed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socketId]);

  const initPeerConnection = () => {
    if (pc.current) pc.current.close(); // 기존 연결이 있다면 닫기
    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });
    pc.current.onicecandidate = (e) => {
      if (e.candidate) socket.emit("signal", { roomId: id, data: e.candidate });
    };
    pc.current.ontrack = (e) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
      if (remoteAudio.current) remoteAudio.current.srcObject = e.streams[0];
    };
  };

  const startHostCall = async (mode = "webcam") => {
    try {
      stopLocalStream(); // 기존 스트림 정리
      initPeerConnection();

      const stream = mode === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: isMobile ? { facingMode: cameraFacing } : true, audio: true });

      localStream.current = stream;
      if(localVideo.current) localVideo.current.srcObject = stream;

      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit("signal", { roomId: id, data: offer });

    } catch (err) {
      console.error("🚨 host getUserMedia failed:", err);
      toast.error("카메라/마이크 권한을 허용해주세요.");
    }
  };

  const startArCall = async () => {
    if (!arStreamRef.current) {
      toast.error("AR 씬이 아직 준비되지 않았습니다.");
      return;
    }
    try {
      stopLocalStream();
      initPeerConnection();

      const arStream = arStreamRef.current;
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const combinedStream = new MediaStream([
        ...arStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);

      localStream.current = combinedStream;

      combinedStream.getTracks().forEach(track => pc.current.addTrack(track, combinedStream));

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit("signal", { roomId: id, data: offer });

    } catch (err) {
      console.error("🚨 AR Call failed:", err);
      toast.error("AR 공유에 실패했습니다. 마이크 권한을 확인해주세요.");
    }
  };

  const handlePeerOffer = async (offer) => {
    try {
      initPeerConnection();
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isMobile ? { facingMode: cameraFacing } : true,
        audio: true
      });
      localStream.current = stream;
      if(localVideo.current) localVideo.current.srcObject = stream;
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("signal", { roomId: id, data: answer });

    } catch (err) {
      console.error("🚨 peer getUserMedia failed:", err);
      toast.error("카메라/마이크 권한을 허용해주세요.");
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!muted);
    }
  };

  const toggleFullScreen = () => {
    if (!arMode) {
      setIsFullScreen(!isFullScreen);
    }
  };

  const startDrag = (e) => {
    if (isFullScreen || arMode) return; // AR 모드에서는 드래그 방지
    setDragging(true);
    offset.current = { x: e.clientX - posX, y: e.clientY - posY };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
  };
  const onDrag = (e) => {
    if (dragging) {
      setPosX(e.clientX - offset.current.x);
      setPosY(e.clientY - offset.current.y);
    }
  };
  const stopDrag = () => {
    setDragging(false);
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  };

  const stopLocalStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
      if(localVideo.current) localVideo.current.srcObject = null;
    }
  };

  const toggleARMode = () => {
    const newArMode = !arMode;
    // AR 모드 변경 시 스트림 및 연결 초기화
    stopLocalStream();
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    setArMode(newArMode);
    // 변경된 AR 상태를 상대방에게 알림
    socket.emit("ar-mode-change", { roomId: id, arMode: newArMode });

    // 웹캠 모드로 돌아올 때, 자동으로 웹캠 통화 시작
    if (!newArMode) {
      startHostCall("webcam");
      // MindAR UI 오버레이 제거
      const mindarContainer = document.querySelector(".mindar-ui-overlay");
      if (mindarContainer) {
        mindarContainer.remove();
      }
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#121212" }}>
      <ToastContainer position="top-center" />

      {/* --- 메인 비디오 영역 --- */}
      <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
        {arMode ? (
          <ARComponent onStreamReady={handleArStreamReady} />
        ) : (
          <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <audio ref={remoteAudio} autoPlay />

      {/* --- 로컬 비디오 영역 --- */}
      {!arMode && (
        <div onClick={toggleFullScreen} onMouseDown={startDrag} style={{
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
          <video ref={localVideo} autoPlay muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{
        position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: "10px", zIndex: 20
      }}>
        {joined && (
          <>
            {!arMode && <button onClick={() => startHostCall("webcam")} style={btnStyle}>웹캠</button>}
            {!arMode && <button onClick={() => startHostCall("screen")} style={btnStyle}>화면 공유</button>}
            
            <button onClick={toggleMute} style={btnStyle}>{muted ? "마이크 켜기" : "마이크 끄기"}</button>
            <button onClick={toggleARMode} style={btnStyle}>{arMode ? "웹캠 전환" : "AR 전환"}</button>
            
            {isMobile && !arMode && (
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
          <button onClick={() => { startHostCall(); socket.emit("allow-call", { roomId: id, allow: true }); setPendingCall(null); }} style={btnStyle}>허용</button>
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
