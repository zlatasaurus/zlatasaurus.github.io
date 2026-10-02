import * as THREE from 'three';

// Renderer, scene and camera, plus resize handling.
export function createStage(canvas, settings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.camera.fov, 1, 0.1, 1000);

  const resizeListeners = [];
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    resizeListeners.forEach((fn) => fn());
  }
  addEventListener('resize', resize);

  return { renderer, scene, camera, resize, onResize: (fn) => resizeListeners.push(fn) };
}
