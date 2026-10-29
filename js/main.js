// Shared behaviour for every page: navigation, scroll reveal, and small render helpers.
const SLICNA = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CATEGORY_LABELS = { cpd: 'CPD programme', community: 'Community', international: 'International' };
  const CATEGORY_TAGS = { cpd: 'tag-teal', community: 'tag', international: 'tag-gold' };

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

  function eventRow(event) {
    const d = parseDate(event.event_date);
    const day = d ? d.getDate() : '—';
    const mon = d ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : '';
    const cat = event.category || 'cpd';
    const points = event.cpd_points ? `<span>${formatPoints(event.cpd_points)} CPD points</span>` : '';
    return `
      <a class="event-row" href="/pages/event-detail.html?id=${encodeURIComponent(event.id)}">
        <div class="date-tile"><b>${day}</b><span>${mon}</span></div>
        <div>
          <span class="${CATEGORY_TAGS[cat] || 'tag'}">${escapeHtml(CATEGORY_LABELS[cat] || cat)}</span>
          <h3>${escapeHtml(event.title)}</h3>
          <div class="event-meta">${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}${points}</div>
        </div>
        <span class="event-go" aria-hidden="true">&rarr;</span>
      </a>`;
  }

  function newsCard(item, lead = false) {
    const img = item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="" loading="lazy">` : '';
    return `
      <a class="news-card${lead ? ' is-lead' : ''}" href="/pages/news-detail.html?id=${encodeURIComponent(item.id)}">
        <div class="thumb">${img}</div>
        <div class="body">
          <time>${formatDate(item.published_at || item.event_date)}</time>
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

  return { escapeHtml, formatDate, parseDate, isUpcoming, formatPoints, eventRow, newsCard, CATEGORY_LABELS };
})();
