import * as THREE from 'three';

// Sky dome: a huge inside-out sphere that follows the camera.
// Colour = vertical gradient (or optional skybox images) + sun/moon glow,
// then PS1-style ordered dithering. See README "Sky shader".

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop, uHorizon, uSunDir, uSunColor;
  uniform float uSunAmt, uMoonAmt, uDither, uLevels;
  uniform sampler2D uTexDay, uTexSunset, uTexNight;
  uniform vec3 uTexWeights, uTexOn;
  varying vec3 vDir;

  const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, uHorizon * 0.5, clamp(-h * 3.0, 0.0, 1.0));

    // Optional equirectangular skybox images, blended by time of day.
    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    vec3 w = uTexWeights * uTexOn;
    float wSum = w.x + w.y + w.z;
    if (wSum > 0.001) {
      vec3 tex = texture2D(uTexDay, uv).rgb * w.x + texture2D(uTexSunset, uv).rgb * w.y + texture2D(uTexNight, uv).rgb * w.z;
      col = mix(col, tex / wSum, clamp(wSum, 0.0, 1.0));
    }

    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.5) * uSunAmt;
    col += uSunColor * smoothstep(0.9993, 0.9997, s) * uSunAmt * 2.0;
    float m = max(dot(d, -uSunDir), 0.0);
    col += vec3(0.75, 0.8, 1.0) * (pow(m, 40.0) * 0.18 + smoothstep(0.9993, 0.9996, m) * 1.2) * uMoonAmt;

    if (uDither > 0.5) {
      ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
      float b = BAYER[p.x + p.y * 4] / 16.0;
      col = floor(col * uLevels + b) / uLevels;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky(settings) {
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunAmt: { value: 1 },
    uMoonAmt: { value: 0 },
    uDither: { value: settings.sky.psxDither ? 1 : 0 },
    uLevels: { value: settings.sky.colorLevels },
    uTexDay: { value: blank },
    uTexSunset: { value: blank },
    uTexNight: { value: blank },
    uTexWeights: { value: new THREE.Vector3() },
    uTexOn: { value: new THREE.Vector3() },
  };

  // Load any skybox images listed in settings.assets.skybox.
  const loader = new THREE.TextureLoader();
  [['day', 'uTexDay', 'x'], ['sunset', 'uTexSunset', 'y'], ['night', 'uTexNight', 'z']].forEach(([name, uni, axis]) => {
    const url = settings.assets.skybox[name];
    if (!url) return;
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter; // keep the PSX pixels crisp
      uniforms[uni].value = tex;
      uniforms.uTexOn.value[axis] = 1;
    }, undefined, () => console.warn(`[sky] could not load ${url}`));
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(500, 48, 32),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false }),
  );
  mesh.renderOrder = -1;

  // Stars
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false });
  const pos = new Float32Array(1200 * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    v.randomDirection().multiplyScalar(450);
    pos.set([v.x, Math.abs(v.y), v.z], i);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, starMat);

  const group = new THREE.Group();
  group.add(mesh, stars);

  function update(time, camera) {
    uniforms.uTop.value.copy(time.top);
    uniforms.uHorizon.value.copy(time.horizon);
    uniforms.uSunDir.value.copy(time.sunDir);
    uniforms.uSunColor.value.copy(time.sunColor);
    uniforms.uSunAmt.value = THREE.MathUtils.smoothstep(time.elev, -0.15, 0.0);
    uniforms.uMoonAmt.value = THREE.MathUtils.smoothstep(-time.elev, -0.05, 0.1);
    uniforms.uTexWeights.value.set(
      time.dayAmt * (1 - time.twilight),
      time.twilight,
      (1 - time.dayAmt) * (1 - time.twilight),
    );
    starMat.opacity = time.nightAmt;
    group.position.copy(camera.position);
  }

  return { group, update };
}
