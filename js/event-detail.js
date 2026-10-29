document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  const titleEl = document.getElementById('event-title');
  const esc = SLICNA.escapeHtml;

  let event = null;
  try {
    event = id ? await SLICNA_API.event(id) : null;
  } catch (err) { /* handled below */ }

  if (!event) {
    titleEl.textContent = 'Event not found';
    document.getElementById('event-body').innerHTML = '<p>This event may have been removed. <a href="/pages/events.html">See all events</a>.</p>';
    return;
  }

  const cat = event.category || 'cpd';
  document.title = `${event.title} | SLICNA`;
  titleEl.textContent = event.title;
  document.getElementById('crumb-title').textContent = SLICNA.CATEGORY_LABELS[cat] || 'Event';
  document.getElementById('event-tag').innerHTML = `<span class="tag ${cat === 'cpd' ? 'tag-teal' : cat === 'international' ? 'tag-gold' : ''}">${esc(SLICNA.CATEGORY_LABELS[cat] || cat)}</span>`;

  if (event.photo_url) {
    const photo = document.getElementById('event-photo');
    photo.innerHTML = `<img src="${esc(event.photo_url)}" alt="">`;
    photo.hidden = false;
  }

  document.getElementById('event-body').innerHTML = event.body || `<p>${esc(event.summary || '')}</p>`;

  const facts = [
    ['Date', SLICNA.formatDate(event.event_date) + (event.end_date ? ' – ' + SLICNA.formatDate(event.end_date) : '')],
    ['Time', event.time],
    ['Venue', event.location],
    ['CPD points', event.cpd_points ? Number(event.cpd_points).toFixed(2) : null]
  ].filter(([, v]) => v);
  document.getElementById('event-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  if (SLICNA.isUpcoming(event) && event.registration_open !== false) {
    document.getElementById('register-card').hidden = false;
    SLICNA_FORMS.bind('register-form', 'register-status', (data) => SLICNA_API.registerEvent(event.id, data),
      'You are registered. We will contact you with joining details before the event.');
  }
});
