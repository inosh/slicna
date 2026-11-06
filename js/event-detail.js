// Event page: poster and description on the left; facts, fees, registration
// and (for paid events) bank details on the right.
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
    document.getElementById('event-about').hidden = false;
    document.getElementById('event-body').innerHTML = '<p>This event may have been removed. <a href="/pages/events.html">See all events</a>.</p>';
    return;
  }

  const isCpd = event.category === 'cpd';
  document.title = `${event.title} | SLICNA`;
  titleEl.textContent = event.title;
  const crumb = document.getElementById('crumb-kind');
  crumb.textContent = isCpd ? 'CPD Events' : 'Other Events';
  crumb.href = isCpd ? '/pages/events.html' : '/pages/events.html?kind=other';
  document.getElementById('event-tags').innerHTML = SLICNA.typeTag(event)
    + (event.is_past ? '<span class="event-status event-status-past">Completed</span>' : SLICNA.statusBadge(event));
  if (event.summary) {
    const summary = document.getElementById('event-summary');
    summary.textContent = event.summary;
    summary.hidden = false;
  }

  if (event.photo_url) {
    const photo = document.getElementById('event-photo');
    photo.innerHTML = `<img src="${SLICNA.media(event.photo_url)}" alt="Poster: ${esc(event.title)}">`;
    photo.hidden = false;
  }
  if (event.body) {
    document.getElementById('event-body').innerHTML = SLICNA.paragraphs(event.body);
    document.getElementById('event-about').hidden = false;
  }
  if (event.attachment_url) {
    const link = document.getElementById('event-attachment');
    link.href = SLICNA.media(event.attachment_url);
    document.getElementById('event-attachment-name').textContent = event.attachment_name || 'Download PDF';
    link.hidden = false;
  }

  // Facts
  const start = SLICNA.parseDate(event.event_date);
  const end = SLICNA.parseDate(event.end_date);
  const days = start && end ? Math.round((end - start) / 86400000) + 1 : 1;
  const facts = [
    ['Date', SLICNA.formatDate(event.event_date) + (event.end_date ? ' – ' + SLICNA.formatDate(event.end_date) : '')],
    ['Duration', days > 1 ? `${days} days` : null],
    ['Time', event.time_text],
    ['Venue', event.location],
    ['CPD points', event.cpd_points != null ? SLICNA.formatPoints(event.cpd_points) : null],
    ['Who can attend', event.audience_label],
  ].filter(([, v]) => v);
  document.getElementById('event-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  // Fees: one line per price (members by category when they differ).
  if (isCpd) {
    const fees = document.getElementById('event-fees');
    fees.innerHTML = `<h3>Event fee</h3>${event.fees.length
      ? `<ul class="fee-list">${event.fees.map((f) => `<li><span>${esc(f.label)}</span><b>${f.amount ? esc(SLICNA.formatMoney(f.amount)) : 'Free'}</b></li>`).join('')}</ul>`
      : '<p class="fee-free">Free of charge</p>'}`;
    fees.hidden = false;
  }

  // Registration
  const reg = document.getElementById('event-register');
  if (event.registration_open) {
    reg.innerHTML = `<a class="btn btn-coral btn-block" href="/pages/event-register.html?id=${encodeURIComponent(event.id)}">Register now</a>
      <p class="muted register-note">${event.audience === 'members' ? 'For SLICNA members: have your membership number and NIC ready.' : 'Members: have your membership number ready to get the member rate.'}</p>`;
  } else if (isCpd) {
    const note = event.is_past ? 'This event has ended.' : event.status_label;
    reg.innerHTML = `<p class="register-closed">${esc(note)}</p>`;
  } else {
    reg.hidden = true;
  }

  // Bank details only while you can register for a paid event.
  if (event.registration_open && event.bank && event.fees.some((f) => f.amount > 0)) {
    document.getElementById('event-bank-box').innerHTML = SLICNA_MEMBERSHIP.bankBox(event.bank);
    document.getElementById('event-bank').hidden = false;
  }
});
