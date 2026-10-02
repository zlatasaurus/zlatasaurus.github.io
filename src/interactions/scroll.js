// Converts the page scroll position into a 0..1 progress value.
export function createScroll(spacer, pageHeightVh, onChange) {
  spacer.style.height = `${pageHeightVh}vh`;
  let enabled = true;

  function read() {
    if (!enabled) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
    onChange(progress);
  }
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);

  return {
    read,
    setEnabled(v) { enabled = v; document.body.classList.toggle('locked', !v); if (v) read(); },
  };
}
