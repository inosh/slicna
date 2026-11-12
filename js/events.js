// Events page: a spotlight on the next CPD event, then the list filtered by
// kind (CPD / association / all) and upcoming / past; past events one year at a time.
// ?kind=other, ?when=past and &year=2025 preselect them.
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const listEl = document.getElementById('events-list');
  const params = new URLSearchParams(window.location.search);
  const yearsEl = document.getElementById('events-years');
  const state = { kind: ['cpd', 'other', 'all'].includes(params.get('kind')) ? params.get('kind') : 'cpd', when: params.get('when') === 'past' ? 'past' : 'upcoming', year: params.get('year') };
  document.querySelector(`[name="kind"][value="${state.kind}"]`).checked = true;
  document.querySelector(`[name="when"][value="${state.when}"]`).checked = true;
  let events = [];

  const KIND_WORDS = { cpd: 'CPD events', other: 'association events', all: 'events' };

  // Past events: one year at a time (buttons for each year, newest first), in slim rows.
  const yearOf = (e) => String(e.event_date || '').slice(0, 4);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pastRow(e) {
    const d = SLICNA.parseDate(e.event_date);
    const meta = [e.location && `<span>${esc(e.location)}</span>`, e.cpd_points && `<span>${SLICNA.formatPoints(e.cpd_points)} CPD points</span>`].filter(Boolean).join('');
    return `
      <a class="event-row is-past past-row" href="/pages/event-detail.html?id=${encodeURIComponent(e.id)}">
        <div class="date-tile"><b>${d ? d.getDate() : '—'}</b><span>${d ? MONTHS[d.getMonth()] : ''}</span></div>
        <div>
          <h3>${esc(e.title)}</h3>
          <div class="event-meta">${SLICNA.cpdTag(e)}${SLICNA.typeTag(e)}${meta}</div>
        </div>
        <span class="event-go" aria-hidden="true">&rarr;</span>
      </a>`;
  }

  function renderYears(list) {
    const years = [...new Set(list.map(yearOf).filter(Boolean))];
    if (!years.includes(state.year)) state.year = years[0] || null;
    yearsEl.hidden = state.when !== 'past' || years.length < 2;
    yearsEl.innerHTML = years.map((y) => `<button type="button" data-year="${y}" aria-pressed="${y === state.year}">${y}</button>`).join('');
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    if (state.kind === 'cpd') url.searchParams.delete('kind'); else url.searchParams.set('kind', state.kind);
    if (state.when === 'upcoming') url.searchParams.delete('when'); else url.searchParams.set('when', state.when);
    if (state.when === 'past' && state.year && state.year !== yearsEl.querySelector('button')?.dataset.year) url.searchParams.set('year', state.year);
    else url.searchParams.delete('year');
    history.replaceState(null, '', url);
  }

  function render() {
    let list = events.filter((e) => state.kind === 'all' || e.category === state.kind);
    list = list.filter((e) => (state.when === 'upcoming') === !e.is_past);
    const past = state.when === 'past';
    if (past) {
      list = [...list].reverse();
      renderYears(list);
      list = list.filter((e) => yearOf(e) === state.year);
    } else {
      yearsEl.hidden = true;
    }
    listEl.classList.toggle('event-list-past', past);
    const n = list.length;
    // A small month heading ("OCTOBER 2026") before each month's events, as on SLNA
    // (the year is in the buttons above a past list, so there the month alone).
    const monthOf = (e) => String(e.event_date || '').slice(0, 7);
    const monthLabel = (e) => { const d = SLICNA.parseDate(e.event_date); return d ? d.toLocaleDateString('en-GB', past && !yearsEl.hidden ? { month: 'long' } : { month: 'long', year: 'numeric' }) : ''; };
    listEl.innerHTML = n
      ? list.map((e, i) => (monthOf(e) !== monthOf(list[i - 1] || {}) ? `<h3 class="events-month">${esc(monthLabel(e))}</h3>` : '') + (past ? pastRow(e) : SLICNA.eventRow(e))).join('')
      : `<p class="empty">${state.when === 'upcoming'
        ? `No upcoming ${KIND_WORDS[state.kind]} yet. New programmes are announced here and on our Facebook page.`
        : `No past ${KIND_WORDS[state.kind]}.`}</p>`;
  }

  // The next CPD event open for registration, else the next upcoming CPD event.
  function renderSpotlight() {
    const upcoming = events.filter((e) => e.category === 'cpd' && !e.is_past);
    const e = upcoming.find((x) => x.registration_open) || upcoming[0];
    if (!e) return;
    const fee = SLICNA.feeShort(e);
    const facts = [
      ['Date', SLICNA.formatDate(e.event_date) + (e.end_date ? ' – ' + SLICNA.formatDate(e.end_date) : '')],
      ['Time', e.time_text], ['Venue', e.location],
      ['CPD points', e.cpd_points != null ? SLICNA.formatPoints(e.cpd_points) : null],
      ['Fee', fee],
    ].filter(([, v]) => v);
    document.getElementById('spotlight').innerHTML = `
      <article class="spotlight${e.photo_url ? '' : ' spotlight-noimg'}">
        ${e.photo_url ? `<a class="spotlight-media" href="/pages/event-detail.html?id=${encodeURIComponent(e.id)}"><img src="${SLICNA.media(e.photo_url)}" alt=""></a>` : ''}
        <div class="spotlight-body">
          <p class="eyebrow">Next CPD event</p>
          <div class="event-tags">${SLICNA.cpdTag(e)}${SLICNA.typeTag(e)}${SLICNA.statusBadge(e)}</div>
          <h2>${esc(e.title)}</h2>
          ${e.summary ? `<p class="muted">${esc(e.summary)}</p>` : ''}
          <dl class="spotlight-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="spotlight-actions">
            ${e.registration_open ? `<a class="btn btn-coral" href="/pages/event-register.html?id=${encodeURIComponent(e.id)}">Register now</a>` : ''}
            <a class="btn ${e.registration_open ? 'btn-light' : 'btn-teal'}" href="/pages/event-detail.html?id=${encodeURIComponent(e.id)}">Event details</a>
          </div>
        </div>
      </article>`;
    document.getElementById('spotlight-wrap').hidden = false;
  }

  document.querySelector('.events-toolbar').addEventListener('change', (e) => {
    state[e.target.name] = e.target.value;
    render();
    // The address follows the choice (?kind=other, ?when=past, &year=2025), so links and Back keep it.
    syncUrl();
  });

  yearsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-year]');
    if (!b) return;
    state.year = b.dataset.year;
    render();
    syncUrl();
  });

  // Opened from the Events menu (#all-events): bring the list into view once it has loaded.
  const jumpToList = () => {
    if (location.hash !== '#all-events') return;
    document.getElementById('all-events').scrollIntoView({ block: 'start' });
  };

  try {
    events = await SLICNA_API.events();
    renderSpotlight();
    render();
    jumpToList();
    window.addEventListener('hashchange', jumpToList);
  } catch (err) {
    listEl.innerHTML = '<p class="empty">Events could not be loaded right now.</p>';
  }
});
