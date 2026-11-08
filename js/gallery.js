// Gallery, with two views (as on SLNA):
//   All    - every photo and video
//   Albums - one card per album; opening an album shows its photos and videos
// Any item opens the shared viewer (js/media-viewer.js) over the items shown.
// ?view=albums opens the album cards; ?album=<id> opens one album (used by
// "See the album in the Gallery" on news articles).
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const gridEl = document.getElementById('gallery-grid');
  const cardsEl = document.getElementById('album-cards');
  const headEl = document.getElementById('album-head');
  const countEl = document.getElementById('gallery-count');
  let albums = [];
  let shown = [];

  const itemsOf = (album) => (album.photos || []).map((p) => ({
    src: SLICNA.media(p.url), type: p.media_type || 'image', caption: p.caption || album.title,
  }));
  // "12 photos and 1 video"
  const countText = (items) => {
    const v = items.filter((m) => m.type === 'video').length;
    const ph = items.length - v;
    const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    return [ph && part(ph, 'photo'), v && part(v, 'video')].filter(Boolean).join(' and ') || 'Nothing yet';
  };

  function renderGrid(items) {
    shown = items;
    gridEl.hidden = false;
    gridEl.innerHTML = items.map((m, i) => `
      <figure tabindex="0" data-i="${i}" class="${m.type === 'video' ? 'is-video' : ''}">
        ${m.type === 'video'
          ? `<video src="${m.src}" muted preload="metadata" aria-label="Video: ${esc(m.caption)}"></video><span class="media-play" aria-hidden="true">&#9658;</span>`
          : `<img src="${m.src}" alt="${esc(m.caption)}" decoding="async" loading="lazy">`}
        <figcaption>${esc(m.caption)}</figcaption>
      </figure>`).join('') || '<p class="empty">No photos or videos yet.</p>';
  }

  // The address follows the view, so links and Back keep it.
  function setUrl(params) {
    const url = new URL(location.href);
    ['view', 'album'].forEach((k) => url.searchParams.delete(k));
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    history.replaceState(null, '', url);
  }

  function showAll() {
    headEl.hidden = true;
    cardsEl.hidden = true;
    const items = albums.flatMap(itemsOf);
    countEl.textContent = items.length ? countText(items) : '';
    renderGrid(items);
    setUrl({});
  }

  function showAlbums() {
    headEl.hidden = true;
    gridEl.hidden = true;
    cardsEl.hidden = false;
    countEl.textContent = `${albums.length} album${albums.length === 1 ? '' : 's'}`;
    cardsEl.innerHTML = albums.map((a) => {
      const cover = a.cover_photo ? SLICNA.media(a.cover_photo) : null;
      const coverHtml = !cover ? '<span class="album-card-empty">No photos yet</span>'
        : a.cover_media_type === 'video'
          ? `<video src="${cover}" muted preload="metadata"></video><span class="media-play" aria-hidden="true">&#9658;</span>`
          : `<img src="${cover}" alt="" loading="lazy">`;
      return `<a class="album-card" href="?album=${encodeURIComponent(a.id)}" data-album="${esc(a.id)}">
        <span class="album-card-cover">${coverHtml}<span class="album-card-count">${esc(countText(itemsOf(a)))}</span></span>
        <span class="album-card-body"><b>${esc(a.title)}</b>${a.event_date ? `<time>${esc(SLICNA.formatDate(a.event_date))}</time>` : ''}</span>
      </a>`;
    }).join('') || '<p class="empty">No albums yet.</p>';
    setUrl({ view: 'albums' });
  }

  function showAlbum(id) {
    const album = albums.find((a) => String(a.id) === String(id));
    if (!album) { showAlbums(); return; }
    document.querySelector('[name="view"][value="albums"]').checked = true;
    cardsEl.hidden = true;
    headEl.hidden = false;
    const items = itemsOf(album);
    const facts = [album.event_date && SLICNA.formatDate(album.event_date), countText(items)].filter(Boolean).map(esc).join(' · ');
    headEl.innerHTML = `<a href="?view=albums" class="link-back" data-back>&larr; All albums</a>
      <h2>${esc(album.title)}</h2>
      <p class="muted">${facts}${album.news_id ? ` · <a href="/pages/news-detail.html?id=${encodeURIComponent(album.news_id)}">Read the news article</a>` : ''}</p>`;
    countEl.textContent = '';
    renderGrid(items);
    setUrl({ album: album.id });
  }

  document.querySelectorAll('[name="view"]').forEach((r) => r.addEventListener('change', () => (r.value === 'albums' ? showAlbums() : showAll())));
  cardsEl.addEventListener('click', (e) => {
    const card = e.target.closest('[data-album]');
    if (!card) return;
    e.preventDefault();
    showAlbum(card.dataset.album);
    headEl.scrollIntoView({ block: 'nearest' });
  });
  headEl.addEventListener('click', (e) => {
    if (!e.target.closest('[data-back]')) return;
    e.preventDefault();
    showAlbums();
  });
  const openAt = (fig) => SLICNA_VIEWER.open(shown, Number(fig.dataset.i));
  gridEl.addEventListener('click', (e) => { const fig = e.target.closest('figure[data-i]'); if (fig) openAt(fig); });
  gridEl.addEventListener('keydown', (e) => { const fig = e.target.closest('figure[data-i]'); if (fig && e.key === 'Enter') openAt(fig); });

  try {
    albums = await SLICNA_API.albums();
    const params = new URLSearchParams(location.search);
    if (params.get('album')) {
      showAlbum(params.get('album'));
    } else if (params.get('view') === 'albums') {
      document.querySelector('[name="view"][value="albums"]').checked = true;
      showAlbums();
    } else {
      showAll();
    }
  } catch (err) {
    gridEl.innerHTML = '<p class="empty">The gallery could not be loaded right now.</p>';
  }
});
