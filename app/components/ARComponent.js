'use client';

import React, { useEffect, useRef } from 'react';

// import * as THREE from 'three'; // 이 부분을 제거합니다.

const ARComponent = ({ onStreamReady, drawData, peerClickCoords, selectedTool, peerTool, textValue, clearSelectedTool, clearPeerTool, onAnnotationPlaced, annotationToDelete, clearAllTrigger, socket, roomId }) => {
  const sceneRef = useRef(null);
  const videoRef = useRef(null);
  const combinedCanvasRef = useRef(null);
  const currentLineRef = useRef(null);
  const mindarSystemRef = useRef(null);
  const selectedObjectRef = useRef(null); // To keep track of the currently selected object for move/rotate

  const parseVec3 = (str) => {
    if (!str) return { x: 0, y: 0, z: 0 };
    const parts = str.split(' ').map(Number);
    return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
  };

  const formatVec3 = (vec) => {
    return `${vec.x} ${vec.y} ${vec.z}`;
  };

  const highlightObject = (objEl) => {
    if (objEl && objEl.object3D) {
        // Store original material/color if needed for unhighlight
        // For simplicity, just change color for now
        objEl.setAttribute('material', 'color: #00FFFF; opacity: 0.7'); // Cyan highlight
    }
  };

  const unhighlightObject = (objEl) => {
    if (objEl && objEl.object3D) {
        objEl.removeAttribute('material'); // Revert to default or original
    }
  };

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
          mindarSystemRef.current = sceneEl.systems['mindar-image-system'];
          mindarSystemRef.current.start();
          checkCanvas();
        } else {
          sceneEl.addEventListener('loaded', () => {
            mindarSystemRef.current = sceneEl.systems['mindar-image-system'];
            mindarSystemRef.current.start();
            checkCanvas();
          }, { once: true });
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    };

    setupStream();

    const handleClick = (event) => {
      const currentTool = selectedTool.current;
      if (!currentTool){ 
        console.log("tool not selected");
        return;
      } 

      const touchPoint = event.detail.intersection.point;
      const parent = event.target.parentElement;
      const localPos = parent.object3D.worldToLocal(touchPoint.clone());
      
      switch (currentTool) {
        case 'marker': {                   // 빨간 구
          const sphere = document.createElement('a-sphere');
          sphere.setAttribute('radius', '0.05');
          sphere.setAttribute('color', 'blue');
          sphere.setAttribute('position', localPos);
          parent.appendChild(sphere);
          break;
        }
        case 'text': {                     // 텍스트 입력 -> plane+text
          const userText = prompt('텍스트를 입력하세요');
          if (!userText) break;
          const textPlane = document.createElement('a-plane');
          textPlane.setAttribute('color', '#FFFFFF');
          textPlane.setAttribute('height', '0.2');
          textPlane.setAttribute('width', Math.max(userText.length * 0.1, 0.3));
          textPlane.setAttribute('position', localPos);
          const textEl = document.createElement('a-text');
          textEl.setAttribute('value', userText);
          textEl.setAttribute('align', 'center');
          textEl.setAttribute('color', '#0008ffff');
          textPlane.appendChild(textEl);
          parent.appendChild(textPlane);
          break;
        }
        case 'cpu':
        case 'ram':
        case 'gpu': {                      // glTF 불러오기
          const model = document.createElement('a-entity');
          model.setAttribute('gltf-model', `url(/models/${currentTool}.gltf)`);
          model.setAttribute('scale', '0.2 0.2 0.2');
          model.setAttribute('position', localPos);
          parent.appendChild(model);
          break;
        }
        default:
          break;
      }
      console.log(currentTool ," 배치 완료(host)");
      clearSelectedTool();
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
      if (mindarSystemRef.current) {
        mindarSystemRef.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-loading').forEach(el => el.remove());
    };
  }, [onStreamReady]);

  // Peer의 클릭을 처리 (구 생성)
  useEffect(() => {
    if (!peerClickCoords) return;
    const intersection = get3DPoint(peerClickCoords);
    console.log("got coords");

    if (intersection) {

        const currentTool = peerTool.current;
        const parent = intersection.object.el.parentElement;
        const localPos = parent.object3D.worldToLocal(intersection.point.clone());
        if (!currentTool){ 
          console.log("tool not selected");
          return;
        } 


        const annotationId = Date.now();
      let newAnnotation;

      switch (currentTool) {
        case 'marker': {                   // 빨간 구
          const sphere = document.createElement('a-sphere');
          sphere.setAttribute('radius', '0.05');
          sphere.setAttribute('color', 'red');
          sphere.setAttribute('position', localPos);
          sphere.setAttribute('data-annotation-id', annotationId);
          parent.appendChild(sphere);
          newAnnotation = sphere;
          break;
        }
        case 'text': {                     // 텍스트 입력 -> plane+text
          const userText = textValue.current;
          console.log("peer text: ", userText);
          if (!userText) break;
          const textPlane = document.createElement('a-plane');
          textPlane.setAttribute('color', '#FFFFFF');
          textPlane.setAttribute('height', '0.2');
          textPlane.setAttribute('width', Math.max(userText.length * 0.1, 0.3));
          textPlane.setAttribute('position', localPos);
          textPlane.setAttribute('data-annotation-id', annotationId);

          const textEl = document.createElement('a-text');
          textEl.setAttribute('value', userText);
          textEl.setAttribute('align', 'center');
          textEl.setAttribute('color', 'red');
          textPlane.appendChild(textEl);
          parent.appendChild(textPlane);
          newAnnotation = textPlane;
          break;
        }
        case 'cpu':
        case 'ram':
        case 'gpu': {                      // glTF 불러오기
          const model = document.createElement('a-entity');
          model.setAttribute('gltf-model', `url(/models/${currentTool}.gltf)`);
          model.setAttribute('scale', '0.2 0.2 0.2');
          model.setAttribute('position', localPos);
          model.setAttribute('data-annotation-id', annotationId);
          parent.appendChild(model);
          newAnnotation = model;
          break;
        }
        default:
          break;
      }
      if (newAnnotation) {
        console.log(currentTool , " 배치 완료(peer)");
        onAnnotationPlaced({ id: annotationId, type: currentTool });
      }
      clearPeerTool();
    }
  }, [peerClickCoords, textValue]);

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
        const lineId = Date.now(); // Generate unique ID for the line
        lineEntity.setAttribute('data-annotation-id', lineId);
        parentEntity.appendChild(lineEntity);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([startPoint.x, startPoint.y, startPoint.z]), 3));
        
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);

        lineEntity.setObject3D('mesh', line);

        currentLineRef.current = {
            line,
            parent: parentEntity,
            points: [startPoint],
            lineEntity, // Store reference to the entity
            lineId // Store the ID
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
        if (currentLineRef.current) {
            onAnnotationPlaced({ id: currentLineRef.current.lineId, type: 'draw' });
        }
        currentLineRef.current = null;
    }

  }, [drawData]);

  useEffect(() => {
    if (!socket) return;

    const handleRequestTransform = ({ objectId }) => {
      const objEl = sceneRef.current.querySelector(`[data-annotation-id='${objectId}']`);
      if (objEl) {
        // Unhighlight previously selected object
        if (selectedObjectRef.current && selectedObjectRef.current !== objEl) {
          unhighlightObject(selectedObjectRef.current);
        }
        
        // Highlight new selected object
        highlightObject(objEl);
        selectedObjectRef.current = objEl;

        const position = parseVec3(objEl.getAttribute('position'));
        const rotation = parseVec3(objEl.getAttribute('rotation')); // A-Frame rotation is Euler angles

        socket.emit('send-object-transform', {
          roomId: roomId,
          objectId,
          position,
          rotation
        });
      }
    };

    const handleUpdateTransform = ({ objectId, position, rotation }) => {
      const objEl = sceneRef.current.querySelector(`[data-annotation-id='${objectId}']`);
      if (objEl) {
        objEl.setAttribute('position', formatVec3(position));
        objEl.setAttribute('rotation', formatVec3(rotation));
        // After update, unhighlight if it was the selected object
        if (selectedObjectRef.current === objEl) {
            unhighlightObject(objEl);
            selectedObjectRef.current = null;
        }
      }
    };

    socket.on('request-object-transform', handleRequestTransform);
    socket.on('update-object-transform', handleUpdateTransform);

    return () => {
      socket.off('request-object-transform', handleRequestTransform);
      socket.off('update-object-transform', handleUpdateTransform);
      // Ensure any highlighted object is unhighlighted on unmount
      if (selectedObjectRef.current) {
          unhighlightObject(selectedObjectRef.current);
          selectedObjectRef.current = null;
      }
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (annotationToDelete) {
        const el = sceneRef.current.querySelector(`[data-annotation-id='${annotationToDelete}']`);
        if (el) {
            el.remove();
            console.log(`Annotation ${annotationToDelete} deleted.`);
        }
    }
  }, [annotationToDelete]);

  useEffect(() => {
    if (clearAllTrigger > 0) {
        const allAnnotations = sceneRef.current.querySelectorAll('[data-annotation-id]');
        allAnnotations.forEach(el => el.remove());
        console.log('All annotations deleted.');
    }
  }, [clearAllTrigger]);

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