// Full-screen viewer for photos and videos (news articles, the Gallery, event
// posters and brochures).
//   SLICNA_VIEWER.open(items, index)   items: [{ src, type: 'image' | 'video', caption }]
// Arrow keys, swipe or the ‹ › buttons move through the items; Escape or × closes.
// Videos play with their own controls and stop when you move on or close.
// Photos can be zoomed to read small print (brochures): + / − buttons, a click
// on the photo (zooms in there; click again to fit), Ctrl + scroll or a
// trackpad pinch. When zoomed, drag (or scroll) to move around; Escape returns
// to the fitted size first.
const SLICNA_VIEWER = (() => {
  const ZOOMS = [1, 1.5, 2, 3, 4]; // times the fitted size
  let el = null;
  let items = [];
  let index = 0;
  let lastFocus = null;
  let touchX = null;
  let zoom = 1;
  let baseWidth = 0; // the photo's fitted width, in CSS pixels
  let drag = null;

  const $ = (sel) => el.querySelector(sel);
  const img = () => $('.viewer-media img');

  function build() {
    el = document.createElement('div');
    el.className = 'lightbox viewer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Photo viewer');
    el.innerHTML = `
      <div class="viewer-tools">
        <div class="viewer-zoom" role="group" aria-label="Zoom">
          <button type="button" data-zoom="-1" aria-label="Zoom out">&minus;</button>
          <span class="viewer-zoom-level" aria-live="polite">100%</span>
          <button type="button" data-zoom="1" aria-label="Zoom in">+</button>
        </div>
        <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
      </div>
      <button class="viewer-nav viewer-prev" type="button" aria-label="Previous">&#8249;</button>
      <figure class="viewer-stage"><div class="viewer-media"></div><figcaption class="viewer-caption"></figcaption></figure>
      <button class="viewer-nav viewer-next" type="button" aria-label="Next">&#8250;</button>
      <p class="viewer-count" aria-live="polite"></p>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.lightbox-close')) close();
      else if (e.target.closest('[data-zoom]')) stepZoom(Number(e.target.closest('[data-zoom]').dataset.zoom));
      else if (e.target.closest('.viewer-prev')) move(-1);
      else if (e.target.closest('.viewer-next')) move(1);
      else if (e.target === img()) {
        // A click (not the end of a drag) zooms in at that spot, or back to fit.
        if (drag && drag.moved) return;
        if (zoom === 1) setZoom(2, e.clientX, e.clientY);
        else setZoom(1);
      } else if (e.target === el || (zoom === 1 && e.target.classList.contains('viewer-media'))) close();
    });

    // Drag to move around a zoomed photo.
    const media = $('.viewer-media');
    media.addEventListener('pointerdown', (e) => {
      if (zoom === 1 || e.pointerType === 'touch') return; // touch scrolls natively
      drag = { x: e.clientX, y: e.clientY, left: media.scrollLeft, top: media.scrollTop, moved: false };
      media.setPointerCapture(e.pointerId);
    });
    media.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      media.scrollLeft = drag.left - dx;
      media.scrollTop = drag.top - dy;
    });
    const endDrag = () => { setTimeout(() => { drag = null; }, 0); };
    media.addEventListener('pointerup', endDrag);
    media.addEventListener('pointercancel', endDrag);
    // Ctrl + scroll (and trackpad pinch) zooms.
    media.addEventListener('wheel', (e) => {
      if (!e.ctrlKey || !img()) return;
      e.preventDefault();
      stepZoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    }, { passive: false });

    // Swipe between items (not while zoomed: then a swipe moves the photo).
    el.addEventListener('touchstart', (e) => { touchX = zoom === 1 && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', (e) => {
      if (!el.classList.contains('is-open')) return;
      if (e.key === 'Escape') { if (zoom > 1) setZoom(1); else close(); }
      else if (e.key === 'ArrowLeft' && zoom === 1) move(-1);
      else if (e.key === 'ArrowRight' && zoom === 1) move(1);
      else if (e.key === '+' || e.key === '=') stepZoom(1);
      else if (e.key === '-') stepZoom(-1);
    });
    window.addEventListener('resize', () => { if (el.classList.contains('is-open') && zoom > 1) setZoom(1); });
  }

  // Zooms to `level`, keeping the point under (cx, cy) in place (default: the centre).
  function setZoom(level, cx, cy) {
    const image = img();
    if (!image) return;
    const media = $('.viewer-media');
    if (zoom === 1) baseWidth = image.getBoundingClientRect().width;
    const before = image.getBoundingClientRect();
    const px = cx === undefined ? 0.5 : (cx - before.left) / before.width;
    const py = cy === undefined ? 0.5 : (cy - before.top) / before.height;
    zoom = level;
    el.classList.toggle('is-zoomed', zoom > 1);
    image.style.width = zoom > 1 ? `${Math.round(baseWidth * zoom)}px` : '';
    $('.viewer-zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    el.querySelector('[data-zoom="-1"]').disabled = zoom === ZOOMS[0];
    el.querySelector('[data-zoom="1"]').disabled = zoom === ZOOMS[ZOOMS.length - 1];
    if (zoom > 1) {
      const after = image.getBoundingClientRect();
      const tx = cx === undefined ? media.clientWidth / 2 : cx;
      const ty = cy === undefined ? media.clientHeight / 2 : cy;
      media.scrollLeft += after.left + px * after.width - tx;
      media.scrollTop += after.top + py * after.height - ty;
    }
  }

  function stepZoom(dir, cx, cy) {
    const i = ZOOMS.indexOf(zoom);
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + dir))];
    if (next !== zoom) setZoom(next, cx, cy);
  }

  function show() {
    const item = items[index];
    const media = $('.viewer-media');
    zoom = 1;
    el.classList.remove('is-zoomed');
    media.innerHTML = item.type === 'video'
      ? `<video src="${item.src}" controls autoplay playsinline></video>`
      : `<img src="${item.src}" alt="${SLICNA.escapeHtml(item.caption || '')}" draggable="false">`;
    $('.viewer-zoom').hidden = item.type === 'video';
    $('.viewer-zoom-level').textContent = '100%';
    el.querySelector('[data-zoom="-1"]').disabled = true;
    el.querySelector('[data-zoom="1"]').disabled = false;
    $('.viewer-caption').textContent = item.caption || '';
    $('.viewer-count').textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    el.querySelectorAll('.viewer-nav').forEach((b) => { b.hidden = items.length < 2; });
  }

  function move(step) {
    if (items.length < 2) return;
    index = (index + step + items.length) % items.length;
    show();
  }

  function open(list, start = 0) {
    if (!list.length) return;
    if (!el) build();
    items = list;
    index = Math.max(0, Math.min(start, list.length - 1));
    lastFocus = document.activeElement;
    show();
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('.lightbox-close').focus();
  }

  function close() {
    el.classList.remove('is-open', 'is-zoomed');
    $('.viewer-media').innerHTML = ''; // stops a playing video
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  return { open };
})();
