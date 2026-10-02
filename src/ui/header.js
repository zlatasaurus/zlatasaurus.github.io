import { formatHour } from '../utils/format.js';

export function createHeader(site) {
  document.getElementById('site-title').textContent = site.title;
  document.getElementById('tagline').textContent = site.tagline;
  document.getElementById('fine-print').textContent = site.finePrint;
  document.title = site.title;
  const clock = document.getElementById('clock');
  let last = '';
  return {
    setHour(h) {
      const s = formatHour(h);
      if (s !== last) clock.textContent = last = s;
    },
  };
}
