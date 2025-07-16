// app/components/ARScene.js
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * WebXR + Three.js 씬.
 * - testobj.glb 모델을 로드하여 (0,0,-0.5) 위치에 배치
 * - 200 ms 간격으로 모델의 transform matrix를 소켓으로 송신
 * - 다른 참가자에게서 matrix를 수신하면 동일하게 적용
 *
 * props:
 *   socket  : socket.io-client 인스턴스
 *   roomId  : 현재 방 ID
 */
export default function ARScene({ socket, roomId }) {
  const wrapRef     = useRef(null);          // 렌더러 DOM을 넣을 div
  const rendererRef = useRef(null);
  const testObjRef  = useRef(null);          // glTF 모델의 루트 노드
  const lastSyncRef = useRef(0);             // 마지막 송신 시각(ms)

  useEffect(() => {
    /* ───────────────── Three.js 기본 구성 ───────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      20,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    wrapRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    /* 조명 */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    /* ───────────── testobj.glb 모델 불러오기 ───────────── */
    const loader = new GLTFLoader();
    loader.load(
      "/models/testobj.glb",
      (gltf) => {
        testObjRef.current = gltf.scene;
        testObjRef.current.position.set(0, 0, -0.5); // 카메라 앞 50 cm
        scene.add(testObjRef.current);
      },
      undefined,
      (err) => console.error("testobj.glb 로드 실패:", err),
    );

    /* ───────────────── XR 세션 요청 ───────────────── */
    if (navigator.xr) {
      navigator.xr
        .requestSession("immersive-ar", {
          requiredFeatures: ["hit-test"],
          domOverlay: { root: document.body },
        })
        .then((session) => {
          renderer.xr.setReferenceSpaceType("local");
          renderer.xr.setSession(session);
        })
        .catch((err) => console.warn("XR 세션 실패:", err));
    } else {
      console.warn("WebXR not supported");
    }

    /* ───────────────── 애니메이션 루프 ───────────────── */
    const animate = (time) => {
      /* 200 ms 마다 본인 transform 전송 */
      if (
        testObjRef.current &&
        time - lastSyncRef.current > 200
      ) {
        lastSyncRef.current = time;
        socket.emit("xr-sync", {
          roomId,
          matrix: testObjRef.current.matrix.toArray(),
        });
      }

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    /* ───────────────── 소켓 이벤트 ───────────────── */
    const onRemoteUpdate = ({ matrix }) => {
      if (!testObjRef.current) return;
      testObjRef.current.matrix.fromArray(matrix);
      testObjRef.current.matrix.decompose(
        testObjRef.current.position,
        testObjRef.current.quaternion,
        testObjRef.current.scale,
      );
      testObjRef.current.matrixAutoUpdate = false;
    };
    socket.on("xr-update", onRemoteUpdate);

    /* ───────────────── 클린업 ───────────────── */
    return () => {
      socket.off("xr-update", onRemoteUpdate);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      wrapRef.current?.removeChild(renderer.domElement);
    };
  }, [socket, roomId]);

  /* 렌더러가 삽입될 컨테이너 */
  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none", // XR 화면 터치가 밑에 클릭 막지 않도록
        zIndex: 5,
      }}
    />
  );
}
