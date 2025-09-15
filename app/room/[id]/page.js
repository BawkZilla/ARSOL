"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "../../../lib/socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";
import { app }               from "@/lib/firebase";  
import { getDatabase, ref, get, set } from "firebase/database";
import { supabase } from '@/lib/supabaseClient';

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
  const arCallStarted = useRef(false);
  const selectedToolRef = useRef(null);
  const peerToolRef = useRef(null);
  const textValueRef = useRef('');
  const [textValue, setTextValue] = useState('');
  const [placedAnnotations, setPlacedAnnotations] = useState([]);
  const [annotationToDelete, setAnnotationToDelete] = useState(null);
  const [clearAllTrigger, setClearAllTrigger] = useState(0);
  const [selectedAnnotationForMove, setSelectedAnnotationForMove] = useState(null);
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0, z: 0 });
  const [tempRotation, setTempRotation] = useState({ x: 0, y: 0, z: 0 });
  const db = getDatabase(app);  
  
  
  const [currentUser, setCurrentUser] = useState(null);
  const [userJob, setUserJob] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);
  const [drawData, setDrawData] = useState(null);
  const [peerClickCoords, setPeerClickCoords] = useState(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const recorderRef     = useRef(null);
  const recordedChunks  = useRef([]);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [posX, setPosX] = useState(20);
  const [posY, setPosY] = useState(20);
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const [isMobile, setIsMobile] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [arMode, setArMode] = useState(false);
  const [isPeerInArMode, setIsPeerInArMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showObjectDetail, setShowObjectDetail] = useState(false); // drawer 내 3D 오브젝트 영역 세부요소 토글

  

  async function startRecording() {

    const ok = window.confirm("화면 녹화를 시작할까요?");
    if (!ok) return; 
                          
    if (recorderRef.current) return;            

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window",        
        preferCurrentTab: true,          
        surfaceSwitching: "exclude",      
        selfBrowserSurface: "include"     
      },
      audio: true
    });

    const recorder = new MediaRecorder(displayStream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size) recordedChunks.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      recordedChunks.current = []; 
      const ts = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '');          
      const currentU = localStorage.getItem("nickname");
      const fileName = `${ts}_${id}.webm`;
      const filePath = `${currentU}/${fileName}`;          

      const { error } = await supabase.storage
        .from('recordings')                        
        .upload(filePath, blob, {
          contentType: 'video/webm',
          upsert: false                             
        });

      if (error) {
        toast.error(`Supabase 업로드 실패: ${error.message}`);
        return;
      }

     
      const { data } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath);                    

      const videoUrl = data.publicUrl;
      toast.success('Supabase 업로드 완료!');

      
    };

    recorder.start();
    recorderRef.current = recorder;
  };

  function stopRecording() {
    if (recorderRef.current) {
      recorderRef.current.stop();   
      recorderRef.current = null;
    }
  };


  const handleArStreamReady = useCallback((stream) => {
    if (arCallStarted.current) return;
    arStreamRef.current = stream;
    toast.success("AR 씬 준비 완료! 자동으로 공유를 시작합니다.");
    startArCall();
    arCallStarted.current = true;
  }, []);

  const handleAnnotationPlaced = (annotation) => {
    if (userJob !== "전문가") { 
        socket.emit('annotation-added', { roomId: id, annotation });
        placeSuccess(); 
    }
  };

  const memoizedARComponent = useMemo(() => {
    return <ARComponent 
    onStreamReady={handleArStreamReady} 
    drawData={drawData} 
    peerClickCoords={peerClickCoords} 
    selectedTool={selectedToolRef}
    peerTool={peerToolRef}
    textValue={textValueRef}
    clearSelectedTool={() => {
      toast.success("주석을 배치했습니다");
      selectedToolRef.current = null;
    }}
    onAnnotationPlaced={handleAnnotationPlaced}
    annotationToDelete={annotationToDelete}
    clearAllTrigger={clearAllTrigger}
    clearPeerTool={() => {
      peerToolRef.current = null;
      textValueRef.current = null;
    }}
    socket={socket}
     />;
  }, [handleArStreamReady, drawData, peerClickCoords, annotationToDelete, clearAllTrigger]);

  


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
    setCurrentUser(localStorage.getItem("nickname"));
  }, []);

  useEffect(() => {
    textValueRef.current = textValue;
  }, [textValue]);

  useEffect(()=> {
    const fetchJob = async () => {
      const snapshot = await get(ref(db, `users/${currentUser}/job`));
      setUserJob(snapshot.val());
    }
    fetchJob();
  }, [currentUser]);

  useEffect(() => {
    if (!id || !socketId) return;
    socket.emit("join-room", { roomId: id, password: "", nickname: "익명" });
  }, [id, socketId]);

  // Peer의 그리기 및 클릭을 위한 이벤트 핸들러
  useEffect(() => {
    const videoEl = remoteVideo.current;
    if (!isPeerInArMode || !videoEl) return;

    let isDrawing = false;
    let hasDragged = false;
    let lastSent = 0;
    let startCoords = null;

    const getCoords = (e) => {
        const rect = videoEl.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        return { x, y };
    };

    const handleMouseDown = (e) => {
        isDrawing = true;
        hasDragged = false;
        startCoords = getCoords(e);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        
        if (!hasDragged) {
            // 처음 드래그 시작 시
            hasDragged = true;
            socket.emit('draw-start', { roomId: id, coords: startCoords });
        }

        const now = Date.now();
        if (now - lastSent > 50) { // 50ms 쓰로틀링
            const coords = getCoords(e);
            socket.emit('draw-move', { roomId: id, coords });
            lastSent = now;
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        isDrawing = false;

        if (hasDragged) {
            socket.emit('draw-end', { roomId: id });
        } else {
            // 드래그 없이 클릭만 한 경우 

            socket.emit('peer-click', { roomId: id, coords: startCoords });
            
        }
    };

    videoEl.addEventListener('mousedown', handleMouseDown);
    videoEl.addEventListener('mousemove', handleMouseMove);
    videoEl.addEventListener('mouseup', handleMouseUp);
    videoEl.addEventListener('mouseleave', handleMouseUp);

    return () => {
        videoEl.removeEventListener('mousedown', handleMouseDown);
        videoEl.removeEventListener('mousemove', handleMouseMove);
        videoEl.removeEventListener('mouseup', handleMouseUp);
        videoEl.removeEventListener('mouseleave', handleMouseUp);
    }
  }, [isPeerInArMode, id]);

  const placeSuccess = () => {
    socket.emit('peer-placed', {roomId: id});
  };

  const onDrawerItemClick = (tool) => {
    if(arMode) { 
      selectedToolRef.current = tool;
    } else if(isPeerInArMode){ 
      if(tool === 'text') {
        const textV = prompt('텍스트를 입력하세요');
        if (textV) {
          setTextValue(textV); 
          socket.emit("peer-select", { roomId: id, tool: tool, text: textV });
        } else {
          return; 
        }
      } else {
        socket.emit("peer-select", { roomId: id, tool: tool, text: null });
      }
    }
     
    toast.info(`${tool} 배치 모드입니다. AR 화면을 터치하세요.`);
  };

  useEffect(() => {
    socket.on("room-users", ({ users }) => setJoined(users.length >= 2));
    socket.on("ask-call-permission", ({ expertNickname }) => setPendingCall(expertNickname));
    socket.on("peer-disconnected", () => {
      stopRecording();
      if(userJob !== "전문가") {
        setShowReviewPrompt(true);
      } else {
        toast.info("상대방이 방을 나갔습니다.");
      }
    });
    socket.on("call-permission-result", ({ allow }) => {
      if (!allow) {
        toast.error("방장이 통화를 거부했습니다.");
        setTimeout(() => router.push("/rooms"), 2000);
      }
      else{
        startRecording();
      }
    });
    socket.on("force-leave", () => {
      toast.error("방에서 내보내졌습니다.");
      setTimeout(() => router.push("/rooms"), 2000);
    });
    socket.on("room-closed", () => {
      toast.info("방장이 방을 닫았습니다.");
      stopLocalStream();
      if (pc.current) {
        pc.current.close();
      }
      stopRecording();
      console.log("방 닫힘", userJob);
      if(userJob !== "전문가") {
        setShowReviewPrompt(true);
      } else {
        router.push("/rooms");
      }
    });
    socket.on("signal", async ({ data }) => {
      if (data.type === "offer") await handlePeerOffer(data);
      else if (data.type === "answer") await pc.current.setRemoteDescription(new RTCSessionDescription(data));
      else if (data.candidate) await pc.current.addIceCandidate(new RTCIceCandidate(data));
    });
    socket.on("peer-ar-mode-changed", ({ arMode: peerArStatus }) => {
      setIsPeerInArMode(peerArStatus);
      if (peerArStatus) {
        toast.info("상대방이 AR 모드로 전환했습니다.");
      } else {
        toast.info("상대방이 웹캠 모드로 전환했습니다.");
      }
    });
    
    socket.on('tool-select', ({ tool, text }) => {
      peerToolRef.current = tool;
      textValueRef.current = text;
      console.log("주석 종류: ", peerToolRef, " 텍스트: ", textValueRef);
    });

    socket.on("place-success", () => {console.log("get success"); toast.success("주석을 배치했습니다");})

    socket.on('annotation-added', (annotation) => {
        if (userJob === "전문가") {
            setPlacedAnnotations(prev => [...prev, annotation]);
        }
    });

    socket.on('delete-annotation', ({ annotationId }) => {
        if (userJob !== "전문가") {
            setAnnotationToDelete(annotationId);
        } else {
            setPlacedAnnotations(prev => prev.filter(a => a.id !== annotationId));
        }
    });

    socket.on('delete-all-annotations', () => {
        if (userJob !== "전문가") {
            setClearAllTrigger(c => c + 1);
        } else {
            setPlacedAnnotations([]);
        }
    });

    socket.on('place-object', ({ coords }) => setPeerClickCoords(coords));
    socket.on('draw-start', ({ coords }) => setDrawData({ state: 'start', coords }));
    socket.on('draw-move', ({ coords }) => setDrawData({ state: 'move', coords }));
    socket.on('draw-end', () => setDrawData({ state: 'end' }));

    return () => {
      //leave-room은 leaveRoom() 함수에서 버튼 클릭 시에만 처리하도록 변경- FIXED BY 강유승
      socket.off("room-users");
      socket.off("ask-call-permission");
      socket.off("call-permission-result");
      socket.off("force-leave");
      socket.off("room-closed");
      socket.off("signal");
      socket.off("peer-ar-mode-changed");
      socket.off("tool-select");
      socket.off("place-object");
      socket.off("place-success");
      socket.off("draw-start");
      socket.off("draw-move");
      socket.off("draw-end");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socketId, userJob]);

  useEffect(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }, [muted]);

  const leaveRoom = () =>{
    socket.emit("leave-room", id);
    stopRecording();
    if(userJob !== "전문가")
      router.push("/reviewpage");
    else
      router.push("/rooms");
  }

  const initPeerConnection = () => {
    if (pc.current) pc.current.close();
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
      stopLocalStream();
      initPeerConnection();

      const stream = mode === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: isMobile ? { facingMode: cameraFacing } : true, audio: true });

      stream.getAudioTracks().forEach(track => track.enabled = !muted);

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
      
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        arStream.addTrack(audioTrack);
      }

      localStream.current = arStream;

      localStream.current.getTracks().forEach(track => pc.current.addTrack(track, localStream.current));

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

      stream.getAudioTracks().forEach(track => track.enabled = !muted);
      
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
    setMuted(prevMuted => !prevMuted);
  };

  const toggleFullScreen = () => {
    if (!arMode) {
      setIsFullScreen(!isFullScreen);
    }
  };

  const startDrag = (e) => {
    if (isFullScreen || arMode) return;
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
    arCallStarted.current = false;

    stopLocalStream();
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    setArMode(newArMode);
    socket.emit("ar-mode-change", { roomId: id, arMode: newArMode });

    if (!newArMode) {
      startHostCall("webcam");
      document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-loading').forEach(el => el.remove());
    }
  };

  const controlCommentsDrawer = () => setIsDrawerOpen(prev => !prev);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#121212" }}>
      <ToastContainer position="top-center" />

      <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
        {arMode ? (
          memoizedARComponent
        ) : (
          <video ref={remoteVideo} autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", cursor: isPeerInArMode ? 'crosshair' : 'default' }} />
        )}
      </div>
      <audio ref={remoteAudio} autoPlay />

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
        {(joined || userJob == "전문가") && (
          <>
            {!arMode && <button onClick={() => startHostCall("webcam")} style={btnStyle}>웹캠</button>}
            {!arMode && <button onClick={() => startHostCall("screen")} style={btnStyle}>화면 공유</button>}
            
            <button onClick={toggleMute} style={btnStyle}>{muted ? "마이크 끄기" : "마이크 끄기"}</button>
            {!isPeerInArMode && <button onClick={toggleARMode} style={btnStyle}>{arMode ? "웹캠 전환" : "AR 전환"}</button>}
            {(arMode || isPeerInArMode) && <button onClick={controlCommentsDrawer} style={btnStyle}>{isDrawerOpen ? "탭 닫기" : "주석 추가"}</button>}

            {isMobile && !arMode && (
              <>
                <button onClick={() => setCameraFacing("user")} style={btnStyle}>전면</button>
                <button onClick={() => setCameraFacing("environment")} style={btnStyle}>후면</button>
              </>
            )}
            <button onClick={()=> leaveRoom() } style={{...btnStyle, background: "#872c2cff"}}>통화 종료</button>
          </>
        )}
        {(!joined && userJob == "사용자") && <button onClick={()=> {socket.emit("delete-room", id); router.push("/rooms");} } style={{...btnStyle, background: "#872c2cff"}}>방 닫기</button>}
      </div>
      {(arMode || isPeerInArMode) && isDrawerOpen && (
        <div style={{
          position:"absolute",
          top:0,
          right: isDrawerOpen ? 0 : "-240px",
          width:"240px",
          height:"100%",
          transition:"right .3s",
          background:"#1e1e1e",
          color:"#eee",
          boxShadow:"-2px 0 6px rgba(0,0,0,.6)",
          zIndex:30,
          padding:"16px",
          overflowY:"auto"
        }}>
          <h3 style={{margin:"0 0 12px"}}>주석 도구</h3>

          <button style={drawerBtnStyle} onClick={() => onDrawerItemClick('marker')}>
            📍 마커
          </button>

          <button style={drawerBtnStyle} onClick={() => onDrawerItemClick('text')}>
            📝 텍스트
          </button>

          <button
            style={drawerBtnStyle}
            onClick={() => setShowObjectDetail(prev => !prev)}
          >
            🧊 3D 오브젝트
          </button>

          {showObjectDetail && (
            <div style={{marginLeft:"12px", marginTop:"8px", display:"flex", flexDirection:"column", gap:"6px"}}>
              <button style={subBtnStyle} onClick={() => onDrawerItemClick('cpu')}>CPU</button>
              <button style={subBtnStyle} onClick={() => onDrawerItemClick('ram')}>RAM</button>
              <button style={subBtnStyle} onClick={() => onDrawerItemClick('gpu')}>GPU</button>
            </div>
          )}

          <h3 style={{margin:"20px 0 12px"}}>배치된 주석</h3>
          <button style={{...drawerBtnStyle, background: "#872c2cff"}} onClick={() => {
              socket.emit('delete-all-annotations', { roomId: id });
              setPlacedAnnotations([]);
              toast.success("모든 주석을 삭제했습니다.");
          }}>모두 삭제</button>
          <div style={{display:"flex", flexDirection:"column", gap:"6px", marginTop:"8px"}}>
            {placedAnnotations.map(ann => (
                <div key={ann.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", background:"#3a3a3a", padding:"8px", borderRadius:"4px"}}>
                    <span>{ann.type}</span>
                    <div>
                        <button style={{background:"#c94b4b", border:"none", color:"white", padding:"4px 8px", borderRadius:"4px", cursor:"pointer", marginRight:"8px"}} onClick={() => {
                            socket.emit('delete-annotation', { roomId: id, annotationId: ann.id });
                            setPlacedAnnotations(prev => prev.filter(a => a.id !== ann.id));
                            toast.success("주석을 삭제했습니다.");
                        }}>삭제</button>
                        <button style={{background:"#4CAF50", border:"none", color:"white", padding:"4px 8px", borderRadius:"4px", cursor:"pointer"}} onClick={() => {
                            setSelectedAnnotationForMove(ann);
                            socket.emit('request-object-transform', { roomId: id, objectId: ann.id });
                        }}>이동</button>
                    </div>
                </div>
            ))}
          </div>

        </div>
      )}

      {selectedAnnotationForMove && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#2b2b2b",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
          zIndex: 40,
          width: "90%",
          maxWidth: "400px",
          color: "#eee"
        }}>
          <h4 style={{marginTop:"0", marginBottom:"10px"}}>&#39;{selectedAnnotationForMove.type}&#39; 이동/회전</h4>
          
          <div style={{marginBottom:"10px"}}>
            <label>Position X: {tempPosition.x.toFixed(2)}</label>
            <input type="range" min="-0.3" max="0.3" step="0.01" value={tempPosition.x} onChange={(e) => setTempPosition({...tempPosition, x: parseFloat(e.target.value)})} style={{width:"100%"}} />
            <label>Position Y: {tempPosition.y.toFixed(2)}</label>
            <input type="range" min="-0.3" max="0.3" step="0.01" value={tempPosition.y} onChange={(e) => setTempPosition({...tempPosition, y: parseFloat(e.target.value)})} style={{width:"100%"}} />
            <label>Position Z: {tempPosition.z.toFixed(2)}</label>
            <input type="range" min="-0.3" max="0.3" step="0.01" value={tempPosition.z} onChange={(e) => setTempPosition({...tempPosition, z: parseFloat(e.target.value)})} style={{width:"100%"}} />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label>Rotation X: {tempRotation.x.toFixed(0)}°</label>
            <input type="range" min="0" max="360" step="1" value={tempRotation.x} onChange={(e) => setTempRotation({...tempRotation, x: parseFloat(e.target.value)})} style={{width:"100%"}} />
            <label>Rotation Y: {tempRotation.y.toFixed(0)}°</label>
            <input type="range" min="0" max="360" step="1" value={tempRotation.y} onChange={(e) => setTempRotation({...tempRotation, y: parseFloat(e.target.value)})} style={{width:"100%"}} />
            <label>Rotation Z: {tempRotation.z.toFixed(0)}°</label>
            <input type="range" min="0" max="360" step="1" value={tempRotation.z} onChange={(e) => setTempRotation({...tempRotation, z: parseFloat(e.target.value)})} style={{width:"100%"}} />
          </div>

          <div style={{display:"flex", justifyContent:"space-around"}}>
            <button style={{...btnStyle, background:"#4CAF50"}} onClick={() => {
                socket.emit('update-object-transform', {
                    roomId: id,
                    objectId: selectedAnnotationForMove.id,
                    position: tempPosition,
                    rotation: tempRotation
                });
                setSelectedAnnotationForMove(null);
                toast.success("주석 위치/회전 업데이트 완료!");
            }}>적용</button>
            <button style={{...btnStyle, background:"#f44336"}} onClick={() => {
                setSelectedAnnotationForMove(null);
                
            }}>취소</button>
          </div>
        </div>
      )}

      {showReviewPrompt && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          background: "#1e1e1e", color: "#eee", padding: "20px", borderRadius: "8px", zIndex: 30
        }}>
          <div style={{ marginBottom: "10px" }}>상대방이 나갔습니다. 리뷰를 작성하시겠습니까?</div>
          <button onClick={() => router.push("/reviewpage")} style={btnStyle}>리뷰 작성</button>
          <button onClick={() => { socket.emit("review-declined", id); setShowReviewPrompt(false); }} style={{ ...btnStyle, background: "#444" }}>작성하지 않음</button>
        </div>
      )}

      {pendingCall && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          background: "#1e1e1e", color: "#eee", padding: "20px", borderRadius: "8px", zIndex: 30
        }}>
          <div style={{ marginBottom: "10px" }}>{pendingCall} 님과 통화를 시작하시겠습니까?</div>
          <button onClick={() => { startHostCall(); startRecording(); socket.emit("allow-call", { roomId: id, allow: true }); localStorage.setItem("expert", pendingCall); localStorage.setItem("id",id);/* reviewpage에서 값 초기화 필수! */ setPendingCall(null); }} style={btnStyle}>허용</button>
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


const drawerBtnStyle = {
  width:"100%",
  padding:"10px",
  marginBottom:"8px",
  textAlign:"left",
  background:"#2b2b2b",
  color:"#eee",
  border:"none",
  borderRadius:"6px",
  cursor:"pointer"
};
const subBtnStyle = {
  ...drawerBtnStyle,
  background:"#3a3a3a",
  fontSize:"0.9rem"
};