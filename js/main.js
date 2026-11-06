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

  const formatMoney = (n) => 'LKR ' + Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });

  // Type tag colour: CPD teal, international workshops gold, other events coral.
  function typeTag(event) {
    const cls = event.event_type === 'International Workshop' ? 'tag-gold' : event.category === 'cpd' ? 'tag-teal' : 'tag';
    return `<span class="${cls}">${escapeHtml(event.event_type || CATEGORY_LABELS[event.category] || 'Event')}</span>`;
  }

  // Status badge for upcoming events ("Registration Open" stands out).
  function statusBadge(event) {
    if (event.is_past || !event.status_label) return '';
    return `<span class="event-status event-status-${escapeHtml(event.status)}">${escapeHtml(event.status_label)}</span>`;
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
    const mon = d ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : '';
    const points = event.cpd_points ? `<span>${formatPoints(event.cpd_points)} CPD points</span>` : '';
    const fee = !event.is_past && feeShort(event) ? `<span>${escapeHtml(feeShort(event))}</span>` : '';
    return `
      <a class="event-row" href="/pages/event-detail.html?id=${encodeURIComponent(event.id)}">
        <div class="date-tile"><b>${day}</b><span>${mon}</span></div>
        <div>
          <div class="event-tags">${typeTag(event)}${statusBadge(event)}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <div class="event-meta">${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}${points}${fee}</div>
        </div>
        <span class="event-go" aria-hidden="true">&rarr;</span>
      </a>`;
  }

  // Plain text from the admin panel -> escaped paragraphs (blank line = new paragraph).
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

  function newsCard(item, lead = false) {
    const img = item.photo_url ? `<img src="${media(item.photo_url)}" alt="" loading="lazy">` : '';
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

  return { escapeHtml, formatDate, parseDate, isUpcoming, formatPoints, formatMoney, typeTag, statusBadge, feeShort, eventRow, newsCard, paragraphs, media, CATEGORY_LABELS };
})();
