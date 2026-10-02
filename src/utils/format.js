// "13.5" -> "13:30"
export function formatHour(h) {
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// Frame-rate independent exponential smoothing factor.
// Use as: value += (target - value) * damp(rate, dt)
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export const rand = (min, max) => min + Math.random() * (max - min);
