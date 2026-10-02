import * as THREE from 'three';

// GPU ASCII renderer. Turn on with SETTINGS.render.ascii or ?ascii in the URL.
//
// Each frame:
//   1. the scene renders normally to the screen,
//   2. that image is copied into a texture (copyFramebufferToTexture),
//   3. a full-screen shader splits the screen into cellSize×cellSize cells,
//      reads the scene colour at each cell's centre, maps its brightness to
//      a character from `charset`, and draws that glyph from a pre-rendered
//      atlas, tinted with the cell's colour.
// Everything happens in one shader pass, so tiny cells (lots of characters)
// stay at 60 fps. See README "ASCII mode".

const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uScene, uAtlas;
  uniform vec2 uRes;
  uniform float uCell, uCount, uColor, uBg, uBoost, uGain;
  uniform vec3 uMono;

  void main() {
    vec2 px = gl_FragCoord.xy;
    vec2 cell = floor(px / uCell);
    vec3 col = texture2D(uScene, (cell + 0.5) * uCell / uRes).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float tone = clamp(lum * uGain, 0.0, 1.0); // stretch so mid-tones use mid-density glyphs

    float idx = floor(tone * (uCount - 1.0) + 0.5);
    vec2 g = fract(px / uCell);
    float mask = texture2D(uAtlas, vec2((idx + g.x) / uCount, g.y)).r;

    vec3 ink = mix(uMono * lum, col, uColor) * uBoost;
    gl_FragColor = vec4(col * uBg + ink * mask, 1.0);
  }
`;

const G = 64; // atlas pixels per glyph

function drawGlyph(g, ch, x, font) {
  g.fillStyle = '#fff';
  g.font = `700 ${G * 0.8}px "${font}", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, x + G / 2, G / 2);
}

// Sort the characters by how much "ink" each one really covers in this font,
// and drop any that come out blank (e.g. glyphs clipped by the cell). This
// keeps brightness -> character strictly monotonic, so no tone goes empty.
function orderByInk(charset, font) {
  const c = document.createElement('canvas');
  c.width = c.height = G;
  const g = c.getContext('2d', { willReadFrequently: true });
  const scored = [...new Set(charset)].map((ch) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, G, G);
    drawGlyph(g, ch, 0, font);
    const data = g.getImageData(0, 0, G, G).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) ink += data[i];
    return { ch, ink };
  });
  const visible = scored.filter((s) => s.ink > 0).sort((a, b) => a.ink - b.ink);
  return ' ' + visible.map((s) => s.ch).join('');
}

// All glyphs side by side in one strip, white on black.
function glyphAtlas(charset, font) {
  const chars = orderByInk(charset.replace(/ /g, ''), font);
  const c = document.createElement('canvas');
  c.width = G * chars.length;
  c.height = G;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  [...chars].forEach((ch, i) => drawGlyph(g, ch, i * G, font));
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.userData.count = chars.length;
  return t;
}

export function createAsciiMode(renderer, cfg) {
  const uniforms = {
    uScene: { value: null },
    uAtlas: { value: null },
    uRes: { value: new THREE.Vector2() },
    uCell: { value: 1 },
    uCount: { value: 1 },
    uGain: { value: cfg.gain },
    uColor: { value: cfg.color ? 1 : 0 },
    uMono: { value: new THREE.Color(cfg.monoColor) },
    uBg: { value: cfg.backgroundTint },
    uBoost: { value: cfg.brightness },
  };
  const setAtlas = () => {
    const tex = glyphAtlas(cfg.charset, cfg.font);
    uniforms.uAtlas.value?.dispose();
    uniforms.uAtlas.value = tex;
    uniforms.uCount.value = tex.userData.count;
  };
  setAtlas();
  // Redraw once the web font has loaded, so glyphs use Space Mono.
  document.fonts?.ready.then(setAtlas);

  const post = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false }));
  quad.frustumCulled = false;
  post.add(quad);

  const size = new THREE.Vector2();
  const origin = new THREE.Vector2(0, 0);
  let fbTex = null;

  function setSize() {
    renderer.getDrawingBufferSize(size);
    if (size.x === 0 || size.y === 0) return;
    fbTex?.dispose();
    fbTex = new THREE.FramebufferTexture(size.x, size.y);
    uniforms.uScene.value = fbTex;
    uniforms.uRes.value.copy(size);
    uniforms.uCell.value = cfg.cellSize * renderer.getPixelRatio();
  }

  function render(scene, camera) {
    if (!fbTex) { setSize(); if (!fbTex) return; }
    renderer.render(scene, camera);
    renderer.copyFramebufferToTexture(origin, fbTex);
    renderer.render(post, postCam);
  }

  return { setSize, render };
}
