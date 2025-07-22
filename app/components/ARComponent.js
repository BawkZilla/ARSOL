"use client";

import React, { useEffect, useRef } from 'react';

const ARComponent = () => {
  const sceneRef = useRef(null);

  // This effect runs when the component mounts to start the AR system
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (sceneEl) {
      const arSystem = sceneEl.systems["mindar-image-system"];
      
      // Start the AR system when the scene is ready
      const startAR = () => {
        arSystem.start();
      };
      
      sceneEl.addEventListener("renderstart", startAR);

      // Clean up on component unmount
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
      renderer="colorManagement: true, physicallyCorrectLights"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
    >
      <a-assets>
        {/* UI elements for loading and scanning */}
        <div id="loading" className="loader">Loading...</div>
        <div id="scanning" className="scanning">
            <div className="scanning-overlay"></div>
        </div>
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      {/* Target 1 (mouse1.mind) */}
      <a-entity mindar-image-target="targetIndex: 0">
        <a-text
          value="Angle 1 Detected"
          color="red"
          position="0 0.1 0"
          align="center"
          font="https://cdn.aframe.io/fonts/Exo2Bold.fnt"
        ></a-text>
      </a-entity>
      
      {/* Target 2 (mouse2.mind) */}
      <a-entity mindar-image-target="targetIndex: 1">
        <a-text
          value="Angle 2 Detected"
          color="orange"
          position="0 0.1 0"
          align="center"
          font="https://cdn.aframe.io/fonts/Exo2Bold.fnt"
        ></a-text>
      </a-entity>

      {/* Target 3 (mouse3.mind) */}
      <a-entity mindar-image-target="targetIndex: 2">
        <a-text
          value="Angle 3 Detected"
          color="green"
          position="0 0.1 0"
          align="center"
          font="https://cdn.aframe.io/fonts/Exo2Bold.fnt"
        ></a-text>
      </a-entity>

      {/* Target 4 (mouse4.mind) */}
      <a-entity mindar-image-target="targetIndex: 3">
        <a-text
          value="Angle 4 Detected"
          color="blue"
          position="0 0.1 0"
          align="center"
          font="https://cdn.aframe.io/fonts/Exo2Bold.fnt"
        ></a-text>
      </a-entity>
    </a-scene>
  );
};

export default ARComponent;
