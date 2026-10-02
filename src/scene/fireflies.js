import * as THREE from 'three';
import { rand } from '../utils/format.js';

// Glowing fireflies that appear at dusk. Inspired by
// github.com/thebenezer/threejs-fireflies (additive point sprites with a
// 1/d glow), extended with twirling flight paths and mouse interaction.
// See README "Fireflies".

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aExcite;
  uniform float uTime, uSize, uPixelRatio;
  varying float vAlpha;
  varying float vExcite;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = pow(0.5 + 0.5 * sin(uTime * (1.5 + aPhase * 0.3) + aPhase * 6.2831), 2.0);
    vAlpha = 0.35 + 0.65 * blink + aExcite;
    vExcite = aExcite;
    gl_PointSize = uSize * uPixelRatio * (1.0 + aExcite * 0.8) / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vExcite;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = clamp(0.08 / d - 0.16, 0.0, 1.0);
    vec3 col = mix(uColor, vec3(1.0), smoothstep(0.25, 0.0, d) * (0.5 + vExcite));
    gl_FragColor = vec4(col, glow * vAlpha * uOpacity);
  }
`;

export function createFireflies(settings, hill) {
  const cfg = settings.fireflies;
  const N = cfg.count;

  const home = new Float32Array(N * 3);
  const offset = new Float32Array(N * 3); // displacement from mouse pushes
  const vel = new Float32Array(N * 3);
  const params = [];
  const positions = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const excite = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const x = rand(...cfg.xRange), z = rand(...cfg.zRange);
    const ground = hill.surfaceY(x, z) ?? -3;
    home.set([x, ground + rand(...cfg.heightAboveGround), z], i * 3);
    phase[i] = Math.random();
    params.push({
      r: rand(0.4, 1.8),          // twirl radius
      w: rand(0.3, 0.9) * (Math.random() < 0.5 ? -1 : 1), // twirl speed & direction
      p1: rand(0, Math.PI * 2),
      p2: rand(0, Math.PI * 2),
      drift: rand(1.5, 4),         // slow wander distance
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aExcite', new THREE.BufferAttribute(excite, 1));

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: cfg.size },
    uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
    uColor: { value: new THREE.Color(cfg.color) },
    uOpacity: { value: 0 },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;

  const P = new THREE.Vector3(), C = new THREE.Vector3(), away = new THREE.Vector3(), swirl = new THREE.Vector3();

  function update(time, ray, dt, t) {
    uniforms.uTime.value = t;
    uniforms.uOpacity.value = time.fireflyAmt;
    points.visible = time.fireflyAmt > 0.01;
    if (!points.visible) return;

    for (let i = 0; i < N; i++) {
      const k = i * 3, pr = params[i];

      // 1) Base flight path: a lopsided Lissajous loop around a slowly wandering home.
      const a = t * pr.w + pr.p1;
      const bx = home[k] + Math.cos(a) * pr.r + Math.sin(t * 0.11 + pr.p2) * pr.drift;
      const by = home[k + 1] + Math.sin(a * 1.7 + pr.p2) * pr.r * 0.5;
      const bz = home[k + 2] + Math.sin(a) * pr.r + Math.cos(t * 0.09 + pr.p1) * pr.drift;

      // 2) Mouse: push away from the cursor ray and spin around it.
      P.set(bx + offset[k], by + offset[k + 1], bz + offset[k + 2]);
      if (ray) {
        const along = C.subVectors(P, ray.origin).dot(ray.direction);
        if (along > 0) {
          C.copy(ray.direction).multiplyScalar(along).add(ray.origin);
          away.subVectors(P, C);
          const d = away.length();
          if (d < cfg.mouseRadius && d > 1e-4) {
            const f = 1 - d / cfg.mouseRadius;
            away.divideScalar(d);
            swirl.crossVectors(ray.direction, away);
            vel[k]     += (away.x * 18 + swirl.x * 10) * f * dt;
            vel[k + 1] += (away.y * 18 + swirl.y * 10) * f * dt;
            vel[k + 2] += (away.z * 18 + swirl.z * 10) * f * dt;
            excite[i] = Math.min(1, excite[i] + f * 4 * dt);
          }
        }
      }

      // 3) Spring-damper pulls the offset back to zero so they rejoin their path.
      for (let j = 0; j < 3; j++) {
        vel[k + j] += (-offset[k + j] * 2 - vel[k + j] * 1.5) * dt;
        offset[k + j] += vel[k + j] * dt;
      }
      excite[i] = Math.max(0, excite[i] - dt * 0.6);

      positions[k] = bx + offset[k];
      positions[k + 1] = by + offset[k + 1];
      positions[k + 2] = bz + offset[k + 2];
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aExcite.needsUpdate = true;
  }

  return { points, update };
}
