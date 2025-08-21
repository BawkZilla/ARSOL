'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ARComponent = ({ onStreamReady, peerClickCoords }) => {
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
        mindarSystem.start();
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
              if (!videoRef.current) return;
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

    const placeSphere = (position, parent) => {
        const annotationSphere = document.createElement('a-sphere');
        annotationSphere.setAttribute('radius', '0.05');
        annotationSphere.setAttribute('color', '#4CC3D9');
        annotationSphere.setAttribute('position', position);
        parent.appendChild(annotationSphere);
    }

    const handleClick = (event) => {
      const touchPoint = event.detail.intersection.point;
      const parentEntity = event.target.parentElement;
      const localPosition = parentEntity.object3D.worldToLocal(touchPoint.clone());
      placeSphere(localPosition, parentEntity);
    };

    const handleTargetFound = (event) => {
      const targetPlane = event.target.querySelector('.target-plane');
      if (targetPlane) {
        targetPlane.setAttribute('visible', 'true');
      }
    };

    const handleTargetLost = (event) => {
      const targetPlane = event.target.querySelector('.target-plane');
      if (targetPlane) {
        targetPlane.setAttribute('visible', 'false');
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
    };
    
    if (sceneEl.hasLoaded) {
      setupEventListeners();
    } else {
      sceneEl.addEventListener('loaded', setupEventListeners);
    }

    return () => {
      if (mindarSystem) mindarSystem.stop();
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      const uiOverlay = document.querySelector('.mindar-ui-overlay');
      if (uiOverlay) uiOverlay.remove();
    };
  }, [onStreamReady]);

  useEffect(() => {
    if (!peerClickCoords || !sceneRef.current || !sceneRef.current.hasLoaded) {
        return;
    }

    const sceneEl = sceneRef.current;
    const camera = sceneEl.camera;
    const raycaster = new THREE.Raycaster();

    const clickPoint = new THREE.Vector2(
        peerClickCoords.x * 2 - 1,
        -(peerClickCoords.y * 2 - 1)
    );
    raycaster.setFromCamera(clickPoint, camera);

    const targetPlanes = [];
    sceneEl.querySelectorAll('.target-plane').forEach(planeEl => {
        if (planeEl.object3D) {
            targetPlanes.push(planeEl.object3D);
        }
    });
    
    const intersects = raycaster.intersectObjects(targetPlanes, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const touchPoint = intersection.point;
        const parentEntity = intersection.object.el.parentElement;
        const localPosition = parentEntity.object3D.worldToLocal(touchPoint.clone());

        const peerSphere = document.createElement('a-sphere');
        peerSphere.setAttribute('radius', '0.05');
        peerSphere.setAttribute('color', '#FF0000'); // Peer's sphere is red
        peerSphere.setAttribute('position', localPosition);
        parentEntity.appendChild(peerSphere);
    }
  }, [peerClickCoords]);

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
            <a-plane class="target-plane" material="color: yellow; transparent: true; opacity: 0.5" visible="false" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 1">
            <a-plane class="target-plane" material="color: yellow; transparent: true; opacity: 0.5" visible="false" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 2">
            <a-plane class="target-plane" material="color: yellow; transparent: true; opacity: 0.5" visible="false" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 3">
            <a-plane class="target-plane" material="color: yellow; transparent: true; opacity: 0.5" visible="false" position="0 0 0" rotation="-90 0 0" width="1" height="1"></a-plane>
          </a-entity>
        </a-scene>
      </div>
    </div>
  );
};

export default ARComponent;
