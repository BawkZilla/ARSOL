"use client";

import React, { useEffect, useRef } from 'react';

const ARComponent = ({ onCanvasReady }) => {
  const sceneRef = useRef(null);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) {
      console.warn('ARComponent: sceneRef.current is null.');
      return;
    }

    const checkCanvas = () => {
      const canvas = sceneEl.canvas;
      if (canvas && onCanvasReady) {
        onCanvasReady(canvas);
      } else if (!canvas) {
        setTimeout(checkCanvas, 100);
      }
    };

    if (sceneEl.hasLoaded) {
      checkCanvas();
    } else {
      sceneEl.addEventListener('loaded', checkCanvas, { once: true });
    }

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

    return () => {
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
      console.log('ARComponent: Removed all event listeners.');
    };
  }, [onCanvasReady]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <a-scene
        ref={sceneRef}
        mindar-image="imageTargetSrc: /targets.mind; autoStart: true;"
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
  );
};

export default ARComponent;