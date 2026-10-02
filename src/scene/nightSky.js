import * as THREE from 'three';
import { planetTexture, ringTexture } from '../textures/procedural.js';
import { rand } from '../utils/format.js';

// Night-only sky objects: planets and shooting stars.
// The whole group follows the camera (like the sky dome) so they behave
// as if infinitely far away. See README "Night sky".

const planetVS = /* glsl */ `
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const planetFS = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vec3 col = texture2D(uMap, vUv).rgb;
    float light = 0.06 + max(dot(vN, uLight), 0.0) * 1.1; // simple Lambert terminator
    gl_FragColor = vec4(col * light, uOpacity);
  }
`;

const streakVS = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const streakFS = /* glsl */ `
  uniform float uAlpha;
  varying float vT;
  void main() { gl_FragColor = vec4(vec3(0.85, 0.92, 1.0), vT * vT * uAlpha); }
`;

export function createNightSky(cfg) {
  const group = new THREE.Group();

  // ---------------------------------------------------------------- planets
  const planets = cfg.planets.map((p) => {
    const dir = new THREE.Vector3(...p.dir).normalize();
    const uniforms = {
      uMap: { value: planetTexture(p.colors) },
      // Lit mostly from the viewer's side (a gibbous phase), slightly off-axis.
      uLight: { value: dir.clone().negate().add(new THREE.Vector3(0.6, 0.35, 0)).normalize() },
      uOpacity: { value: 0 },
    };
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 48, 32),
      new THREE.ShaderMaterial({ uniforms, vertexShader: planetVS, fragmentShader: planetFS, transparent: true }),
    );
    mesh.position.copy(dir).multiplyScalar(cfg.planetDistance);
    mesh.rotation.z = p.axialTilt ?? 0;
    group.add(mesh);

    let ring = null;
    if (p.ring) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(p.radius * p.ring.inner, p.radius * p.ring.outer, 96),
        new THREE.MeshBasicMaterial({ map: ringTexture(p.ring.color, p.ring.inner / p.ring.outer), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0 }),
      );
      ring.position.copy(mesh.position);
      ring.rotation.set(p.ring.tilt[0], p.ring.tilt[1], 0);
      ring.renderOrder = 1;
      group.add(ring);
    }
    return { mesh, ring, uniforms, spin: p.spin ?? 0.02 };
  });

  // ---------------------------------------------------------------- shooting stars
  const R = cfg.planetDistance + 10;
  const stars = [];
  for (let i = 0; i < cfg.shootingStars.maxActive; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    const uniforms = { uAlpha: { value: 0 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms, vertexShader: streakVS, fragmentShader: streakFS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    stars.push({ mesh, uniforms, alive: false, age: 0, life: 1, start: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 0 });
  }

  const ss = cfg.shootingStars;
  function spawn(from) {
    const s = stars.find((x) => !x.alive);
    if (!s) return;
    if (from) s.start.copy(from).normalize().multiplyScalar(R);
    else s.start.set(rand(-0.9, 0.9), rand(0.3, 0.8), -1).normalize().multiplyScalar(R);
    // Mostly downward diagonal, either left or right.
    const a = rand(0.25, 0.8), side = Math.random() < 0.5 ? -1 : 1;
    s.dir.set(Math.cos(a) * side, -Math.sin(a), rand(-0.2, 0.2)).normalize();
    s.speed = rand(...ss.speed);
    s.life = rand(...ss.life);
    s.age = 0;
    s.alive = true;
    s.mesh.visible = true;
  }

  let nextSpawn = rand(...ss.interval);
  const head = new THREE.Vector3(), tail = new THREE.Vector3(), sideV = new THREE.Vector3();

  function updateStreak(s, dt) {
    s.age += dt;
    const f = s.age / s.life;
    if (f >= 1) { s.alive = false; s.mesh.visible = false; return; }
    head.copy(s.start).addScaledVector(s.dir, s.age * s.speed);
    const len = Math.min(s.age * s.speed, ss.length);
    tail.copy(head).addScaledVector(s.dir, -len);
    sideV.crossVectors(s.dir, head).normalize(); // perpendicular to motion, facing the viewer
    const wh = ss.width, wt = ss.width * 0.1;
    const pos = s.mesh.geometry.attributes.position;
    pos.setXYZ(0, tail.x - sideV.x * wt, tail.y - sideV.y * wt, tail.z - sideV.z * wt);
    pos.setXYZ(1, tail.x + sideV.x * wt, tail.y + sideV.y * wt, tail.z + sideV.z * wt);
    pos.setXYZ(2, head.x - sideV.x * wh, head.y - sideV.y * wh, head.z - sideV.z * wh);
    pos.setXYZ(3, head.x + sideV.x * wh, head.y + sideV.y * wh, head.z + sideV.z * wh);
    pos.needsUpdate = true;
    s.uniforms.uAlpha.value = Math.sin(Math.PI * f); // fade in, flare, fade out
  }

  function update(time, camera, dt) {
    group.position.copy(camera.position);
    const night = time.nightAmt;

    for (const p of planets) {
      p.uniforms.uOpacity.value = night;
      p.mesh.visible = night > 0.01;
      p.mesh.rotation.y += p.spin * dt;
      if (p.ring) { p.ring.material.opacity = night * 0.85; p.ring.visible = p.mesh.visible; }
    }

    // Spawn timer runs faster the darker it is; nothing spawns in daylight.
    nextSpawn -= dt * night;
    if (nextSpawn <= 0) {
      if (night > 0.3) spawn();
      nextSpawn = rand(...ss.interval);
    }
    for (const s of stars) if (s.alive) updateStreak(s, dt);
  }

  // Clicking the night sky makes a wish: a shooting star starts at the cursor.
  function wish(ray, time) {
    if (time.nightAmt > 0.3) spawn(ray.direction);
  }

  return { group, update, wish };
}
