"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../../lib/socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";
const ARScene = dynamic(() => import("../../components/ARScene"), { ssr: false });

export default function Room() {
    const { id } = useParams();
    const router = useRouter();
    const localVideo = useRef();
    const remoteVideo = useRef();
    const remoteAudio = useRef();
    const pc = useRef();
    const localStream = useRef();
    

    const [socketId, setSocketId] = useState(null);
    const [joined, setJoined] = useState(false);
    const [muted, setMuted] = useState(false);
    const [pendingCall, setPendingCall] = useState(null);
    const [showAR, setShowAR] = useState(false);// Added by 강유승

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [posX, setPosX] = useState(20);
    const [posY, setPosY] = useState(20);
    const [dragging, setDragging] = useState(false);
    const offset = useRef({ x: 0, y: 0 });

    const [isMobile, setIsMobile] = useState(false);
    const [cameraFacing, setCameraFacing] = useState("environment");

    useEffect(() => {
        const ua = navigator.userAgent;
        if (/Android|iPhone|iPad|iPod/i.test(ua)) {
            setIsMobile(true);
        }
    }, []);

    useEffect(() => {
        socket.on("connect", () => {
            console.log("My socket.id:", socket.id);
            setSocketId(socket.id);
        });
    }, []);

    useEffect(() => {
        if (!id || !socketId) return;
        socket.emit("join-room", { roomId: id, password: "", nickname: "익명" });
    }, [id, socketId]);

    useEffect(() => {
        return () => {
            socket.emit("leave-room", id);
            router.push("/rooms");
        };
    }, [id]);
   
    

    useEffect(() => {
        if (!id) return;

        socket.on("room-users", ({ users }) => {
            console.log("🔥 room-users:", users);
            setJoined(users.length >= 2);
        });

        socket.on("ask-call-permission", ({ expertNickname }) => {
           console.log("ask-call-permission:", expertNickname);
           setPendingCall(expertNickname);
        });

        socket.on("call-permission-result", ({ allow }) => {
            console.log("call-permission-result:", allow);
            if (allow) {
                startStream("webcam"); 
                setShowAR(true);
            } else {
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

        socket.on("signal", async ({ from, data }) => {
            console.log("signal received", data);
            if (!pc.current) return;

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

        return () => {
            socket.emit("leave-room", id);
            socket.off("room-users");
            socket.off("ask-call-permission");
            socket.off("call-permission-result");
            socket.off("force-leave");
            socket.off("room-closed");
            socket.off("signal");
        };
    }, [id, socketId]);

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

    const startStream = async (newMode) => {
        console.log("startStream", newMode, "cameraFacing:", cameraFacing);

        let stream;
        if (newMode === "webcam") {
            stream = await navigator.mediaDevices.getUserMedia({
                video: isMobile ? { facingMode: { exact: cameraFacing } } : true,
                audio: true
            });
        } else {
            const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
            stream = new MediaStream(screen.getVideoTracks());
            try {
                const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
                mic.getAudioTracks().forEach(track => stream.addTrack(track));
            } catch (err) {
                console.warn("마이크 권한 거부됨:", err);
            }
        }

        localStream.current = stream;
        localVideo.current.srcObject = stream;

        if (!pc.current) {
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

            pc.current.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log("onicecandidate sending candidate", e.candidate);
                    socket.emit("signal", { roomId: id, data: e.candidate });
                }
            };

            pc.current.ontrack = (e) => {
                console.log("ontrack received", e.streams);
                if (localStream.current && e.streams[0].id === localStream.current.id) {
                    console.log("내 stream, 무시");
                    return;
                }
                remoteVideo.current.srcObject = e.streams[0];
                remoteAudio.current.srcObject = e.streams[0];
            };
        }

        const senders = pc.current.getSenders();
        stream.getTracks().forEach(track => {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
                sender.replaceTrack(track);
            } else {
                pc.current.addTrack(track, stream);
            }
        });

        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        socket.emit("signal", { roomId: id, data: pc.current.localDescription });
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", background: "#121212" }}>
            <ToastContainer position="top-center" />
            {showAR && <ARScene socket={socket} roomId={id} />}
            <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <audio ref={remoteAudio} autoPlay />

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
                <video ref={localVideo} autoPlay muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <div style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "10px",
                zIndex: 20
            }}>
                {joined && (
                    <>
                        <button onClick={() => startStream("webcam")} style={btnStyle}>웹캠</button>
                        <button onClick={() => startStream("screen")} style={btnStyle}>화면 공유</button>
                        <button onClick={toggleMute} style={btnStyle}>{muted ? "마이크 켜기" : "마이크 끄기"}</button>
                        {isMobile && (
                            <>
                                <button onClick={() => setCameraFacing("user")} style={btnStyle}>전면 카메라</button>
                                <button onClick={() => setCameraFacing("environment")} style={btnStyle}>후면 카메라</button>
                            </>
                        )}
                    </>
                )}
            </div>

            {pendingCall && (
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "#1e1e1e", color: "#eee",
                    padding: "20px", borderRadius: "8px", zIndex: 30
                }}>
                    <div style={{ marginBottom: "10px" }}>
                        {pendingCall} 님과 통화를 시작하시겠습니까?
                    </div>
                    <button onClick={() => {
                        startStream("camera"); 
                        setShowAR(true);
                        socket.emit("allow-call", { roomId: id, allow: true });
                        setPendingCall(null);
                    }} style={btnStyle}>허용</button>
                    <button onClick={() => {
                        socket.emit("allow-call", { roomId: id, allow: false });
                        setPendingCall(null);
                    }} style={{ ...btnStyle, background: "#444" }}>거부</button>
                </div>
            )}

            {!joined && (
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "#eee", fontSize: "20px"
                }}>
                    상대방을 기다리고 있습니다...
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
