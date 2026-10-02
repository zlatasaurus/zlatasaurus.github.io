import { formatHour } from '../utils/format.js';

// Builds the "tracklist" of topics. Each row shows the hour the sky will
// be at when that row is reached by scrolling.
export function createList(el, topics, timeCfg) {
  const items = topics.map((t, i) => {
    const hour = timeCfg.startHour + (i / (topics.length - 1)) * timeCfg.hoursAcrossPage;
    const a = document.createElement('a');
    a.className = 'item';
    a.href = `#/${t.id}`;
    a.innerHTML = `
      <span><sup>${String(i + 1).padStart(2, '0')}.</sup><span class="name"></span><span class="tag"></span></span>
      <time>${formatHour(hour)}</time>`;
    a.querySelector('.name').textContent = t.name;
    a.querySelector('.tag').textContent = t.tag;
    el.appendChild(a);
    return a;
  });

  let active = -1;
  return {
    setProgress(p) {
      const idx = Math.round(p * (items.length - 1));
      if (idx === active) return;
      active = idx;
      items.forEach((a, i) => a.classList.toggle('active', i === idx));
    },
  };
}
