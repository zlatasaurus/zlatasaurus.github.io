import * as THREE from 'three';

// Keeps the red type readable: bright red by day, softer coral at night.
const DAY_INK = new THREE.Color(0xff3b2f);
const NIGHT_INK = new THREE.Color(0xff8a7a);
const ink = new THREE.Color();

export function updateInk(time) {
  ink.copy(DAY_INK).lerp(NIGHT_INK, 1 - time.dayAmt);
  document.documentElement.style.setProperty('--ink', '#' + ink.getHexString());
}
