// Every tunable number in the site lives here. Tweak freely — nothing else
// needs to change. See README.md ("Developer Notes") for what each one does.

export const SETTINGS = {
  time: {
    startHour: 12,        // the hour shown when the page first loads (noon = blue sky)
    hoursAcrossPage: 24,  // scrolling top -> bottom advances the clock this many hours
    smoothing: 3,         // how quickly the sky catches up with the scroll (higher = snappier)
  },

  scroll: { pageHeightVh: 450 }, // longer page = slower, gentler time transitions

  clouds: {
    count: 16,
    puffsPerCloud: 14,
    size: [14, 34],          // cloud half-width in world units
    height: [18, 85],
    depth: [-60, -260],      // near clouds pass close enough to touch
    wrapX: 260,
    driftSpeed: [1, 3],
    mouseRadius: 0.7,        // × puff size: how close the cursor must be to push
    push: 6,                 // hover push strength
    burst: 40,               // click burst strength
    spring: 1.2,             // pull back to shape (lower = lazier reforming)
    damping: 1.4,
  },

  camera: {
    fov: 60,
    eyeHeight: 1.6,                 // height above the hill surface
    lookOffset: [0, 9, -30],        // where the camera looks, relative to the eye
    parallax: { x: 0.35, y: 0.12 }, // how far the camera drifts with the mouse
  },

  hill: { center: [-25, -120, -20], radius: 120 },

  grass: {
    count: 70000,            // lower this (e.g. 4000) if you use a heavy GLB clump model
    xRange: [-75, 45],
    zRange: [-3, -85],       // near -> far
    height: [0.22, 0.5],
    widthRatio: 0.12,        // procedural blade width relative to its height
    distanceScale: 0.03,     // far blades are scaled up so the crest stays furry
    windStrength: 0.18,
    mouseRadius: 3.2,        // world units around the cursor that react
    colors: { base: '#34501a', tip: '#a9bd5c' },
  },

  fireflies: {
    count: 140,
    xRange: [-30, 25],
    zRange: [-6, -40],
    heightAboveGround: [0.4, 4.5],
    size: 480,
    color: '#ffe27a',
    mouseRadius: 2.2,
  },

  nightSky: {
    planetDistance: 380,
    // dir: direction from the viewer (x right, y up, z = -1 is straight ahead)
    planets: [
      { dir: [-0.62, 0.48, -1], radius: 13, colors: ['#e8c890', '#c9a46a', '#f1dcb0', '#b88a52'], axialTilt: 0.3, spin: 0.03,
        ring: { inner: 1.35, outer: 2.3, color: '#e6d3a8', tilt: [1.25, 0.35] } },
      { dir: [0.95, 0.32, -1], radius: 6, colors: ['#d0603a', '#a8442a', '#e0805a'], spin: 0.05 },
      { dir: [0.12, 0.85, -1], radius: 4.5, colors: ['#6fa8dc', '#4a7fb5', '#a8d0f0'], spin: 0.04 },
    ],
    shootingStars: {
      maxActive: 4,
      interval: [1.5, 5],   // seconds between spawns at full night
      speed: [260, 420],
      life: [0.6, 1.2],
      length: 70,
      width: 0.9,
    },
  },

  butterflies: {
    count: 14,
    xRange: [-14, 12],
    zRange: [-6, -24],
    heightAboveGround: [0.6, 3.5],
    size: [0.4, 0.6],
    speed: 1.6,
    steer: 1.8,        // how quickly they turn toward a new target
    flapRate: 16,      // radians per second
    fleeRadius: 1.8,
    fleeForce: 30,
    palettes: [
      { base: '#f28a1e', edge: '#1b120c', accent: '#d9590f', dots: '#ffffff' }, // monarch
      { base: '#3f7dff', edge: '#0c1a3d', accent: '#7fb2ff', dots: '#d6e6ff' }, // morpho
      { base: '#ffe066', edge: '#5a4a10', accent: '#fff3b0', dots: '#ffffff' }, // lemon
      { base: '#ff9ad5', edge: '#5a1a3d', accent: '#ffd1ec', dots: '#ffffff' }, // pink
      { base: '#f7f5ee', edge: '#4a4a4a', accent: '#ffffff', dots: '#ff3b2f' }, // cabbage white
    ],
  },

  render: {
    ascii: false,          // or add ?ascii to the URL
    asciiOptions: {
      charset: ".'`^,:;Il!i~+-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$", // any order: sorted by ink coverage at runtime
      cellSize: 6,           // pixels per character: smaller = more characters / higher detail
      font: 'Space Mono',
      color: true,           // tint each character with the scene colour (false = monoColor)
      monoColor: '#d8ffd8',
      backgroundTint: 0.08,  // faint scene colour behind the characters (0 = pure black)
      brightness: 1.5,       // characters cover only part of a cell, so boost them a little
      gain: 1.8,             // brightness -> character density stretch (higher = denser glyphs)
    },
  },

  sky: {
    psxDither: true, // PS1-style ordered dithering + colour banding
    colorLevels: 40, // fewer levels = chunkier bands
  },

  // Optional external assets. Leave as null to use the procedural versions.
  assets: {
    grassModel: null, // e.g. 'assets/models/grass.glb'
    skybox: {         // equirectangular images, e.g. from the PSX skybox pack
      day: null,      // 'assets/textures/skybox/day.png'
      sunset: null,   // 'assets/textures/skybox/sunset.png'
      night: null,    // 'assets/textures/skybox/night.png'
    },
  },
};
