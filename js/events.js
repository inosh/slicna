// Events page: a spotlight on the next CPD event, then the list filtered by
// kind (CPD / association / all) and upcoming / past. ?kind=other and ?when=past preselect them.
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const listEl = document.getElementById('events-list');
  const countEl = document.getElementById('events-count');
  const params = new URLSearchParams(window.location.search);
  const state = { kind: ['cpd', 'other', 'all'].includes(params.get('kind')) ? params.get('kind') : 'cpd', when: params.get('when') === 'past' ? 'past' : 'upcoming' };
  document.querySelector(`[name="kind"][value="${state.kind}"]`).checked = true;
  document.querySelector(`[name="when"][value="${state.when}"]`).checked = true;
  let events = [];

  const KIND_WORDS = { cpd: 'CPD events', other: 'association events', all: 'events' };

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
    // The address follows the choice (?kind=other, ?when=past), so links and Back keep it.
    if (e.target.name === 'kind' || e.target.name === 'when') {
      const url = new URL(window.location.href);
      if (state.kind === 'cpd') url.searchParams.delete('kind');
      else url.searchParams.set('kind', state.kind);
      if (state.when === 'upcoming') url.searchParams.delete('when');
      else url.searchParams.set('when', state.when);
      history.replaceState(null, '', url);
    }
    render();
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
