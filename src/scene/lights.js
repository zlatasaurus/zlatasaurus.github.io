import * as THREE from 'three';

// Hemisphere (sky/ground bounce), a sun that casts shadows, and a cool moon.
export function createLights() {
  const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x223322, 0.8);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
  sun.shadow.camera.right = sun.shadow.camera.top = 35;
  sun.shadow.mapSize.set(2048, 2048);

  const moon = new THREE.DirectionalLight(0x8fa3ff, 0.3);

  const group = new THREE.Group();
  group.add(hemi, sun, sun.target, moon);

  const white = new THREE.Color(1, 1, 1);
  const sm = THREE.MathUtils.smoothstep;

  function update(time) {
    sun.position.copy(time.sunDir).multiplyScalar(60).add(sun.target.position);
    sun.color.copy(time.sunColor);
    sun.intensity = 1.6 * sm(time.elev, -0.02, 0.3);
    moon.position.copy(time.sunDir).multiplyScalar(-60);
    moon.intensity = 0.35 * sm(-time.elev, -0.02, 0.2);
    hemi.color.copy(time.top).lerp(white, 0.4);
    hemi.intensity = 0.35 + 0.55 * time.dayAmt;
  }

  return { group, hemi, sun, moon, update };
}
