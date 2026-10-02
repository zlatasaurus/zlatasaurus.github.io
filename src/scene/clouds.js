import * as THREE from 'three';
import { puffTexture } from '../textures/procedural.js';
import { rand } from '../utils/format.js';

// Volumetric-looking clouds built from clusters of soft "puff" sprites
// spread through depth. Each puff sits on a spring, so the mouse can push
// through a cloud and click to burst it; the puffs then drift back together.
// See README "Clouds".
export function createClouds(cfg) {
  const group = new THREE.Group();
  const tex = puffTexture();
  const clouds = [];

  for (let c = 0; c < cfg.count; c++) {
    const size = rand(...cfg.size);
    const cloud = {
      center: new THREE.Vector3(rand(-cfg.wrapX, cfg.wrapX), rand(...cfg.height), rand(...cfg.depth)),
      speed: rand(...cfg.driftSpeed),
      size,
      puffs: [],
    };
    for (let i = 0; i < cfg.puffsPerCloud; i++) {
      // Points in a flattened ellipsoid, biased to a flat bottom like cumulus.
      const local = new THREE.Vector3(
        rand(-1, 1) * size,
        Math.abs(rand(-1, 1)) * size * 0.4,
        rand(-1, 1) * size * 0.45,
      );
      const scale = size * rand(0.55, 1.0) * (1 - Math.abs(local.x) / size * 0.4);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9,
      }));
      sprite.scale.setScalar(scale);
      group.add(sprite);
      cloud.puffs.push({
        sprite, local, scale,
        shade: 0.72 + 0.28 * (local.y / (size * 0.4)), // tops brighter than bellies
        disp: new THREE.Vector3(),
        vel: new THREE.Vector3(),
      });
    }
    clouds.push(cloud);
  }

  // --- colour ----------------------------------------------------------
  const white = new THREE.Color(1, 1, 0.97);
  const lit = new THREE.Color(), belly = new THREE.Color(), tmp = new THREE.Color();
  const sm = THREE.MathUtils.smoothstep;

  // --- interaction -----------------------------------------------------
  const P = new THREE.Vector3(), C = new THREE.Vector3(), away = new THREE.Vector3();
  let burstRay = null;

  // Distance from puff P to the mouse ray; returns null if behind the camera.
  function rayOffset(ray, p) {
    const along = C.subVectors(p, ray.origin).dot(ray.direction);
    if (along <= 0) return null;
    C.copy(ray.direction).multiplyScalar(along).add(ray.origin);
    away.subVectors(p, C);
    return away.length();
  }

  function burst(ray) { burstRay = ray.clone(); }

  function update(time, ray, dt) {
    // Sunlit tops; bellies pick up the horizon colour at dawn/dusk, everything dims at night.
    const bright = 0.16 + 0.84 * time.dayAmt;
    const warm = 1 - sm(time.elev, 0.05, 0.45);
    lit.copy(white).lerp(time.sunColor, 0.35 * warm).multiplyScalar(bright);
    belly.copy(white).lerp(time.horizon, 0.3 + 0.4 * warm).multiplyScalar(bright * 0.8);

    for (const cloud of clouds) {
      cloud.center.x += cloud.speed * dt;
      if (cloud.center.x > cfg.wrapX) cloud.center.x = -cfg.wrapX;

      for (const p of cloud.puffs) {
        P.copy(cloud.center).add(p.local).add(p.disp);

        if (ray) {
          const d = rayOffset(ray, P);
          const radius = p.scale * cfg.mouseRadius;
          if (d !== null && d < radius) {
            const f = 1 - d / radius;
            away.divideScalar(Math.max(d, 1e-3));
            p.vel.addScaledVector(away, cfg.push * f * dt * p.scale);
          }
        }
        if (burstRay) {
          const d = rayOffset(burstRay, P);
          if (d !== null && d < cloud.size * 1.6) {
            const f = 1 - d / (cloud.size * 1.6);
            away.divideScalar(Math.max(d, 1e-3));
            p.vel.addScaledVector(away, cfg.burst * f * p.scale * 0.1);
            p.vel.y += rand(0, cfg.burst * 0.3) * f;
          }
        }

        // Soft spring back home: lightly damped so clouds "breathe" as they reform.
        p.vel.addScaledVector(p.disp, -cfg.spring * dt);
        p.vel.multiplyScalar(Math.exp(-cfg.damping * dt));
        p.disp.addScaledVector(p.vel, dt);

        p.sprite.position.copy(P);
        // Puffs pushed away from their home fade a little, like thinning vapour.
        const stretch = Math.min(p.disp.length() / p.scale, 1);
        p.sprite.material.opacity = 0.9 * (1 - stretch * 0.6);
        tmp.copy(belly).lerp(lit, THREE.MathUtils.clamp(p.shade, 0, 1));
        p.sprite.material.color.copy(tmp);
      }
    }
    burstRay = null;
  }

  return { group, update, burst };
}
