"use client";
import { useEffect, useRef, useState } from "react";
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
    const pendingCandidates = useRef([]);
    const [socketId, setSocketId] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [joined, setJoined] = useState(false);
    const [muted, setMuted] = useState(false);

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
            console.log("🎉 join-success received, isHost:", isHost);
        });

        socket.on("room-users", ({ users }) => {
            console.log("👥 room-users:", users);
            if (users.length >= 2) {
                setJoined(true);
                if (isHost) startHostCall(); // 자동 시작
            }
        });

        socket.on("signal", async ({ data }) => {
            console.log("📡 signal 수신:", data);

            if (data.type === "offer") {
                await handleOffer(data);
            } else if (data.type === "answer") {
                await pc.current.setRemoteDescription(new RTCSessionDescription(data));
                console.log("✅ remote description set (answer)");
            } else if (data.candidate) {
                if (pc.current?.remoteDescription) {
                    await pc.current.addIceCandidate(new RTCIceCandidate(data));
                    console.log("✅ ICE candidate added");
                } else {
                    console.log("🕗 ICE candidate pending");
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
            socket.off("room-users");
            socket.off("signal");
            socket.off("room-closed");
        };
    }, [id, socketId, isHost]);

    const initPeer = () => {
        if (pc.current) return;
        console.log("🧊 create new RTCPeerConnection");
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
                console.log("📡 sending ICE candidate");
                socket.emit("signal", { roomId: id, data: e.candidate });
            }
        };

        pc.current.ontrack = (e) => {
            remoteVideo.current.srcObject = e.streams[0];
            remoteAudio.current.srcObject = e.streams[0];
        };
    };

    const startHostCall = async () => {
        console.log("🎥 startHostCall 시작");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStream.current = stream;
            localVideo.current.srcObject = stream;

            initPeer();
            stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            console.log("📤 offer 전송 완료");
            socket.emit("signal", { roomId: id, data: offer });
        } catch (err) {
            console.error("🚨 host getUserMedia failed:", err);
            toast.error("카메라/마이크 권한을 허용해주세요.");
        }
    };

    const handleOffer = async (offer) => {
        try {
            initPeer();
            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
            console.log("✅ remote description set (offer)");

            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStream.current = stream;
            localVideo.current.srcObject = stream;

            stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            socket.emit("signal", { roomId: id, data: answer });

            for (const c of pendingCandidates.current) {
                await pc.current.addIceCandidate(new RTCIceCandidate(c));
                console.log("✅ 추가로 ICE candidate 적용");
            }
            pendingCandidates.current = [];
        } catch (err) {
            console.error("🚨 peer getUserMedia failed:", err);
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
            <video ref={remoteVideo} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <audio ref={remoteAudio} autoPlay />

            <video
                ref={localVideo}
                autoPlay
                muted
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    width: "clamp(120px, 20vw, 200px)",
                    height: "auto",
                    border: "2px solid #eee",
                    zIndex: 10,
                }}
            />

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
