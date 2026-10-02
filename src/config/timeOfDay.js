import * as THREE from 'three';

// Sky colour keyframes: [hour, zenith colour, horizon colour].
// Add more keys to shape any part of the day; they are blended with a
// Catmull-Rom spline so there are no visible "kinks" between keys.
const KEYS = [
  [0,    0x04061a, 0x121838],
  [3,    0x060a24, 0x1a1d44],
  [4.8,  0x111640, 0x40306a],
  [5.6,  0x27347e, 0xc0607a],
  [6.3,  0x3a64c0, 0xff9a66],
  [7.2,  0x3f82d8, 0xffc996],
  [8.5,  0x2f88ea, 0xa8d4ff],
  [12,   0x1479ee, 0x7fc4ff],
  [15.5, 0x2a84e6, 0xa6d2ff],
  [17.2, 0x3a6fc8, 0xffc48a],
  [18.2, 0x3a4fa6, 0xff9a52],
  [19,   0x2c2a74, 0xff6a3d],
  [19.8, 0x1c1d58, 0xb04a5c],
  [20.8, 0x0f1340, 0x4a2e60],
  [22,   0x070a28, 0x1a1f48],
].map(([h, top, horizon]) => ({ h, top: new THREE.Color(top), horizon: new THREE.Color(horizon) }));

const sm = THREE.MathUtils.smoothstep;
const ORANGE = new THREE.Color(1, 0.55, 0.25);
const WHITE = new THREE.Color(1, 1, 0.95);

// Wrap-around key lookup so 23:00 blends smoothly into 01:00.
function key(i) {
  const n = KEYS.length;
  const k = KEYS[((i % n) + n) % n];
  return { ...k, h: k.h + Math.floor(i / n) * 24 };
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function splineColor(out, prop, i, t) {
  const a = key(i - 1)[prop], b = key(i)[prop], c = key(i + 1)[prop], d = key(i + 2)[prop];
  out.setRGB(
    THREE.MathUtils.clamp(catmullRom(a.r, b.r, c.r, d.r, t), 0, 1),
    THREE.MathUtils.clamp(catmullRom(a.g, b.g, c.g, d.g, t), 0, 1),
    THREE.MathUtils.clamp(catmullRom(a.b, b.b, c.b, d.b, t), 0, 1),
  );
}

export function createTimeState() {
  return {
    hour: 0,
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(),
    elev: 0,       // sun height: 1 = overhead, 0 = horizon, -1 = below
    dayAmt: 0,     // 0 at night -> 1 in daylight
    nightAmt: 0,   // stars / moon
    twilight: 0,   // peaks at sunrise & sunset
    fireflyAmt: 0, // evening + night
  };
}

export function sampleTimeOfDay(hour, s) {
  const h = ((hour % 24) + 24) % 24;
  s.hour = h;

  let i = 0;
  while (i < KEYS.length - 1 && h >= KEYS[i + 1].h) i++;
  const a = key(i), b = key(i + 1);
  const t = (h - a.h) / (b.h - a.h);
  splineColor(s.top, 'top', i, t);
  splineColor(s.horizon, 'horizon', i, t);

  // Sun travels on a tilted circle: rises behind the hill (left), sets on the open right.
  const ang = ((h - 6) / 12) * Math.PI;
  s.sunDir.set(-Math.cos(ang) * 0.9, Math.sin(ang), -0.45).normalize();
  s.elev = s.sunDir.y;
  s.sunColor.copy(ORANGE).lerp(WHITE, sm(s.elev, 0.05, 0.5));

  s.dayAmt = sm(s.elev, -0.12, 0.25);
  s.nightAmt = sm(-s.elev, 0.0, 0.3);
  s.twilight = 1 - sm(Math.abs(s.elev), 0.0, 0.3);
  s.fireflyAmt = sm(-s.elev, -0.12, 0.12);
  return s;
}
