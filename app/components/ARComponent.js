'use client';

import React, { useEffect, useRef } from 'react';

// import * as THREE from 'three'; // 이 부분을 제거합니다.

const ARComponent = ({ onStreamReady, drawData, peerClickCoords }) => {
  const sceneRef = useRef(null);
  const videoRef = useRef(null);
  const combinedCanvasRef = useRef(null);
  const currentLineRef = useRef(null);

  const get3DPoint = (coords) => {
    const THREE = window.THREE;
    if (!THREE) return null;

    const sceneEl = sceneRef.current;
    if (!sceneEl || !sceneEl.camera) return null;

    const camera = sceneEl.camera;
    const raycaster = new THREE.Raycaster();
    const clickPoint = new THREE.Vector2(coords.x * 2 - 1, -(coords.y * 2 - 1));
    
    raycaster.setFromCamera(clickPoint, camera);

    const targetPlanes = [];
    sceneEl.querySelectorAll('.target-plane').forEach(planeEl => {
        if (planeEl.object3D) targetPlanes.push(planeEl.object3D);
    });

    const intersects = raycaster.intersectObjects(targetPlanes, true);
    if (intersects.length > 0) {
        return intersects[0];
    }
    return null;
  }

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;

    let mindarSystem = null;

    const setupStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;

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
              if (onStreamReady) onStreamReady(combinedCanvas.captureStream());
            });
          } else {
            setTimeout(checkCanvas, 100);
          }
        };

        if (sceneEl.hasLoaded) {
          mindarSystem = sceneEl.systems['mindar-image-system'];
          mindarSystem.start();
          checkCanvas();
        } else {
          sceneEl.addEventListener('loaded', () => {
            mindarSystem = sceneEl.systems['mindar-image-system'];
            mindarSystem.start();
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

    const setupEventListeners = () => {
      sceneEl.querySelectorAll('.target-plane').forEach(plane => {
        plane.addEventListener('click', handleClick);
      });
      sceneEl.querySelectorAll('[mindar-image-target]').forEach(target => {
        target.addEventListener('targetFound', () => target.querySelector('.target-plane').setAttribute('visible', 'true'));
        target.addEventListener('targetLost', () => target.querySelector('.target-plane').setAttribute('visible', 'false'));
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

  // Peer의 클릭을 처리 (구 생성)
  useEffect(() => {
    if (!peerClickCoords) return;
    const intersection = get3DPoint(peerClickCoords);

    if (intersection) {
        const parentEntity = intersection.object.el.parentElement;
        const localPosition = parentEntity.object3D.worldToLocal(intersection.point.clone());

        const peerSphere = document.createElement('a-sphere');
        peerSphere.setAttribute('radius', '0.05');
        peerSphere.setAttribute('color', '#FF0000'); // Peer's sphere is red
        peerSphere.setAttribute('position', localPosition);
        parentEntity.appendChild(peerSphere);
    }
  }, [peerClickCoords]);

  // Peer의 그리기를 처리 (THREE.js 직접 사용 + setObject3D)
  useEffect(() => {
    const THREE = window.THREE;
    if (!drawData || !THREE) return;

    const { state, coords } = drawData;
    const intersection = coords ? get3DPoint(coords) : null;

    if (state === 'start' && intersection) {
        const parentEntity = intersection.object.el.parentElement;
        const startPoint = parentEntity.object3D.worldToLocal(intersection.point.clone());

        const lineEntity = document.createElement('a-entity');
        parentEntity.appendChild(lineEntity);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([startPoint.x, startPoint.y, startPoint.z]), 3));
        
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);

        lineEntity.setObject3D('mesh', line);

        currentLineRef.current = {
            line,
            parent: parentEntity,
            points: [startPoint]
        };

    } else if (state === 'move' && currentLineRef.current && intersection) {
        const { line, parent, points } = currentLineRef.current;
        
        if (parent !== intersection.object.el.parentElement) return;

        const nextPoint = parent.object3D.worldToLocal(intersection.point.clone());
        points.push(nextPoint);

        const positions = new Float32Array(points.length * 3);
        points.forEach((p, i) => {
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        });

        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.geometry.computeBoundingSphere();

    } else if (state === 'end') {
        currentLineRef.current = null;
    }

  }, [drawData]);

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