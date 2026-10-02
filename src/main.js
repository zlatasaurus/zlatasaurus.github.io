import * as THREE from 'three';
import { SETTINGS } from './config/settings.js';
import { SITE, TOPICS } from './config/content.js';
import { createTimeState, sampleTimeOfDay } from './config/timeOfDay.js';
import { damp } from './utils/format.js';

import { createStage } from './scene/stage.js';
import { createSky } from './scene/sky.js';
import { createClouds } from './scene/clouds.js';
import { createLights } from './scene/lights.js';
import { createHill } from './scene/hill.js';
import { createGrass } from './scene/grass.js';
import { createFireflies } from './scene/fireflies.js';
import { createNightSky } from './scene/nightSky.js';
import { createButterflies } from './scene/butterflies.js';
import { createArena } from './scene/arena.js';
import { createAsciiMode } from './scene/asciiMode.js';
import { createBallPhysics } from './physics/ball.js';

import { createPointer } from './interactions/pointer.js';
import { createKeyboard } from './interactions/keyboard.js';
import { createScroll } from './interactions/scroll.js';
import { createRouter } from './interactions/router.js';

import { createHeader } from './ui/header.js';
import { createList } from './ui/list.js';
import { createPanel } from './ui/panel.js';
import { updateInk } from './ui/theme.js';

// ---------------------------------------------------------------- state
let mode = 'landing'; // 'landing' | 'panel' | 'play'
let hourTarget = SETTINGS.time.startHour;
let hour = hourTarget;
const time = createTimeState();

// ---------------------------------------------------------------- UI
const header = createHeader(SITE);
const list = createList(document.getElementById('list'), TOPICS, SETTINGS.time);
const panel = createPanel(document.getElementById('panel'), document.getElementById('panel-body'));
const landingEl = document.getElementById('landing');
const hudEl = document.getElementById('hud');

// ---------------------------------------------------------------- 3D world
const { renderer, scene, camera, resize, onResize } = createStage(document.getElementById('scene'), SETTINGS);
// ?ascii forces ASCII on, ?ascii=0 forces it off; otherwise use settings.
const asciiParam = new URLSearchParams(location.search).get('ascii');
const ascii = (asciiParam === null ? SETTINGS.render.ascii : asciiParam !== '0')
  ? createAsciiMode(renderer, SETTINGS.render.asciiOptions)
  : null;
if (ascii) onResize(() => ascii.setSize(innerWidth, innerHeight));
const sky = createSky(SETTINGS);
const clouds = createClouds(SETTINGS.clouds);
const lights = createLights();
const hill = createHill(SETTINGS);
const fireflies = createFireflies(SETTINGS, hill);
const nightSky = createNightSky(SETTINGS.nightSky);
const butterflies = createButterflies(SETTINGS.butterflies, hill);
const arena = createArena();
scene.add(sky.group, nightSky.group, clouds.group, lights.group, hill.mesh, fireflies.points, butterflies.group, arena.group);

const eye = new THREE.Vector3(0, (hill.surfaceY(0, 0) ?? 0) + SETTINGS.camera.eyeHeight, 0);
const lookAtLanding = eye.clone().add(new THREE.Vector3(...SETTINGS.camera.lookOffset));

let grass = null;
createGrass(SETTINGS, hill, eye).then((g) => { grass = g; scene.add(g.mesh); });

// ---------------------------------------------------------------- input
const pointer = createPointer();
const keyboard = createKeyboard({ shouldCapture: () => mode === 'play' });
const ball = createBallPhysics(arena, keyboard);
const scroll = createScroll(document.getElementById('scroll-space'), SETTINGS.scroll.pageHeightVh, (p) => {
  hourTarget = SETTINGS.time.startHour + p * SETTINGS.time.hoursAcrossPage;
  list.setProgress(p);
});

// Click empty sky to burst a cloud (clicks on links/text are ignored).
addEventListener('pointerdown', (e) => {
  if (mode !== 'landing' || e.target.closest('a, header')) return;
  const ray = pointer.ray(camera);
  if (ray) { clouds.burst(ray); nightSky.wish(ray, time); }
});

function setMode(m) {
  mode = m;
  scroll.setEnabled(m === 'landing');
  landingEl.classList.toggle('hidden', m !== 'landing');
  hudEl.classList.toggle('hidden', m !== 'play');
  if (m !== 'panel') panel.hide();
  const inPlay = m === 'play';
  arena.group.visible = inPlay;
  hill.mesh.visible = !inPlay;
  fireflies.points.visible = !inPlay;
  butterflies.group.visible = !inPlay;
  if (grass) grass.mesh.visible = !inPlay;
}

const router = createRouter(TOPICS, {
  onLanding: () => setMode('landing'),
  onTopic: (t) => { setMode('panel'); panel.show(t); },
  onGame: () => setMode('play'),
});

// ---------------------------------------------------------------- loop
const camPos = eye.clone(), camLook = lookAtLanding.clone();
const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
const clock = new THREE.Clock();

function frame() {
  const rawDt = Math.min(clock.getDelta(), 0.5);
  const dt = Math.min(rawDt, 0.05); // physics/animation step stays small
  const t = clock.elapsedTime;

  // Time of day eases toward the scroll target (frame-rate independent).
  hour += (hourTarget - hour) * damp(SETTINGS.time.smoothing, rawDt);
  sampleTimeOfDay(hour, time);
  sky.update(time, camera);
  nightSky.update(time, camera, dt);
  lights.update(time);
  header.setHour(hour);
  updateInk(time);

  const ray = mode === 'landing' ? pointer.ray(camera) : null;
  clouds.update(time, ray, dt);
  if (mode !== 'play') {
    grass?.update(time, lights, ray, dt, t);
    fireflies.update(time, ray, dt, t);
    butterflies.update(time, ray, dt, t);
  }
  ball.step(dt, mode === 'play');

  if (mode === 'play') {
    const b = arena.ball.position;
    wantPos.set(b.x, 9, b.z + 14);
    wantLook.copy(b);
    lights.sun.target.position.copy(b);
  } else {
    const { x, y } = SETTINGS.camera.parallax;
    wantPos.copy(eye).add({ x: pointer.ndc.x * x, y: pointer.ndc.y * y + Math.sin(t * 0.3) * 0.05, z: 0 });
    wantLook.copy(lookAtLanding);
    lights.sun.target.position.set(0, 0, 0);
  }
  camPos.lerp(wantPos, damp(4, dt));
  camLook.lerp(wantLook, damp(4, dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  if (ascii) ascii.render(scene, camera);
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
router.route();
scroll.read();
frame();
