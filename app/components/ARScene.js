// app/components/ARScene.js
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ARScene({ socket, roomId }) {
  const wrapRef     = useRef(null);
  const rendererRef = useRef(null);
  const testObjRef  = useRef(null);
  const lastSyncRef = useRef(0);

  const [arReady,    setArReady]    = useState(false); // XR 지원 여부
  const [arStarted,  setArStarted]  = useState(false); // 세션 시작 여부
  const [errMsg,     setErrMsg]     = useState("");

  /* ─────────── Three.js 기본 세팅 ─────────── */
  useEffect(() => {
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    wrapRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    // 모델 로드
    new GLTFLoader().load(
      "/models/testobj.glb",
      (gltf) => {
        testObjRef.current = gltf.scene;
        testObjRef.current.position.set(0, 0, -0.5);
        scene.add(testObjRef.current);
      },
      undefined,
      (e) => console.error("모델 로드 실패:", e),
    );

    // 애니메이션
    const animate = (t) => {
      if (testObjRef.current && t - lastSyncRef.current > 200) {
        lastSyncRef.current = t;
        socket.emit("xr-sync", { roomId, matrix: testObjRef.current.matrix.toArray() });
      }
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    // 소켓 수신
    const onUpdate = ({ matrix }) => {
      if (!testObjRef.current) return;
      testObjRef.current.matrix.fromArray(matrix);
      testObjRef.current.matrix.decompose(
        testObjRef.current.position,
        testObjRef.current.quaternion,
        testObjRef.current.scale,
      );
      testObjRef.current.matrixAutoUpdate = false;
    };
    socket.on("xr-update", onUpdate);

    // XR 지원 여부 확인
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported("immersive-ar").then(setArReady);
    }

    return () => {
      socket.off("xr-update", onUpdate);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      wrapRef.current?.removeChild(renderer.domElement);
    };
  }, [socket, roomId]);

  /* ─────────── ‘AR 시작’ 버튼 클릭 핸들러 ─────────── */
  const handleStartAR = async () => {
    if (!navigator.xr) {
      setErrMsg("이 기기는 WebXR을 지원하지 않습니다.");
      return;
    }
    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures : ["hit-test"],
        optionalFeatures : ["dom-overlay"],
        domOverlay       : { root: document.body },
      });
      rendererRef.current.xr.setReferenceSpaceType("local");
      rendererRef.current.xr.setSession(session);
      setArStarted(true);
    } catch (e) {
      console.error(e);
      setErrMsg(e.message);
    }
  };

  /* ─────────── UI 렌더링 ─────────── */
  return (
    <>
      <div
        ref={wrapRef}
        style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}
      />

      {/* AR 진입 전 오버레이 */}
      {!arStarted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 10,
          }}
        >
          {errMsg ? (
            <p style={{ color: "white", padding: 20 }}>{errMsg}</p>
          ) : (
            <>
              <button
                onClick={handleStartAR}
                style={{
                  padding: "12px 24px",
                  fontSize: 18,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                }}
                disabled={!arReady}
              >
                AR 시작
              </button>
              {!arReady && <p style={{ color: "white", marginTop: 12 }}>이 브라우저는 AR을 지원하지 않습니다.</p>}
            </>
          )}
        </div>
      )}
    </>
  );
}
