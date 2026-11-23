// Shared behaviour for every page: navigation, scroll reveal, and small render helpers.
const SLICNA = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CATEGORY_LABELS = { cpd: 'CPD event', other: 'Event' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(String(value).length === 10 ? value + 'T00:00:00' : value);
    return isNaN(d) ? null : d;
  }

  function formatDate(value) {
    const d = parseDate(value);
    return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
  }

  function isUpcoming(event) {
    const d = parseDate(event.end_date || event.event_date);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  }

  function formatPoints(points) {
    return Number(points).toFixed(points % 1 ? 1 : 0);
  }

  const formatMoney = (n, currency = 'LKR') => `${currency} ` + Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });

  // Type tag colour: CPD teal, international workshops gold, other events coral.
  function typeTag(event) {
    const cls = event.event_type === 'International Workshop' ? 'tag-gold' : event.category === 'cpd' ? 'tag-teal' : 'tag';
    return `<span class="${cls}">${escapeHtml(event.event_type || CATEGORY_LABELS[event.category] || 'Event')}</span>`;
  }

  // "CPD" first on CPD events in the lists, so they stand out from association events.
  const cpdTag = (event) => (event.category === 'cpd' ? '<span class="tag-cpd">CPD</span>' : '');

  // Status badge ("Registration Open" stands out); past events say "Completed".
  function statusBadge(event) {
    if (event.is_past) return '<span class="event-status event-status-past">Completed</span>';
    if (!event.status_label) return '';
    const ongoing = event.is_ongoing ? ' <span class="event-status event-status-ongoing">Ongoing</span>' : '';
    return `<span class="event-status event-status-${escapeHtml(event.status)}">${escapeHtml(event.status_label)}</span>${ongoing}`;
  }

  // "Free", "LKR 1,500" or a range ("Free – LKR 1,500") for the lists.
  function feeShort(event) {
    if (event.category !== 'cpd') return '';
    const amounts = (event.fees || []).map((f) => Number(f.amount));
    if (!amounts.length || amounts.every((a) => a === 0)) return 'Free';
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min === max) return formatMoney(min);
    return `${min ? formatMoney(min) : 'Free'} – ${formatMoney(max)}`;
  }

  function eventRow(event) {
    const d = parseDate(event.event_date);
    const day = d ? d.getDate() : '—';
    // Month and the full year on separate lines ("OCT 26" read like a second date).
    const mon = d ? MONTHS[d.getMonth()] : '';
    const yr = d ? d.getFullYear() : '';
    const points = event.cpd_points ? `<span>${formatPoints(event.cpd_points)} CPD points</span>` : '';
    const fee = !event.is_past && feeShort(event) ? `<span>${escapeHtml(feeShort(event))}</span>` : '';
    return `
      <a class="event-row${event.is_past ? ' is-past' : ''}" href="/pages/event-detail.html?id=${encodeURIComponent(event.id)}">
        <div class="date-tile"><b>${day}</b><span>${mon}</span><span class="date-year">${yr}</span></div>
        <div>
          <div class="event-tags">${cpdTag(event)}${typeTag(event)}${statusBadge(event)}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <div class="event-meta">${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}${points}${fee}</div>
        </div>
        <span class="event-go" aria-hidden="true">&rarr;</span>
      </a>`;
  }

  // Plain text from the admin panel -> escaped paragraphs (blank line = new paragraph).
  // Rich text from the admin's editor (news articles, event details), cleaned with
  // DOMPurify (the page must load js/vendor/purify.min.js); older plain text
  // becomes paragraphs. Pictures are "/uploads/..." paths on the API server;
  // links open in a new tab.
  function richText(el, value, fallback = '') {
    const isHtml = /<(p|h[1-6]|ul|ol|li|blockquote|br|strong|em|u|a|img)\b/i.test(value || '');
    if (!isHtml || !window.DOMPurify) {
      el.innerHTML = paragraphs(isHtml ? fallback : (value || fallback));
      return;
    }
    el.innerHTML = window.DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    });
    el.querySelectorAll('img').forEach((img) => { img.src = media(img.getAttribute('src')); img.loading = 'lazy'; });
    el.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  }

  function paragraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function media(url) {
    return escapeHtml(SLICNA_API.mediaUrl(url));
  }

  // CPD programmes grouped by year, newest year first:
  //   [{ year, events (date order), points, count, intl }]
  function cpdYears(events) {
    const byYear = new Map();
    events.filter((e) => e.category === 'cpd' && e.cpd_points != null && Number(e.cpd_points) > 0).forEach((e) => {
      const y = parseDate(e.event_date)?.getFullYear();
      if (!y) return;
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(e);
    });
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => {
      const sorted = list.slice().sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
      return {
        year,
        events: sorted,
        points: sorted.reduce((sum, e) => sum + Number(e.cpd_points), 0),
        count: sorted.length,
        intl: sorted.filter((e) => e.event_type === 'International Workshop').length,
      };
    });
  }

  // A video file (news covers may be videos): MP4, WEBM, MOV or OGG.
  const isVideo = (url) => /\.(mp4|m4v|webm|mov|ogg|ogv)$/i.test(String(url || ''));

  // A cover for cards and lists: the photo, or the video's first frame with a play mark.
  const coverHtml = (url) => (isVideo(url)
    ? `<video src="${media(url)}" muted playsinline preload="metadata"></video><span class="media-play" aria-hidden="true">&#9658;</span>`
    : `<img src="${media(url)}" alt="" loading="lazy">`);

  function newsCard(item, lead = false) {
    const img = item.photo_url ? coverHtml(item.photo_url) : '';
    return `
      <a class="news-card${lead ? ' is-lead' : ''}" href="/pages/news-detail.html?id=${encodeURIComponent(item.id)}">
        <div class="thumb">${img}</div>
        <div class="body">
          <p class="news-meta"><time>${formatDate(item.published_at || item.event_date)}</time>${item.news_type ? `<span class="news-type">${escapeHtml(item.news_type)}</span>` : ''}</p>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}
        </div>
      </a>`;
  }

  function initNav() {
    const shell = document.querySelector('[data-nav]');
    if (!shell) return;

    const onScroll = () => shell.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Dropdown panels: hover on pointer devices, click/keyboard everywhere.
    const panels = shell.querySelectorAll('.has-panel');
    const closeAll = (except) => panels.forEach((p) => {
      if (p === except) return;
      p.classList.remove('is-open');
      p.querySelector('button').setAttribute('aria-expanded', 'false');
    });
    panels.forEach((item) => {
      const btn = item.querySelector('button');
      const setOpen = (open) => {
        closeAll(item);
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      };
      btn.addEventListener('click', () => setOpen(!item.classList.contains('is-open')));
      if (window.matchMedia('(hover: hover)').matches) {
        item.addEventListener('mouseenter', () => setOpen(true));
        item.addEventListener('mouseleave', () => setOpen(false));
      }
    });
    document.addEventListener('click', (e) => { if (!shell.contains(e.target)) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

    const toggle = shell.querySelector('.menu-toggle');
    const menu = shell.querySelector('.mobile-menu');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.hidden = !open;
    });

    const section = document.body.dataset.section;
    if (section) {
      const current = shell.querySelector(`.nav-links > li[data-section="${section}"]`);
      if (current) current.classList.add('is-current');
    }
  }

  // "Share this page" row for news and event pages (as on SLNA): WhatsApp with
  // "title – link", Facebook with the link. The link is the page with just its
  // ?id=, so extras a visitor arrived with (?fbclid=…, ?utm_source=…) aren't passed on.
  // The preview (title, summary, image) comes from worker.js, which answers the
  // Facebook / WhatsApp link-preview bots.
  function shareHtml(title, id) {
    const url = `${location.origin}${location.pathname}?id=${encodeURIComponent(id)}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(title ? `${title} - ${url}` : url)}`;
    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    return `
      <div class="share-buttons">
        <span class="share-label">Share</span>
        <a class="share-btn share-whatsapp" href="${wa}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">
          <svg viewBox="0 0 448 512" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.8l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
        </a>
        <a class="share-btn share-facebook" href="${fb}" target="_blank" rel="noopener" aria-label="Share on Facebook">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8v-6.78H7.9V12.2H10V9.8c0-2.07 1.26-3.22 3.15-3.22.9 0 1.85.16 1.85.16v2.3h-1.04c-1.02 0-1.34.64-1.34 1.3v1.86h2.3l-.37 2.82H12.6V21.8c4.56-.93 8-4.96 8-9.8z"/></svg>
        </a>
      </div>`;
  }

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  });

  return { escapeHtml, formatDate, parseDate, isUpcoming, formatPoints, formatMoney, typeTag, cpdTag, statusBadge, feeShort, eventRow, newsCard, paragraphs, richText, media, isVideo, coverHtml, cpdYears, shareHtml, CATEGORY_LABELS };
})();
