"use client";

import React, { useEffect, useRef } from 'react';

const ARComponent = () => {
  const sceneRef = useRef(null);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (sceneEl) {
      const arSystem = sceneEl.systems["mindar-image-system"];
      const startAR = () => {
        arSystem.start(); // start AR system
      };
      sceneEl.addEventListener("renderstart", startAR);

      return () => {
        sceneEl.removeEventListener("renderstart", startAR);
        if (arSystem && arSystem.isStarted) {
          arSystem.stop();
        }
      };
    }
  }, []);

  return (
    <a-scene
      ref={sceneRef}
      mindar-image="imageTargetSrc: /mouse1.mind, /mouse2.mind, /mouse3.mind, /mouse4.mind; autoStart: false; uiScanning: #scanning; uiLoading: #loading;"
      color-space="sRGB"
      renderer="colorManagement: true"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
    >
      <a-assets>
        <div id="loading">Loading...</div>
        <div id="scanning">Scanning...</div>
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      <a-entity mindar-image-target="targetIndex: 0">
        <a-text value="Angle 1 Detected" color="red" position="0 0.1 0" align="center"></a-text>
      </a-entity>
      <a-entity mindar-image-target="targetIndex: 1">
        <a-text value="Angle 2 Detected" color="orange" position="0 0.1 0" align="center"></a-text>
      </a-entity>
      <a-entity mindar-image-target="targetIndex: 2">
        <a-text value="Angle 3 Detected" color="green" position="0 0.1 0" align="center"></a-text>
      </a-entity>
      <a-entity mindar-image-target="targetIndex: 3">
        <a-text value="Angle 4 Detected" color="blue" position="0 0.1 0" align="center"></a-text>
      </a-entity>
    </a-scene>
  );
};

export default ARComponent;
