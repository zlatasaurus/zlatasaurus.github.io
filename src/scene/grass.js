import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rand } from '../utils/format.js';

// Tens of thousands of grass blades drawn in ONE draw call with
// InstancedMesh. All movement (wind + mouse push) happens in the vertex
// shader, so the CPU only updates a handful of uniforms per frame.
// See README "Grass".

const vertexShader = /* glsl */ `
  attribute float aH;     // 0 at the root -> 1 at the tip
  attribute float aRand;  // per-blade random value
  uniform float uTime, uWind, uRadius, uStrength;
  uniform vec3 uMouse, uMouseDir;
  uniform vec2 uWindDir;
  varying float vH;
  varying float vRand;
  varying vec3 vN;

  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 world = m * vec4(position, 1.0);
    vec3 root = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 up = normalize((m * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float bladeLen = length((m * vec4(0.0, 1.0, 0.0, 0.0)).xyz);

    // Quadratic weighting: the root stays planted, the tip moves most.
    float bend = aH * aH;

    // Wind = a slow travelling wave (gusts) + a fast per-blade flutter.
    float gust = sin(uTime * 1.3 + root.x * 0.18 + root.z * 0.12) * 0.5 + 0.5;
    float flutter = sin(uTime * 5.0 + aRand * 30.0) * 0.15;
    vec3 wind = vec3(uWindDir.x, 0.0, uWindDir.y) * (gust * 0.8 + flutter) * uWind;

    // Mouse: blades near the cursor lean away from it AND along the
    // direction the cursor is travelling.
    vec3 toBlade = root - uMouse;
    toBlade -= up * dot(toBlade, up);
    float d = length(toBlade);
    float falloff = (1.0 - smoothstep(0.0, uRadius, d)) * uStrength;
    vec3 push = (toBlade / max(d, 1e-3) * 0.7 + uMouseDir) * falloff;

    vec3 offset = (wind + push * 1.2) * bend * bladeLen;
    offset -= up * dot(offset, up);                       // keep the bend sideways
    world.xyz += offset - up * length(offset) * 0.4 * aH; // tip dips as it bends

    vH = aH;
    vRand = aRand;
    vN = up;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase, uTip, uAmbient, uKey, uKeyDir;
  varying float vH;
  varying float vRand;
  varying vec3 vN;
  void main() {
    vec3 c = mix(uBase, uTip, vH) * (0.85 + 0.3 * vRand);
    float diff = max(dot(vN, uKeyDir), 0.0);
    gl_FragColor = vec4(c * (uAmbient + uKey * diff * 0.55), 1.0);
  }
`;

// A tapered blade, 1 unit tall, built from stacked quads ending in a point.
function bladeGeometry(widthRatio, segments = 5) {
  const pos = [], h = [], idx = [];
  for (let i = 0; i < segments; i++) {
    const y = i / segments;
    const w = widthRatio * 0.5 * (1 - y);
    pos.push(-w, y, 0, w, y, 0);
    h.push(y, y);
  }
  pos.push(0, 1, 0);
  h.push(1);
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2;
  idx.push(last, last + 1, segments * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  g.setIndex(idx);
  return g;
}

// Pull the first mesh out of a GLB and normalise it: root at y = 0,
// height = 1, plus an aH attribute (normalised height) for the shader.
async function modelGeometry(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  let geo = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!geo && o.isMesh) geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
  });
  if (!geo) throw new Error('no mesh in grass model');
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const height = max.y - min.y || 1;
  geo.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
  geo.scale(1 / height, 1 / height, 1 / height);
  const p = geo.attributes.position;
  const h = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) h[i] = p.getY(i);
  geo.setAttribute('aH', new THREE.BufferAttribute(h, 1));
  return geo;
}

export async function createGrass(settings, hill, cameraPos) {
  const cfg = settings.grass;

  let geometry;
  if (settings.assets.grassModel) {
    try { geometry = await modelGeometry(settings.assets.grassModel); }
    catch (e) { console.warn('[grass] model failed, using procedural blades', e); }
  }
  geometry ??= bladeGeometry(cfg.widthRatio);

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: cfg.windStrength },
    uWindDir: { value: new THREE.Vector2(1, -0.3).normalize() },
    uRadius: { value: cfg.mouseRadius },
    uStrength: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, -999, 0) },
    uMouseDir: { value: new THREE.Vector3() },
    uBase: { value: new THREE.Color(cfg.colors.base) },
    uTip: { value: new THREE.Color(cfg.colors.tip) },
    uAmbient: { value: new THREE.Color() },
    uKey: { value: new THREE.Color() },
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geometry, material, cfg.count);
  mesh.frustumCulled = false;

  // Scatter blades over the visible part of the hill, denser near the camera.
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), s = new THREE.Vector3();
  const q = new THREE.Quaternion(), yaw = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const rnd = new Float32Array(cfg.count);
  const [zNear, zFar] = cfg.zRange;
  let placed = 0, guard = 0;
  while (placed < cfg.count && guard++ < cfg.count * 20) {
    const x = rand(...cfg.xRange);
    const z = zNear + Math.pow(Math.random(), 1.6) * (zFar - zNear);
    const y = hill.surfaceY(x, z);
    if (y === null) continue;
    p.set(x, y, z);
    hill.normalAt(p, n);
    q.setFromUnitVectors(up, n).multiply(yaw.setFromAxisAngle(up, Math.random() * Math.PI * 2));
    const dist = p.distanceTo(cameraPos);
    const size = rand(...cfg.height) * (1 + dist * cfg.distanceScale);
    s.setScalar(size);
    mesh.setMatrixAt(placed, m.compose(p, q, s));
    rnd[placed] = Math.random();
    placed++;
  }
  mesh.count = placed;
  geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 1));

  // --- mouse interaction: damped spring on the push direction ----------
  const hit = new THREE.Vector3(), lastHit = new THREE.Vector3();
  const vel = new THREE.Vector3(), dirTarget = new THREE.Vector3(), dirVel = new THREE.Vector3();
  let hadHit = false;

  function update(time, lights, ray, dt, t) {
    uniforms.uTime.value = t;

    // Light the blades with the same colours as the scene lights.
    uniforms.uAmbient.value.copy(lights.hemi.color).multiplyScalar(lights.hemi.intensity * 0.6);
    const sunUp = time.elev > 0;
    uniforms.uKey.value.copy(sunUp ? lights.sun.color : lights.moon.color)
      .multiplyScalar(sunUp ? lights.sun.intensity : lights.moon.intensity);
    uniforms.uKeyDir.value.copy(time.sunDir).multiplyScalar(sunUp ? 1 : -1);

    const got = ray && hill.intersectRay(ray, hit);
    let strengthTarget = 0;
    if (got) {
      if (hadHit && dt > 0) vel.subVectors(hit, lastHit).divideScalar(dt);
      else vel.set(0, 0, 0);
      lastHit.copy(hit);
      uniforms.uMouse.value.lerp(hit, hadHit ? 0.5 : 1);
      // Hovering pushes a little; moving pushes more, along the motion.
      strengthTarget = 0.35 + Math.min(vel.length() * 0.05, 0.65);
      dirTarget.copy(vel).multiplyScalar(0.06).clampLength(0, 1);
    } else {
      dirTarget.set(0, 0, 0);
    }
    hadHit = !!got;

    // Underdamped spring -> blades overshoot slightly and wobble back.
    dirVel.addScaledVector(dirTarget.clone().sub(uniforms.uMouseDir.value), 40 * dt);
    dirVel.multiplyScalar(Math.exp(-5 * dt));
    uniforms.uMouseDir.value.addScaledVector(dirVel, dt);

    const u = uniforms.uStrength;
    const rate = strengthTarget > u.value ? 10 : 2.5; // quick to react, slow to relax
    u.value += (strengthTarget - u.value) * (1 - Math.exp(-rate * dt));
  }

  return { mesh, update };
}
