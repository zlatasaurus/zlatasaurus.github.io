import * as THREE from 'three';
import { wingTexture } from '../textures/procedural.js';
import { rand } from '../utils/format.js';

// Daytime butterflies: two hinged wing planes + a body, flying with a
// simple "wander" steering behaviour and fleeing from the mouse.
// See README "Butterflies".
export function createButterflies(cfg, hill) {
  const group = new THREE.Group();

  // One material per wing pattern, shared between butterflies. Unlit (Basic)
  // so the colours read clearly even when seen from below against the sky.
  const wingMats = cfg.palettes.map((pal) => new THREE.MeshBasicMaterial({
    map: wingTexture(pal), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
  }));
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });

  // Wing plane: hinge on the body axis (x = 0), lying flat, forward = +z.
  const wingGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0).rotateX(Math.PI / 2);
  const bodyGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.55, 6).rotateX(Math.PI / 2);

  // Random point in the flight area, a little above the grass.
  function randomTarget(v) {
    const x = rand(...cfg.xRange), z = rand(...cfg.zRange);
    const ground = hill.surfaceY(x, z) ?? 0;
    return v.set(x, ground + rand(...cfg.heightAboveGround), z);
  }

  const flies = [];
  for (let i = 0; i < cfg.count; i++) {
    const obj = new THREE.Group();
    const mat = wingMats[i % wingMats.length];
    const right = new THREE.Mesh(wingGeo, mat);
    const left = new THREE.Mesh(wingGeo, mat);
    left.scale.x = -1; // mirror
    obj.add(right, left, new THREE.Mesh(bodyGeo, bodyMat));
    group.add(obj);

    const pos = randomTarget(new THREE.Vector3());
    obj.position.copy(pos);
    flies.push({
      obj, left, right,
      pos,
      vel: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)),
      target: randomTarget(new THREE.Vector3()),
      retarget: rand(2, 6),
      phase: rand(0, Math.PI * 2),
      size: rand(...cfg.size),
      scare: 0,
    });
  }

  const desired = new THREE.Vector3(), C = new THREE.Vector3(), away = new THREE.Vector3(), look = new THREE.Vector3();
  const sm = THREE.MathUtils.smoothstep;

  function update(time, ray, dt, t) {
    // Out in daylight only; they shrink away as the sun goes down.
    const amt = sm(time.dayAmt, 0.55, 0.9);
    group.visible = amt > 0.01;
    if (!group.visible) return;

    for (const b of flies) {
      // 1) Wander: steer toward a target, pick a new one on arrival or timeout.
      b.retarget -= dt;
      if (b.retarget <= 0 || b.pos.distanceToSquared(b.target) < 0.5) {
        randomTarget(b.target);
        b.retarget = rand(2, 6);
      }
      const speed = cfg.speed * (1 + b.scare * 2);
      desired.subVectors(b.target, b.pos).normalize().multiplyScalar(speed);
      // fluttery jitter so paths aren't straight lines
      desired.x += Math.sin(t * 3.1 + b.phase) * 0.6;
      desired.y += Math.sin(t * 4.3 + b.phase * 2) * 0.5;
      b.vel.lerp(desired, 1 - Math.exp(-cfg.steer * dt));

      // 2) Flee the mouse ray.
      if (ray) {
        const along = C.subVectors(b.pos, ray.origin).dot(ray.direction);
        if (along > 0) {
          C.copy(ray.direction).multiplyScalar(along).add(ray.origin);
          away.subVectors(b.pos, C);
          const d = away.length();
          if (d < cfg.fleeRadius && d > 1e-4) {
            const f = 1 - d / cfg.fleeRadius;
            b.vel.addScaledVector(away.divideScalar(d), cfg.fleeForce * f * dt);
            b.vel.y += cfg.fleeForce * 0.5 * f * dt; // startle upward
            b.scare = Math.min(1, b.scare + f * 3 * dt);
          }
        }
      }
      b.scare = Math.max(0, b.scare - dt * 0.5);
      b.pos.addScaledVector(b.vel, dt);

      // keep above the grass
      const ground = hill.surfaceY(b.pos.x, b.pos.z) ?? 0;
      if (b.pos.y < ground + 0.3) { b.pos.y = ground + 0.3; b.vel.y = Math.abs(b.vel.y); }

      // 3) Flap: fast wing beats, faster when scared; body bobs with each beat.
      b.phase += dt * (cfg.flapRate + b.scare * cfg.flapRate);
      const flap = Math.sin(b.phase) * 1.05 + 0.25;
      b.right.rotation.z = flap;
      b.left.rotation.z = -flap;

      b.obj.position.copy(b.pos);
      b.obj.position.y += Math.sin(b.phase) * 0.04;
      look.copy(b.pos).add(b.vel);
      b.obj.lookAt(look);
      b.obj.scale.setScalar(b.size * amt);
    }
  }

  return { group, update };
}
