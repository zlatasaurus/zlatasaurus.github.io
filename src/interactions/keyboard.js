// Tracks which keys are currently held.
export function createKeyboard({ shouldCapture = () => false } = {}) {
  const down = new Set();
  addEventListener('keydown', (e) => {
    down.add(e.code);
    // Stop arrows/space from scrolling the page while playing.
    if (shouldCapture() && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  return { any: (...codes) => codes.some((c) => down.has(c)) };
}
