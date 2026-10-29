document.addEventListener('DOMContentLoaded', async () => {
  const chipsEl = document.getElementById('album-chips');
  const gridEl = document.getElementById('gallery-grid');
  const lightbox = document.getElementById('lightbox');
  const esc = SLICNA.escapeHtml;
  let albums = [];

  function render(albumId) {
    const photos = albums
      .filter((a) => albumId === 'all' || String(a.id) === albumId)
      .flatMap((a) => (a.photos || []).map((p) => ({ ...p, album: a.title })));
    gridEl.innerHTML = photos.map((p) => `
      <figure tabindex="0" data-src="${esc(p.url)}" data-caption="${esc(p.caption || p.album)}">
        <img src="${esc(p.url)}" alt="${esc(p.caption || p.album)}" decoding="async">
        <figcaption>${esc(p.caption || p.album)}</figcaption>
      </figure>`).join('') || '<p class="empty">No photos yet.</p>';
  }

  function open(fig) {
    lightbox.querySelector('img').src = fig.dataset.src;
    lightbox.querySelector('p').textContent = fig.dataset.caption;
    lightbox.classList.add('is-open');
    lightbox.querySelector('.lightbox-close').focus();
  }
  const close = () => lightbox.classList.remove('is-open');

  gridEl.addEventListener('click', (e) => { const fig = e.target.closest('figure'); if (fig) open(fig); });
  gridEl.addEventListener('keydown', (e) => { const fig = e.target.closest('figure'); if (fig && e.key === 'Enter') open(fig); });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.closest('.lightbox-close')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  try {
    albums = await SLICNA_API.albums();
    chipsEl.innerHTML = [{ id: 'all', title: 'All photos' }, ...albums]
      .map((a, i) => `<button class="chip" type="button" data-album="${esc(a.id)}" aria-pressed="${i === 0}">${esc(a.title)}</button>`).join('');
    chipsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chipsEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      render(chip.dataset.album);
    });
    render('all');
  } catch (err) {
    gridEl.innerHTML = '<p class="empty">The gallery could not be loaded right now.</p>';
  }
});
