import * as THREE from 'three';

// Textures drawn at runtime on a <canvas>, so the site has no image
// dependencies. Swap any of these for a THREE.TextureLoader call if you add
// real image files to assets/textures/.

export function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#3f7424';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.strokeStyle = `hsl(${85 + Math.random() * 30}, 50%, ${22 + Math.random() * 25}%)`;
    const x = Math.random() * 512, y = Math.random() * 512;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 6, y - 4 - Math.random() * 8);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.anisotropy = 8;
  return t;
}

// One soft, slightly lumpy cloud puff. Many of these overlap to form a cloud.
export function puffTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // a main blob plus a few lumps so overlapping puffs don't look like perfect discs
  const blobs = [[64, 64, 56, 0.9]];
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 14;
    blobs.push([64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 22 + Math.random() * 14, 0.5]);
  }
  for (const [x, y, r, alpha] of blobs) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grd.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.45})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  return new THREE.CanvasTexture(c);
}

// Gas-giant style bands: wobbly horizontal stripes picked from `colors`.
// (No colorSpace set: the planet shader outputs these values as-is.)
export function planetTexture(colors) {
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bands = Array.from({ length: 14 }, () => colors[Math.floor(Math.random() * colors.length)]);
  for (let x = 0; x < W; x += 2) {
    for (let y = 0; y < H; y += 2) {
      const wobble = Math.sin(x * 0.05 + y * 0.2) * 2 + Math.sin(x * 0.13) * 1.5;
      const i = Math.floor(((y + wobble) / H) * bands.length);
      g.fillStyle = bands[Math.max(0, Math.min(bands.length - 1, i))];
      g.fillRect(x, y, 2, 2);
    }
  }
  return new THREE.CanvasTexture(c);
}

// Concentric ring bands with gaps. RingGeometry UVs are planar, so the
// canvas centre is the planet centre and its edge is the ring's outer edge.
export function ringTexture(color, innerFrac) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = color;
  for (let r = innerFrac * S / 2; r < S / 2; r += 1) {
    g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(r * 0.35)) * (Math.random() < 0.1 ? 0.2 : 1);
    g.beginPath();
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// One butterfly wing (right side). Left edge = hinge on the body, top = forward.
// pal: { base, edge, accent, dots }
export function wingTexture(pal) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  const shape = new Path2D();
  shape.moveTo(2, 62);                                 // forewing
  shape.bezierCurveTo(30, 10, 95, -4, 124, 14);
  shape.bezierCurveTo(128, 40, 105, 58, 60, 64);
  shape.bezierCurveTo(100, 70, 104, 108, 78, 124);     // hindwing
  shape.bezierCurveTo(50, 128, 18, 100, 2, 70);
  shape.closePath();

  const grd = g.createLinearGradient(0, 64, 128, 64);
  grd.addColorStop(0, pal.accent);
  grd.addColorStop(0.45, pal.base);
  grd.addColorStop(1, pal.base);
  g.fillStyle = grd;
  g.fill(shape);

  // veins
  g.save();
  g.clip(shape);
  g.strokeStyle = pal.edge;
  g.globalAlpha = 0.6;
  g.lineWidth = 1.5;
  for (const [x, y] of [[120, 14], [110, 40], [80, 58], [96, 90], [70, 120], [40, 112]]) {
    g.beginPath(); g.moveTo(2, 64); g.quadraticCurveTo(x * 0.5, (y + 64) / 2 - 6, x, y); g.stroke();
  }
  g.restore();

  // thick dark border with white spots, like a monarch
  g.lineWidth = 7;
  g.strokeStyle = pal.edge;
  g.stroke(shape);
  g.fillStyle = pal.dots;
  for (let i = 0; i < 9; i++) {
    const a = i / 9;
    g.beginPath();
    g.arc(70 + Math.cos(a * 4 - 1.2) * 52, 64 + Math.sin(a * 4 - 1.2) * 56, 2, 0, Math.PI * 2);
    g.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ff3b2f';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 128);
  g.fillStyle = '#2d6bff'; g.fillRect(0, 54, 256, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
