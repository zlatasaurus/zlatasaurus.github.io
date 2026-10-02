import * as THREE from 'three';

// Hand-rolled ball physics for the arena. See README "Ball physics".
const ACCEL = 28;        // units/s² while a key is held
const FRICTION = 1.2;    // exponential rolling friction (per second)
const GRAVITY = 25;
const JUMP = 9;
const WALL_BOUNCE = 0.5; // fraction of speed kept after hitting a wall
const PILLAR_BOUNCE = 0.6;

export function createBallPhysics(arena, keyboard) {
  const { ball, pillars, half, ballRadius: R } = arena;
  const vel = new THREE.Vector3();
  let vy = 0;
  const axis = new THREE.Vector3();

  function step(dt, active) {
    if (active) {
      if (keyboard.any('KeyW', 'ArrowUp')) vel.z -= ACCEL * dt;
      if (keyboard.any('KeyS', 'ArrowDown')) vel.z += ACCEL * dt;
      if (keyboard.any('KeyA', 'ArrowLeft')) vel.x -= ACCEL * dt;
      if (keyboard.any('KeyD', 'ArrowRight')) vel.x += ACCEL * dt;
      if (keyboard.any('Space') && ball.position.y <= R + 1e-3) vy = JUMP;
    }

    // Semi-implicit Euler: update velocity first, then position.
    vel.multiplyScalar(Math.exp(-FRICTION * dt));
    vy -= GRAVITY * dt;
    const px = ball.position.x, pz = ball.position.z;
    ball.position.x += vel.x * dt;
    ball.position.z += vel.z * dt;
    ball.position.y += vy * dt;
    if (ball.position.y < R) { ball.position.y = R; vy = 0; }

    // Walls: clamp and reflect with energy loss.
    const lim = half - 0.5 - R;
    if (Math.abs(ball.position.x) > lim) { ball.position.x = Math.sign(ball.position.x) * lim; vel.x *= -WALL_BOUNCE; }
    if (Math.abs(ball.position.z) > lim) { ball.position.z = Math.sign(ball.position.z) * lim; vel.z *= -WALL_BOUNCE; }

    // Pillars: circle-vs-circle in the XZ plane.
    for (const p of pillars) {
      const dx = ball.position.x - p.x, dz = ball.position.z - p.z;
      const d = Math.hypot(dx, dz), min = p.r + R;
      if (d < min && d > 0) {
        const nx = dx / d, nz = dz / d;
        ball.position.x = p.x + nx * min;
        ball.position.z = p.z + nz * min;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= (1 + PILLAR_BOUNCE) * vn * nx;
          vel.z -= (1 + PILLAR_BOUNCE) * vn * nz;
        }
      }
    }

    // Rolling without slipping: angle = distance / radius around (up × motion).
    const mx = ball.position.x - px, mz = ball.position.z - pz;
    const dist = Math.hypot(mx, mz);
    if (dist > 1e-6) ball.rotateOnWorldAxis(axis.set(mz, 0, -mx).normalize(), dist / R);
  }

  return { step };
}
