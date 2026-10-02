import * as THREE from 'three';
import { ballTexture } from '../textures/procedural.js';
import { rand } from '../utils/format.js';

// The "Play" level: a walled square with pillars and a ball.
// Only builds meshes + collider data; movement lives in src/physics/ball.js.
export function createArena({ half = 30, pillarCount = 14, ballRadius = 1 } = {}) {
  const group = new THREE.Group();
  group.visible = false;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });
  for (const [x, z, w, d] of [[0, -half, half * 2, 1], [0, half, half * 2, 1], [-half, 0, 1, half * 2], [half, 0, 1, half * 2]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), wallMat);
    wall.position.set(x, 1, z);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
  }

  const pillars = [];
  const palette = [0xff3b2f, 0xffd166, 0x7affc8, 0x9ec5ff];
  for (let i = 0; i < pillarCount; i++) {
    const r = rand(1, 2.5), h = rand(2, 7);
    const a = rand(0, Math.PI * 2), dist = rand(8, 26);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 32),
      new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.4 }),
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    pillars.push({ x, z, r });
  }

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 48, 32),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.25, metalness: 0.2 }),
  );
  ball.castShadow = true;
  ball.position.set(0, ballRadius, 0);
  group.add(ball);

  return { group, ball, pillars, half, ballRadius };
}
