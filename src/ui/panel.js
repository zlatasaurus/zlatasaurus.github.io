// Full-screen overlay showing one topic's text and photos.
export function createPanel(el, body) {
  function show(topic) {
    body.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = topic.name;
    const p = document.createElement('p');
    p.textContent = topic.body;
    body.append(h, p);

    if (topic.photos?.length) {
      const grid = document.createElement('div');
      grid.className = 'gallery';
      for (const src of topic.photos) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        grid.appendChild(img);
      }
      body.appendChild(grid);
    }
    el.classList.remove('hidden');
    el.scrollTop = 0;
  }
  return { show, hide: () => el.classList.add('hidden') };
}
