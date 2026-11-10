// Community page: each section from the admin panel is drawn in its chosen layout.
//   feature   - logo, text, bullet points and a photo grid
//   highlight - dark band with one photo beside the text
//   cards     - heading, optional link, and a grid of cards
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('community-sections');
  const esc = SLICNA.escapeHtml;
  const titleStyle = 'font-size:clamp(28px,4vw,42px)';

  const bullets = (text) => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length ? `<ul class="check-list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  };
  const photo = (item, style) => `<div class="figure-round" style="${style}"><img src="${SLICNA.media(item.image_url)}" alt="${esc(item.title || '')}" loading="lazy"></div>`;

  function feature(s, first) {
    const photos = s.items.filter((i) => i.image_url);
    const grid = photos.map((p, i) => photo(p, i === 0 ? 'grid-column:1/-1;aspect-ratio:16/10' : 'aspect-ratio:1')).join('');
    return `
      <section class="${first ? 'section-tight' : 'section'}"${first ? ' style="padding-top:0"' : ''}>
        <div class="wrap split-even split">
          <div class="reveal">
            ${s.logo_url ? `<img src="${SLICNA.media(s.logo_url)}" alt="" style="width:200px;margin-bottom:18px">` : ''}
            ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
            <h2 style="${titleStyle}">${esc(s.title)}</h2>
            ${s.body ? `<p class="muted">${esc(s.body)}</p>` : ''}
            ${bullets(s.bullet_points)}
          </div>
          ${grid ? `<div class="grid-2 reveal">${grid}</div>` : ''}
        </div>
      </section>`;
  }

  function highlight(s) {
    const first = s.items.find((i) => i.image_url);
    return `
      <section class="section section-dark">
        <div class="wrap split-even split">
          ${first ? `<div class="figure-round reveal" style="aspect-ratio:4/3"><img src="${SLICNA.media(first.image_url)}" alt="${esc(first.title || '')}" loading="lazy"></div>` : ''}
          <div class="reveal">
            ${s.eyebrow ? `<p class="eyebrow eyebrow-light">${esc(s.eyebrow)}</p>` : ''}
            <h2 style="${titleStyle}">${esc(s.title)}</h2>
            ${s.body ? `<p class="muted-light">${esc(s.body)}</p>` : ''}
            ${bullets(s.bullet_points)}
          </div>
        </div>
      </section>`;
  }

  function cards(s) {
    const items = s.items.map((i) => `
      <article class="news-card">
        <div class="thumb">${i.image_url ? `<img src="${SLICNA.media(i.image_url)}" alt="${esc(i.title || '')}" loading="lazy">` : ''}</div>
        <div class="body">${i.label ? `<time>${esc(i.label)}</time>` : ''}${i.title ? `<h3>${esc(i.title)}</h3>` : ''}${i.text ? `<p>${esc(i.text)}</p>` : ''}</div>
      </article>`).join('');
    return `
      <section class="section">
        <div class="wrap">
          <div class="section-head reveal">
            <div>
              ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
              <h2>${esc(s.title)}</h2>
            </div>
            ${s.link_url && s.link_text ? `<a href="${esc(s.link_url)}" class="link-arrow">${esc(s.link_text)}</a>` : ''}
          </div>
          ${s.body ? `<p class="muted" style="max-width:60ch;margin-top:-16px;margin-bottom:28px">${esc(s.body)}</p>` : ''}
          <div class="grid-3 reveal">${items}</div>
        </div>
      </section>`;
  }

  try {
    const sections = await SLICNA_API.community();
    container.innerHTML = sections.length
      ? sections.map((s, i) => (s.style === 'highlight' ? highlight(s) : s.style === 'cards' ? cards(s) : feature(s, i === 0))).join('')
      : '<section class="section-tight" style="padding-top:0"><div class="wrap"><p class="empty">Our community work will be shared here soon.</p></div></section>';
    container.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  } catch (err) {
    container.innerHTML = '<section class="section-tight" style="padding-top:0"><div class="wrap"><p class="empty">This page could not be loaded right now.</p></div></section>';
  }
});
