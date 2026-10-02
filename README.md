# Developer Notes

Zlata's Portfolio is a single-page three.js site. You land on an album-back-style "tracklist" of topics over a grassy hill, and scrolling moves the sky through a full day: noon → sunset → midnight → sunrise → noon. Each topic is a link. "Play" opens a small level where you roll a ball.

These notes explain how the site is put together and the reasoning behind the maths, so you can change things with confidence.

---

## 1. Running it

There's no build step. The browser loads ES modules directly, and three.js comes from a CDN through the import map in `index.html`. Modules don't load from `file://`, so serve the folder:

```bash
python -m http.server 5173
```

Then open http://localhost:5173. You need internet access for the three.js CDN and Google Fonts.

---

## 2. File structure

```
index.html                 page skeleton, fonts, import map
styles/
  base.css                 fonts, colour tokens (--ink), shared .pill button
  landing.css              header + tracklist layout
  panel.css                topic overlay + photo gallery
  hud.css                  ball-game overlay
src/
  main.js                  wires everything together + the render loop
  config/                  <- EDIT THESE FIRST
    content.js             ALL TEXT: site title, fine print, topics, photos
    settings.js            ALL TUNABLE NUMBERS + optional asset paths
    timeOfDay.js           sky colour keyframes + sun/moon maths
  scene/                   things you can see
    stage.js               renderer, scene, camera, resize
    sky.js                 sky dome shader (gradient, sun, moon, PSX dither) + stars
    clouds.js              volumetric puff clouds (hover to push, click to burst)
    lights.js              hemisphere, sun, moon lights
    hill.js                the hill sphere + analytic height/ray helpers
    grass.js               instanced, mouse-reactive grass
    fireflies.js           dusk/night fireflies
    nightSky.js            planets + shooting stars (night only)
    butterflies.js         daytime butterflies
    asciiMode.js           optional GPU ASCII-art renderer
    arena.js               the "Play" level meshes
  physics/
    ball.js                ball movement, collisions, rolling
  interactions/            user input
    pointer.js             mouse -> world ray
    keyboard.js            held-key tracking
    scroll.js              scroll -> 0..1 progress
    router.js              #/hash routing
  ui/                      DOM pieces
    header.js, list.js, panel.js, theme.js
  textures/
    procedural.js          canvas-drawn textures (ground, cloud puff, planets, rings, wings, ball)
  utils/
    format.js              formatHour, damp(), rand()
assets/
  models/                  put grass.glb here
  textures/skybox/         put skybox images here
  photos/                  put topic photos here
```

**Common edits**

| I want to...                     | Edit                                                       |
|----------------------------------|------------------------------------------------------------|
| change text / add a topic        | `src/config/content.js`                                    |
| change the tagline               | `SITE.tagline` in `src/config/content.js`                  |
| tune cloud look / interaction    | `clouds` in `settings.js`                                  |
| move/add planets, shooting stars | `nightSky` in `settings.js`                                |
| butterfly count, colours, speed  | `butterflies` in `settings.js` (`palettes` = wing colours) |
| ASCII look on/off, density       | `render` in `settings.js`; `?ascii` / `?ascii=0` in the URL |
| add photos to a topic            | drop files in `assets/photos/…`, list them in `photos: []` |
| change the sky colours           | `KEYS` in `src/config/timeOfDay.js`                        |
| make time move slower/faster     | `scroll.pageHeightVh`, `time.smoothing` in `settings.js`   |
| more/less grass or fireflies     | `grass.count`, `fireflies.count` in `settings.js`          |
| change fonts or the red colour   | `styles/base.css`, `src/ui/theme.js`                       |

---

## 3. Design choices

- **Layout.** The page mirrors an album back cover. There's a logo top-left, tiny legal-style fine print in the centre and a badge top-right. The numbered tracklist sits right of centre, with "durations" right-aligned. Here the duration column shows the hour of day each topic sits at, which ties the list to the sky.
- **Type.** Titles and topic names use Plus Jakarta Sans at weight 800/700, with tight negative tracking for the poster feel. Numbers, tags, times and fine print use Space Mono, which looks like printed liner notes.
- **Red ink.** The text stays red at every hour, but `ui/theme.js` blends it toward a softer coral as daylight fades, so it stays readable on a dark sky. It's exposed as the CSS variable `--ink`.
- **PSX look.** The PSX skybox pack was the visual reference for the sky, which uses ordered (Bayer) dithering and colour banding. Turn this off with `sky.psxDither: false`. Clouds are deliberately softer, to feel immersive and touchable.
- **Assets.** There are no required assets. Every texture is procedural, so the site works with no image files. The Sketchfab models are optional upgrades (see §10).

---

## 4. Time of day

**Scroll → hour.** `interactions/scroll.js` turns `scrollY` into `progress ∈ [0, 1]`:

```
hourTarget = startHour + progress × hoursAcrossPage      (12 → 36, i.e. noon → noon)
```

**Smoothing.** The displayed hour chases the target with frame-rate-independent exponential smoothing:

```
hour += (hourTarget − hour) × (1 − e^(−k·dt))            // utils/format.js → damp()
```

A naive `hour += (target − hour) × 0.1` runs twice as fast at 120 Hz as at 60 Hz. Using `1 − e^(−k·dt)` makes the result depend only on real elapsed time. `k` is `time.smoothing`: lower values give a lazier, dreamier sky.

**Colour keyframes.** `timeOfDay.js` stores `[hour, zenith colour, horizon colour]` keys. Between keys the colours are blended with a Catmull-Rom spline rather than straight lerps. Linear blending has a visible kink at every key, where the rate of change jumps. Catmull-Rom passes through every key but its slope is continuous (C¹), so the transitions feel smooth:

```
C(t) = ½ [ 2P₁ + (−P₀+P₂)t + (2P₀−5P₁+4P₂−P₃)t² + (−P₀+3P₁−3P₂+P₃)t³ ]
```

The key lookup wraps around midnight, so 23:00 → 01:00 blends cleanly. Results are clamped to [0, 1] because splines can overshoot slightly.

**Sun path.** The sun moves on a tilted circle:

```
angle = (hour − 6) / 12 × π
sunDir = normalize( −cos(angle)·0.9,  sin(angle),  −0.45 )
```

At 06:00 the sun is on the left horizon (behind the hill), at 12:00 it's overhead, and at 18:00 it sets on the open right side. The moon is simply `−sunDir`.

**Derived factors.** All of these use `smoothstep` on the sun's height `elev = sunDir.y`, so nothing ever pops:

| factor       | meaning                     | used by                                  |
|--------------|-----------------------------|------------------------------------------|
| `dayAmt`     | 0 night → 1 day             | light levels, clouds, ink, butterflies   |
| `nightAmt`   | star visibility             | stars, planets, shooting stars           |
| `twilight`   | peaks when sun ≈ horizon    | skybox sunset image weight               |
| `fireflyAmt` | evening + night             | fireflies                                |

---

## 5. Sky shader (`scene/sky.js`)

The sky is a 500-unit sphere rendered from the inside (`BackSide`). It follows the camera every frame, so you can never reach its edge. Per pixel, `d` is the view direction:

1. **Gradient:** `mix(horizon, top, pow(d.y, 0.55))`. The exponent below 1 makes the horizon colour hug the bottom, as a real sky does. Below the horizon it fades to a darker horizon colour.
2. **Optional skybox images.** Equirectangular lookup: `u = atan(z, x)/2π + ½`, `v = asin(y)/π + ½`. Day, sunset and night images are weighted by `dayAmt` and `twilight`, then mixed over the gradient.
3. **Sun.** Two glow lobes, `pow(cosθ, 6)` (wide haze) and `pow(cosθ, 64)` (tight halo), plus a hard disc from `smoothstep` near cosθ = 1. The moon uses the same idea in the opposite direction.
4. **PSX dither.** A 4×4 Bayer matrix gives each screen pixel a threshold `b ∈ [0, 1)`. Then `col = floor(col·L + b) / L` quantises to `L` levels. The threshold pattern turns the bands into the characteristic cross-hatch.

---

## 5b. Clouds (`scene/clouds.js`)

Each cloud is a cluster of overlapping soft **puff sprites**, 14 by default, rather than a single flat image. The puffs are spread through a flattened ellipsoid (`x ± size`, `y ∈ [0, 0.4·size]`, `z ± 0.45·size`). Taking `|rand|` for the height gives cumulus clouds a flat underside. Clouds also sit at depths from 60 to 260 units, so near ones drift past with real parallax.

- **Shading.** Each puff has `shade = 0.72 + 0.28 · (localY / maxY)`. Its colour is a lerp from a *belly* colour (white tinted toward the horizon colour) to a *lit* colour (white tinted toward the sun colour). Tops catch the light, undersides pick up dusk pinks, and everything dims with `dayAmt`.
- **Hover push.** For each puff we take its perpendicular distance `d` from the mouse ray, using the same closest-point-on-ray maths as the fireflies. Within `mouseRadius × puffSize`, the puff gets velocity `away · push · (1 − d/R) · dt · puffSize`. Bigger puffs move more, which keeps the motion looking scale-correct at any depth.
- **Click burst.** A click on empty sky (not on a link or the header) gives every puff within `1.6 × cloudSize` of the ray an outward impulse plus a random upward kick.
- **Reforming.** Each puff sits on a weak spring, `v += −spring·disp·dt` with `v *= e^(−damping·dt)`. It's low stiffness and light damping, so a burst cloud drifts apart, hangs, then slowly breathes back into shape.
- **Thinning.** Opacity drops by up to 60 % as a puff is pushed out by one puff-width, so torn wisps look like thinning vapour rather than solid balls.

---

## 6. Hill (`scene/hill.js`)

The hill is one big sphere: centre `C = (−25, −120, −20)`, radius `r = 120`. Only its cap pokes above the frame. Because it's analytic we never raycast triangles:

- **Ground height:** `y = Cy + √(r² − (x−Cx)² − (z−Cz)²)`. This is used to place the camera, the grass and the fireflies.
- **Surface normal:** `n = (p − C) / r`.
- **Mouse picking (ray–sphere):** For a ray `o + t·d`, solve `|o + t·d − C|² = r²`. With `oc = o − C`, `b = oc·d` and `c = |oc|² − r²`, the hit is `t = −b − √(b² − c)` when `b² − c ≥ 0`. That's one square root per frame instead of testing about 12k triangles.

---

## 7. Grass (`scene/grass.js`)

**Instancing.** All of the grass, about 70k blades, is one `InstancedMesh`. That means one geometry, one material and one draw call. Each instance has a transform matrix and a random value `aRand`.

**Placement.** Positions are rejection-sampled over the hill. `z` is sampled as `near + rand^1.6 · (far − near)`, which puts more blades near the camera where you can see them. Each blade is rotated so its "up" is the sphere normal (`Quaternion.setFromUnitVectors`), then given a random yaw. Far blades are scaled up by `1 + dist·distanceScale` so the crest stays furry instead of thinning to nothing.

**Blade geometry.** A tapered strip of 5 quads ending in a point, 1 unit tall. The attribute `aH` (0 at the root, 1 at the tip) drives everything in the shader. If you supply a GLB, it's normalised to the same convention: root at y = 0, height 1, and `aH = y`.

**Bending (vertex shader).** The displacement is weighted by `aH²`. Roots stay planted and the tip moves most, which approximates a cantilever beam bending.

- **Wind:** `windDir · (gust·0.8 + flutter) · windStrength`
  - `gust = ½ + ½·sin(1.3t + 0.18x + 0.12z)`: a slow wave that travels across the field.
  - `flutter = 0.15·sin(5t + 30·aRand)`: fast, per-blade jitter.
- **Mouse:** For each blade root, `toBlade` is the vector from the cursor's hit point, flattened onto the ground plane. The falloff is `(1 − smoothstep(0, radius, |toBlade|)) · strength`, and the push is `(normalize(toBlade)·0.7 + mouseDir) · falloff`. Blades lean away from the cursor and along the direction it's moving.
- The offset is projected to be tangent to the surface. The tip is also dipped by `0.4·|offset|·aH`, so a bent blade gets shorter rather than stretching.

**Mouse dynamics (CPU).**
- `mouseDir` follows the cursor's world velocity through an **underdamped spring** (`k = 40`, damping `5`). When you stop or leave, the blades overshoot slightly and wobble back, which reads as "sway".
- `strength` rises quickly (rate 10) and decays slowly (rate 2.5), so the grass reacts at once but relaxes gently.

**Lighting.** A cheap Lambert term in the fragment shader: `colour · (ambient + key · max(n·L, 0))`. The ambient and key colours are copied from the scene's hemisphere and sun or moon lights each frame, so the grass always matches the sky.

---

## 8. Fireflies (`scene/fireflies.js`)

These are inspired by [thebenezer/threejs-fireflies](https://github.com/thebenezer/threejs-fireflies): additive point sprites whose glow is `0.08/d − 0.16`, where `d` is the distance from the sprite centre. That gives a bright core with a soft 1/d halo, and additive blending makes overlapping flies bloom.

Each firefly's position is the sum of three motions:

1. **Twirl (Lissajous loop):**
   ```
   a = t·w + φ₁
   base = home + ( cos(a)·r + sin(0.11t + φ₂)·drift,
                   sin(1.7a + φ₂)·r·0.5,
                   sin(a)·r + cos(0.09t + φ₁)·drift )
   ```
   The XZ circle with an incommensurate 1.7× vertical bob traces a never-quite-repeating loop. Half of them spin the other way (`w < 0`), and the slow `drift` terms make the home point wander.
2. **Mouse push.** The cursor is a ray, not a point, because fireflies sit at different depths. For each fly we find the closest point on the ray, `C = o + d·((P−o)·d)`, and the perpendicular vector `away = P − C`. Inside `mouseRadius` we add velocity of `(away·18 + (d × away)·10) · falloff`. The cross-product term makes them spiral around the cursor rather than just scatter.
3. **Return spring:** a spring-damper on the offset, `v += (−2·offset − 1.5·v)·dt`. It's lightly underdamped, so they drift back to their path with a lazy overshoot.

The shader blinks each fly with `pow(½ + ½·sin(…), 2)`, which gives short bright pulses and longer dim stretches. An `excite` value (0–1) set by the mouse makes touched flies bigger and whiter, and it decays at 0.6/s. The whole swarm fades with `fireflyAmt`, so they appear as the sun sets and leave at dawn.

---

## 8b. Night sky (`scene/nightSky.js`)

**Planets.** Spheres placed 380 units out along a direction `dir`, inside the 500-unit sky dome. The whole group is re-centred on the camera every frame, so they never shift with parallax, like real distant objects.

- **Texture:** procedural gas-giant bands. Each 2×2 cell picks a band by `y + wobble(x, y)`, where the wobble is a sum of sines, so the stripes swirl rather than run ruler-straight.
- **Lighting:** a custom shader does Lambert lighting, `0.06 + max(n·L, 0)·1.1`. `L` points mostly back toward the viewer (`−dir`) and is nudged sideways, so each planet shows a gibbous phase with a visible terminator.
- **Rings:** a `RingGeometry` with a concentric-band canvas texture. RingGeometry UVs are planar, so the canvas centre is the planet centre. The planet writes depth, which hides the back half of the ring behind the planet.
- **Visibility:** opacity is `nightAmt`.

**Shooting stars.** There's a pool of `maxActive` quads, so nothing is allocated at runtime.

- **Spawning:** a timer counts down at `dt × nightAmt`, so meteors come more often the darker it is and never by day.
- **Path:** each one starts at a random direction on a sphere and moves in a straight line, mostly diagonally downward.
- **Shape:** each frame the quad is rebuilt from head to tail. Its length is `min(age·speed, length)`, so the trail grows out of the start point. Its width runs from `width` at the head to 10 % at the tail. The quad's side vector is `motion × headPosition`, which is perpendicular to both the motion and the line of sight, so the streak always faces the viewer.
- **Fade:** the alpha along the streak is `t²` (bright head, fading tail). Over its life the brightness follows `sin(π·age/life)`.
- **Make a wish:** clicking the night sky spawns a meteor at the cursor's direction.

---

## 8c. Butterflies (`scene/butterflies.js`)

**Model.** Each butterfly is a body plus two wing planes hinged on the body axis. The plane geometry is shifted so `x = 0` is the hinge, and the left wing is the right one mirrored (`scale.x = −1`). Wing art is drawn on a canvas: a bezier-shaped forewing and hindwing, a gradient fill, veins, a dark border and spots, one palette per species.

**Flapping.** The wing angle is `sin(phase)·1.05 + 0.25`. The offset keeps the wings slightly raised, the way butterflies rest. `phase` advances at `flapRate`, doubled when scared. The body bobs with `sin(phase)`, which sells the lift from each beat.

**Flight (wander steering):**
- Each butterfly has a random target point above the grass. It picks a new one on arrival or after 2–6 s.
- `desired = normalize(target − pos)·speed` plus sine jitter on x and y, which makes the flight fluttery and irregular.
- `vel` lerps toward `desired` with `1 − e^(−steer·dt)`, which gives smooth, frame-rate-independent turns.
- The body faces its velocity (`lookAt(pos + vel)`).
- Butterflies are kept 0.3 units above the hill surface using `hill.surfaceY`.

**Mouse.** Same closest-point-on-ray test as the fireflies. Inside `fleeRadius` they get an outward and upward impulse, plus a `scare` value that speeds up both flight and wingbeat and decays at 0.5/s.

**Day only.** The scale is multiplied by `smoothstep(dayAmt, 0.55, 0.9)`, so they shrink away at dusk and reappear in the morning. Wings use unlit `MeshBasicMaterial`, so the colours read clearly against the bright sky even when seen from below.

---

## 8d. ASCII mode (`scene/asciiMode.js`)

`render.ascii: true` in settings turns this on. In the URL, `?ascii` forces it on and `?ascii=0` forces it off.

**Why a shader?** three.js ships an `AsciiEffect`, but it rebuilds an HTML table of coloured `<span>`s every frame. At high density that means tens of thousands of DOM nodes per frame, and the page froze. This version does everything on the GPU in one full-screen pass, so the character density barely affects speed.

**Pipeline per frame:**
1. Render the scene to the screen as usual.
2. `renderer.copyFramebufferToTexture` copies the finished image into a texture. We copy the final image rather than rendering into an off-screen target so colours match the normal mode exactly. Render targets skip three's output colour conversion, which would shift built-in and custom materials differently.
3. Draw a full-screen quad whose fragment shader does the following:
   - `cell = floor(pixel / cellSize)`, then samples the scene colour once at the cell centre.
   - `lum = dot(rgb, (0.299, 0.587, 0.114))` (Rec. 601 luma) and `tone = clamp(lum · gain, 0, 1)`.
   - The glyph index is `round(tone · (count − 1))`.
   - The glyph is looked up in the atlas at `((idx + fract(pixel/cell).x) / count, fract(pixel/cell).y)`.
   - The output is `sceneColour · backgroundTint + sceneColour · brightness · glyphMask`.

**Glyph atlas.** Every character in `charset` is drawn in Space Mono into a single 64-px-tall strip. The atlas is rebuilt once the web font has loaded.

**Ink sorting.** Characters are sorted by how much ink they actually cover. Each glyph is rendered off-screen and its white pixels are summed. Any glyph with zero ink is dropped, for example `_`, which sits outside the cell with this font. This keeps brightness → density strictly increasing. Before this was added, one range of sky brightness mapped to an invisible glyph, which showed up as large black patches.

**Tuning:**

| setting          | effect                                                          |
|------------------|-----------------------------------------------------------------|
| `cellSize`       | pixels per character; smaller = more characters                 |
| `gain`           | pushes mid-tones toward denser glyphs                           |
| `brightness`     | compensates for glyphs covering only part of the cell           |
| `backgroundTint` | faint scene colour behind the characters, for readability       |
| `color: false`   | single-colour terminal look using `monoColor`                   |

---

## 9. Ball physics (`physics/ball.js`)

The ball physics is hand-rolled rather than a physics engine (Rapier, Cannon). The world is a box with circular pillars, so about 60 lines covers it.

- **Integration:** semi-implicit Euler, so velocity is updated before position. It's more stable than explicit Euler for springs and bounces. `dt` is clamped to 0.05 s, so a tab coming back from the background doesn't tunnel the ball through walls.
- **Input:** WASD/arrows add `ACCEL·dt` along world X/Z. Space sets `vy = JUMP` only when grounded.
- **Friction:** `v *= e^(−FRICTION·dt)`. Exponential decay is frame-rate independent and never flips the sign of the velocity.
- **Gravity / ground:** `vy −= g·dt`. When the ball is below its radius, snap it up and zero `vy`.
- **Walls:** clamp the position and reflect with restitution, `v ← −0.5·v`.
- **Pillars:** circle-vs-circle in XZ. If `|ball − pillar| < r₁ + r₂`, push the ball out along the normal `n`, then reflect only the inward normal component: `v −= (1 + e)·(v·n)·n`. Tangential speed is kept, so the ball glances off naturally.
- **Rolling:** for rolling without slipping, a ball that travels distance `s` turns by `s / r` radians. The axis is `up × motion = (dz, 0, −dx)`. Applying `rotateOnWorldAxis` each frame accumulates in the quaternion, so the stripes roll correctly in any direction.

---

## 10. External assets (Sketchfab models)

Sketchfab downloads need a signed-in account, so download them yourself and check each model's licence. Most are CC-BY, which means you must credit the author on the site.

1. **Grass:** <https://sketchfab.com/3d-models/grass-674d42354f6348a7a85fc06a7f004db5>
   - Download it as **glTF Binary (.glb)** and save it as `assets/models/grass.glb`.
   - In `settings.js`, set `assets.grassModel: 'assets/models/grass.glb'`.
   - If the model is a clump of many blades, lower `grass.count` (try 3000–8000) and raise `grass.height`.
   - The loader uses the first mesh it finds, normalises it to 1 unit tall, and bends it with the same shader.
2. **PSX skybox pack:** <https://sketchfab.com/3d-models/psx-7-skybox-pack-8511fa3f80fb4c42a60b9b6e90b8dc94>
   - Export or extract the sky textures as **equirectangular** images (2:1 aspect).
   - Save them in `assets/textures/skybox/`.
   - Set `assets.skybox.day / sunset / night`.
   - They're blended by time of day and keep the dithering on top. Any slot left `null` falls back to the procedural gradient.

---

## 11. Performance notes

- The grass is the main cost: 70k instances × 11 vertices. Halve `grass.count` on weak laptops.
- Fireflies update on the CPU (140 × a few vector ops), which is negligible. They skip updating entirely when invisible (daytime).
- The pixel ratio is capped at 2. Shadows only matter in the arena.
- Browsers pause `requestAnimationFrame` in hidden tabs. Time smoothing uses an unclamped `dt` (capped at 0.5 s) so the sky catches up when you return.

---

## 12. Routing

- `#/` shows the landing page.
- `#/<topic-id>` opens that topic's panel.
- `#/play` opens the ball game.

Routing is handled by `interactions/router.js`. Scrolling is locked (`body.locked`) whenever you leave the landing page, and the scroll position is kept for when you come back.
