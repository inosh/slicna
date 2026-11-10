// Home page: every section below the hero is built from admin-managed content.
document.addEventListener('DOMContentLoaded', () => {
  const esc = SLICNA.escapeHtml;
  const eventsPromise = SLICNA_API.events();

  // Upcoming events + CPD summary (current year, or the latest year with CPD programmes).
  (async () => {
    const eventsEl = document.getElementById('home-events');
    const cpdEl = document.getElementById('home-cpd');
    try {
      const events = await eventsPromise;
      const upcoming = events.filter(SLICNA.isUpcoming).slice(0, 3);
      eventsEl.innerHTML = upcoming.length
        ? upcoming.map(SLICNA.eventRow).join('')
        : '<p class="empty">New programmes will be announced soon. Follow us on Facebook for updates.</p>';

      const yearOf = (e) => SLICNA.parseDate(e.event_date)?.getFullYear();
      const withPoints = events.filter((e) => e.category === 'cpd' && e.cpd_points != null);
      const thisYear = new Date().getFullYear();
      const year = withPoints.some((e) => yearOf(e) === thisYear) ? thisYear : Math.max(...withPoints.map(yearOf), thisYear);
      const cpdYear = withPoints.filter((e) => yearOf(e) === year);
      const total = cpdYear.reduce((sum, e) => sum + Number(e.cpd_points), 0);
      const intl = events.filter((e) => e.event_type === 'International Workshop' && yearOf(e) === year).length;

      // Earlier years (up to three), each linking to that year on the CPD page.
      const past = SLICNA.cpdYears(events).filter((y) => y.year < year).slice(0, 3);
      if (past.length) {
        document.getElementById('cpd-past-list').innerHTML = past.map((y) => `
          <li><a href="/pages/cpd.html?year=${y.year}">
            <span class="cpd-past-year">${y.year}</span>
            <span class="cpd-past-pts">${SLICNA.formatPoints(y.points)}<small>points</small></span>
            <span class="cpd-past-meta">${y.count} programme${y.count === 1 ? '' : 's'}${y.intl ? ` · ${y.intl} international` : ''}</span>
            <span class="cpd-past-go" aria-hidden="true">&rarr;</span>
          </a></li>`).join('');
        document.getElementById('cpd-past').hidden = false;
      }

      document.querySelectorAll('[data-cpd-year]').forEach((el) => { el.textContent = year; });
      document.getElementById('hero-cpd-total').textContent = SLICNA.formatPoints(total);
      document.getElementById('cpd-total').textContent = SLICNA.formatPoints(total);
      document.getElementById('cpd-count').textContent = cpdYear.length;
      document.getElementById('cpd-intl').textContent = intl;
      document.getElementById('cpd-intl-label').textContent = intl === 1 ? 'international workshop' : 'international workshops';

      // The last five programmes of the year, keeping their number in the full-year list.
      const offset = Math.max(0, cpdYear.length - 5);
      cpdEl.innerHTML = cpdYear.slice(offset).map((e, i) => `
        <li data-n="${String(offset + i + 1).padStart(2, '0')}">
          <span><span class="cpd-title">${esc(e.title)}</span><span class="cpd-date">${SLICNA.formatDate(e.event_date)}</span></span>
          <span class="cpd-pts">${SLICNA.formatPoints(e.cpd_points)}<small>pts</small></span>
        </li>`).join('');
    } catch (err) {
      eventsEl.innerHTML = '<p class="empty">Events could not be loaded right now.</p>';
    }
  })();

  // Community tiles: the first section as the large tile, the next upcoming
  // community event as the coral tile, then other sections and campaign cards.
  (async () => {
    const el = document.getElementById('home-community');
    try {
      const [sections, events] = await Promise.all([SLICNA_API.community(), eventsPromise]);
      const tile = (img, tag, title, text, cls = '') => `
        <article class="bento-item ${cls}">
          ${img ? `<img src="${SLICNA.media(img)}" alt="" loading="lazy">` : ''}
          <div class="bento-body">
            ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
            ${title ? `<h3>${esc(title)}</h3>` : ''}
            ${text ? `<p class="clamp">${esc(text)}</p>` : ''}
          </div>
        </article>`;

      const firstPhoto = (s) => (s.items.find((i) => i.image_url) || {}).image_url;
      const [lead, ...others] = sections.filter((s) => firstPhoto(s) || s.style === 'cards');
      const small = [];
      others.filter((s) => s.style !== 'cards').forEach((s) => small.push(tile(firstPhoto(s), '', s.eyebrow || s.title, s.body)));
      sections.filter((s) => s.style === 'cards').forEach((s) => s.items.forEach((i) => small.push(tile(i.image_url, '', i.title, i.text))));

      const next = events.find((e) => e.category === 'other' && SLICNA.isUpcoming(e));
      const quote = next ? `
        <a class="bento-item bento-quote" href="/pages/event-detail.html?id=${encodeURIComponent(next.id)}" style="text-decoration:none">
          <p>${esc(next.title)}</p>
          <small>${[next.location, SLICNA.formatDate(next.event_date)].filter(Boolean).map(esc).join(' &middot; ')}</small>
        </a>` : '';

      if (!lead) {
        el.closest('section').hidden = true;
        return;
      }
      const leadTile = lead.style === 'cards' ? '' : tile(firstPhoto(lead), lead.eyebrow, lead.title, lead.body, 'bento-feature');
      const tiles = [leadTile, small[0], quote, ...small.slice(1)].filter(Boolean).slice(0, 5);
      el.innerHTML = tiles.join('');
    } catch (err) {
      el.innerHTML = '<p class="empty" style="grid-column:1/-1">Community updates could not be loaded right now.</p>';
    }
  })();

  // Latest news.
  (async () => {
    const newsEl = document.getElementById('home-news');
    try {
      const news = (await SLICNA_API.news()).slice(0, 4);
      newsEl.innerHTML = news.length
        ? news.map((n, i) => SLICNA.newsCard(n, i === 0)).join('')
        : '<p class="empty">News will appear here soon.</p>';
    } catch (err) {
      newsEl.innerHTML = '<p class="empty">News could not be loaded right now.</p>';
    }
  })();
});
