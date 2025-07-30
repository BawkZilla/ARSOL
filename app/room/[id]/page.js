"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../../lib/socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Page() {
    const { id } = useParams();
    const router = useRouter();
    const remoteVideo = useRef();
    const remoteAudio = useRef();
    const pc = useRef();
    const localStream = useRef();
    const pendingCandidates = useRef([]);
    const [socketId, setSocketId] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const isHostRef = useRef(false);
    const [muted, setMuted] = useState(false);

    useEffect(() => {
        socket.on("start-call", () => {
            console.log("📞 start-call 수신 → startHostCall()");
            startHostCall();
        });
        return () => socket.off("start-call");
    }, []);

    useEffect(() => {
        socket.on("connect", () => setSocketId(socket.id));
        return () => socket.off("connect");
    }, []);

    useEffect(() => {
        if (socketId && id) {
            socket.emit("join-room", { roomId: id, password: "", nickname: "익명" });
        }
    }, [socketId, id]);

    useEffect(() => {
        socket.on("join-success", ({ isHost }) => {
            setIsHost(isHost);
            isHostRef.current = isHost;
            console.log("🎉 join-success received, isHost:", isHost);
        });

        socket.on("signal", async ({ data }) => {
            console.log("📡 signal 수신:", data);

            if (data.type === "offer") {
                await handleOffer(data);
            } else if (data.type === "answer") {
                await pc.current.setRemoteDescription(new RTCSessionDescription(data));
            } else if (data.candidate) {
                if (pc.current?.remoteDescription) {
                    await pc.current.addIceCandidate(new RTCIceCandidate(data));
                } else {
                    pendingCandidates.current.push(data);
                }
            }
        });

        socket.on("room-closed", () => {
            toast.error("방장이 방을 닫았습니다.");
            setTimeout(() => router.push("/rooms"), 2000);
        });

        return () => {
            socket.emit("leave-room", id);
            socket.off("join-success");
            socket.off("signal");
            socket.off("room-closed");
        };
    }, [id, socketId]);

    const initPeer = () => {
        if (pc.current) return;
        console.log("🧊 initPeer 실행");
        pc.current = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: "turn:relay1.expressturn.com:3478",
                    username: "efGHj2T1zXv7YR01aY2M6g==",
                    credential: "FGY2qbd9rHG+fLOq6yNB4zKq6ak="
                }
            ]
        });

        pc.current.onicecandidate = (e) => {
            if (e.candidate) {
                socket.emit("signal", { roomId: id, data: e.candidate });
            }
        };

        pc.current.ontrack = (e) => {
            console.log("📺 ontrack fired");
            if (isHostRef.current) {
                console.log("🙅 방장은 수신 무시");
                return;
            }
            console.log("✅ 참가자: 방장 화면 수신");
            remoteVideo.current.srcObject = e.streams[0];
            remoteAudio.current.srcObject = e.streams[0];
        };

        pc.current.onconnectionstatechange = () => {
            console.log("🔗 WebRTC 연결 상태:", pc.current.connectionState);
        };
    };

    const getCameraStream = async () => {
        try {
            return await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: true
            });
        } catch (err) {
            return await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
        }
    };

    const startHostCall = async () => {
        console.log("🎥 startHostCall 시작");
        try {
            const stream = await getCameraStream();
            localStream.current = stream;

            // 방장도 본인 화면 보기
            remoteVideo.current.srcObject = stream;
            remoteAudio.current.srcObject = stream;

            initPeer();
            stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            socket.emit("signal", { roomId: id, data: offer });
        } catch (err) {
            toast.error("카메라/마이크 권한을 허용해주세요.");
        }
    };

    const handleOffer = async (offer) => {
        try {
            initPeer();
            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

            const stream = await getCameraStream();
            localStream.current = stream;
            stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            socket.emit("signal", { roomId: id, data: answer });

            for (const c of pendingCandidates.current) {
                await pc.current.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current = [];
        } catch (err) {
            toast.error("카메라/마이크 권한을 허용해주세요.");
        }
    };

    const toggleMute = () => {
        if (localStream.current) {
            const enabled = !muted;
            localStream.current.getAudioTracks().forEach((track) => (track.enabled = enabled));
            setMuted(!muted);
        }
    };

    return (
        <div style={{ width: "100%", height: "100vh", background: "black", position: "relative" }}>
            <ToastContainer position="top-center" />
            <video ref={remoteVideo} autoPlay playsInline muted={isHost} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <audio ref={remoteAudio} autoPlay />
            <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
                <button onClick={toggleMute} style={btnStyle}>
                    {muted ? "마이크 켜기" : "마이크 끄기"}
                </button>
            </div>
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
    marginRight: "10px",
};