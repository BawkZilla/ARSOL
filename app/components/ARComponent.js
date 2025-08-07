'use client';

import React, { useEffect, useRef } from 'react';

const ARComponent = ({ onStreamReady }) => {
  const sceneRef = useRef(null);
  const videoRef = useRef(null);
  const combinedCanvasRef = useRef(null);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) {
      console.warn('ARComponent: sceneRef.current is null.');
      return;
    }

    let mindarSystem = null;

    const startMindAR = () => {
      mindarSystem = sceneEl.systems['mindar-image-system'];
      if (mindarSystem) {
        mindarSystem.start(); // MindAR 엔진 수동 시작
      }
    };

    const setupStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const checkCanvas = () => {
          const arCanvas = sceneEl.canvas;
          if (arCanvas && videoRef.current) {
            const video = videoRef.current;
            const combinedCanvas = combinedCanvasRef.current;
            const ctx = combinedCanvas.getContext('2d');

            const drawFrames = () => {
              if (!videoRef.current) return; // Cleanup check
              ctx.drawImage(video, 0, 0, combinedCanvas.width, combinedCanvas.height);
              ctx.drawImage(arCanvas, 0, 0, combinedCanvas.width, combinedCanvas.height);
              requestAnimationFrame(drawFrames);
            };

            video.addEventListener('loadedmetadata', () => {
              combinedCanvas.width = video.videoWidth;
              combinedCanvas.height = video.videoHeight;
              drawFrames();
              if (onStreamReady) {
                onStreamReady(combinedCanvas.captureStream());
              }
            });
          } else {
            setTimeout(checkCanvas, 100);
          }
        };

        if (sceneEl.hasLoaded) {
          startMindAR();
          checkCanvas();
        } else {
          sceneEl.addEventListener('loaded', () => {
            startMindAR();
            checkCanvas();
          }, { once: true });
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    };

    setupStream();

    const handleClick = (event) => {
      const touchPoint = event.detail.intersection.point;
      const parentEntity = event.target.parentElement;
      const localPosition = parentEntity.object3D.worldToLocal(touchPoint.clone());
      
      const annotationSphere = document.createElement('a-sphere');
      annotationSphere.setAttribute('radius', '0.05');
      annotationSphere.setAttribute('color', '#4CC3D9');
      annotationSphere.setAttribute('position', localPosition);
      parentEntity.appendChild(annotationSphere);
    };

    const handleTargetFound = (event) => {
      console.log("Target Found:", event.target);
      const targetPlane = event.target.querySelector('.target-plane');
      if (targetPlane) {
        targetPlane.setAttribute('opacity', '0.5');
        targetPlane.setAttribute('color', 'yellow');
      }
    };

    const handleTargetLost = (event) => {
      console.log("Target Lost:", event.target);
      const targetPlane = event.target.querySelector('.target-plane');
      if (targetPlane) {
        targetPlane.setAttribute('opacity', '0');
      }
    };

    const setupEventListeners = () => {
      const targetEntities = sceneEl.querySelectorAll('[mindar-image-target]');
      targetEntities.forEach(target => {
        const plane = target.querySelector('.target-plane');
        if (plane) {
            plane.addEventListener('click', handleClick);
        }
        target.addEventListener('targetFound', handleTargetFound);
        target.addEventListener('targetLost', handleTargetLost);
      });
      console.log(`ARComponent: Added event listeners to ${targetEntities.length} targets.`);
    };
    
    if (sceneEl.hasLoaded) {
      setupEventListeners();
    } else {
      sceneEl.addEventListener('loaded', setupEventListeners);
    }

    // Cleanup function
    return () => {
      console.log('ARComponent: Cleaning up...');
      // Stop MindAR engine
      if (mindarSystem) {
        mindarSystem.stop();
      }
      // Stop camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      // Remove event listeners
      const targetEntities = sceneEl.querySelectorAll('[mindar-image-target]');
      targetEntities.forEach(target => {
        const plane = target.querySelector('.target-plane');
        if (plane) {
            plane.removeEventListener('click', handleClick);
        }
        target.removeEventListener('targetFound', handleTargetFound);
        target.removeEventListener('targetLost', handleTargetLost);
      });
      sceneEl.removeEventListener('loaded', setupEventListeners);

      // Remove MindAR UI elements
      const uiOverlay = document.querySelector('.mindar-ui-overlay');
      if (uiOverlay) uiOverlay.remove();
      const scanningOverlay = document.querySelector('.mindar-ui-scanning');
      if (scanningOverlay) scanningOverlay.remove();

      console.log('ARComponent: Cleanup complete.');
    };
  }, [onStreamReady]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video ref={videoRef} autoPlay playsInline style={{ display: 'none' }}></video>
      <canvas ref={combinedCanvasRef} style={{ width: '100%', height: '100%' }}></canvas>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <a-scene
          ref={sceneRef}
          mindar-image="imageTargetSrc: /targets.mind; autoStart: false;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          cursor="rayOrigin: mouse; fuse: false;"
          raycaster="objects: .target-plane"
        >
          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0">
            <a-plane class="target-plane" color="yellow" opacity="0" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 1">
            <a-plane class="target-plane" color="yellow" opacity="0" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 2">
            <a-plane class="target-plane" color="yellow" opacity="0" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 3">
            <a-plane class="target-plane" color="yellow" opacity="0" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
        </a-scene>
      </div>
    </div>
  );
};

export default ARComponent;