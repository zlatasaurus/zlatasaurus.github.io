import * as THREE from 'three';

// Mouse / touch position, as normalised device coords (-1..1) and as a
// world-space ray from the camera (used by the grass and fireflies).
export function createPointer() {
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let inside = false;

  addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    inside = true;
  });
  document.addEventListener('pointerleave', () => { inside = false; });
  addEventListener('blur', () => { inside = false; });

  return {
    ndc,
    // Returns the current ray, or null if the pointer isn't over the page.
    ray(camera) {
      if (!inside) return null;
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray;
    },
  };
}
