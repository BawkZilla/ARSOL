"use client";

import React, { useEffect, useRef } from 'react';

const ARComponent = ({ onStreamReady }) => {
  const sceneRef = useRef(null);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) {
      console.warn('ARComponent: sceneRef.current is null.');
      return;
    }

    const setupStream = () => {
      if (onStreamReady) {
        const canvas = sceneEl.canvas;
        if (canvas) {
          const stream = canvas.captureStream(30); // 30 fps
          onStreamReady(stream);
          console.log("ARComponent: Stream captured and sent.");
        } else {
          console.error("ARComponent: Could not find canvas to capture stream.");
        }
      }
    };

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
      const targetPlane = event.target.querySelector('.target-plane');
      if (targetPlane) {
        targetPlane.setAttribute('opacity', '0.5');
        targetPlane.setAttribute('color', 'yellow');
        setTimeout(() => {
          targetPlane.setAttribute('opacity', '0');
        }, 1000);
      }
    };

    const handleTargetLost = (event) => {
      // Logic for when a target is lost
    };

    const setupEventListeners = () => {
      const targetEntities = sceneEl.querySelectorAll('[mindar-image-target]');
      targetEntities.forEach(target => {
        const plane = target.querySelector('.target-plane');
        if (plane) plane.addEventListener('click', handleClick);
        target.addEventListener('targetFound', handleTargetFound);
        target.addEventListener('targetLost', handleTargetLost);
      });
      setupStream(); // Setup stream after event listeners are ready
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
        if (plane) plane.removeEventListener('click', handleClick);
        target.removeEventListener('targetFound', handleTargetFound);
        target.removeEventListener('targetLost', handleTargetLost);
      });
      sceneEl.removeEventListener('loaded', setupEventListeners);
    };
  }, [onStreamReady]);

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
        embedded
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
