// Events page: a spotlight on the next CPD event, then the list filtered by
// kind (CPD / other / all) and upcoming / past. ?kind=other preselects a tab.
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const listEl = document.getElementById('events-list');
  const countEl = document.getElementById('events-count');
  const params = new URLSearchParams(window.location.search);
  const state = { kind: ['cpd', 'other', 'all'].includes(params.get('kind')) ? params.get('kind') : 'cpd', when: 'upcoming' };
  document.querySelector(`[name="kind"][value="${state.kind}"]`).checked = true;
  let events = [];

  const KIND_WORDS = { cpd: 'CPD events', other: 'other events', all: 'events' };

  function render() {
    let list = events.filter((e) => state.kind === 'all' || e.category === state.kind);
    list = list.filter((e) => (state.when === 'upcoming') === !e.is_past);
    if (state.when === 'past') list = [...list].reverse();
    const n = list.length;
    countEl.textContent = n ? `${n} ${state.when} ${n === 1 ? KIND_WORDS[state.kind].replace(/s$/, '') : KIND_WORDS[state.kind]}` : '';
    listEl.innerHTML = n
      ? list.map(SLICNA.eventRow).join('')
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
          <div class="event-tags">${SLICNA.typeTag(e)}${SLICNA.statusBadge(e)}</div>
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
    if (e.target.name === 'kind') {
      const url = new URL(window.location.href);
      if (state.kind === 'cpd') url.searchParams.delete('kind');
      else url.searchParams.set('kind', state.kind);
      history.replaceState(null, '', url);
    }
    render();
  });

  try {
    events = await SLICNA_API.events();
    renderSpotlight();
    render();
  } catch (err) {
    listEl.innerHTML = '<p class="empty">Events could not be loaded right now.</p>';
  }
});
