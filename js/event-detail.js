// Event page, laid out as on SLNA: the details card (date, time, venue, CPD
// points, audience), fees, registration, bank details (paid CPD events while
// registration is open) and the description on the left; the poster on the right.
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
  crumb.textContent = isCpd ? 'CPD Events' : 'Association Events';
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
    const src = SLICNA.media(event.photo_url);
    photo.innerHTML = `<img src="${src}" alt="Poster: ${esc(event.title)}">`;
    photo.hidden = false;
    const layout = document.getElementById('event-detail');
    layout.classList.add('has-poster', 'poster-portrait');
    // The layout follows the poster's shape: portrait (most event posters) in a
    // narrow column, square a little wider, landscape beside a narrow details card (as on SLNA).
    photo.querySelector('img').addEventListener('load', (e) => {
      const ratio = e.target.naturalWidth / e.target.naturalHeight;
      layout.classList.remove('poster-portrait', 'poster-square', 'poster-landscape');
      layout.classList.add(ratio < 0.85 ? 'poster-portrait' : ratio <= 1.2 ? 'poster-square' : 'poster-landscape');
    }, { once: true });
    // Click for the poster full size.
    photo.addEventListener('click', () => SLICNA_VIEWER.open([{ src, type: 'image', caption: event.title }]));
  }
  if (event.body) {
    SLICNA.richText(document.getElementById('event-body'), event.body);
    document.getElementById('event-about').hidden = false;
  }
  // Programme / brochure: a PDF opens in a new tab; an image opens in the viewer.
  if (event.attachment_url) {
    const link = document.getElementById('event-attachment');
    const src = SLICNA.media(event.attachment_url);
    const isImage = /\.(jpe?g|png|webp)$/i.test(event.attachment_url);
    link.href = src;
    link.querySelector('.attachment-ico').textContent = isImage ? 'IMG' : 'PDF';
    document.getElementById('event-attachment-name').textContent = isImage ? 'View image' : 'Open PDF';
    if (isImage) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        SLICNA_VIEWER.open([{ src, type: 'image', caption: `Programme / brochure: ${event.title}` }]);
      });
    }
    link.hidden = false;
  }

  // Fees: one line per price (members by category when they differ), then the
  // foreign participant fees (online / physical, USD). A free event is just
  // "Event fee: Free" among the facts.
  const foreign = isCpd ? event.foreign || [] : [];
  const free = isCpd && !event.fees.some((f) => f.amount) && !foreign.some((f) => f.amount);

  // Facts, two to a row: Date | Time; Location across; CPD points | Who can attend; ...
  const facts = [
    ['Date', SLICNA.formatDate(event.event_date) + (event.end_date ? ' – ' + SLICNA.formatDate(event.end_date) : '')],
    ['Time', event.time_text],
    ['Location', event.location, 'wide'],
    ['Duration', event.duration_text],
    ['CPD points', event.cpd_points != null ? SLICNA.formatPoints(event.cpd_points) : null],
    ['Who can attend', event.audience_label],
    ['Event fee', free ? 'Free' : null],
    // Free events: say foreign participants are welcome (paid ones list their fees).
    ['Foreign participants', free && foreign.length ? foreign.map((f) => f.label).join(' or ') : null],
  ].filter(([, v]) => v);
  document.getElementById('event-facts').innerHTML = facts
    .map(([k, v, wide]) => `<div${wide ? ' class="wide"' : ''}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  if (isCpd && !free) {
    const fees = document.getElementById('event-fees');
    const lines = [
      ...event.fees.map((f) => [f.label, f.amount ? SLICNA.formatMoney(f.amount) : 'Free']),
      ...foreign.map((f) => [`Foreign participants – ${f.mode}`, f.amount ? SLICNA.formatMoney(f.amount, f.currency) : 'Free']),
    ];
    fees.innerHTML = `<h3>Event fee</h3><ul class="fee-list">${lines.map(([label, amount]) => `<li><span>${esc(label)}</span><b>${esc(amount)}</b></li>`).join('')}</ul>`;
    fees.hidden = false;
  }

  // Registration
  const reg = document.getElementById('event-register');
  if (event.registration_open) {
    reg.innerHTML = `<a class="btn btn-coral btn-block" href="/pages/event-register.html?id=${encodeURIComponent(event.id)}">Register now</a>
      <p class="muted register-note">${event.audience === 'members' ? 'For SLICNA members: have your membership number and NIC ready.' : `Members: have your membership number ready to get the member rate.${foreign.length ? ' Foreign participants: have your passport number ready.' : ''}`}</p>`;
  } else if (isCpd && !event.is_past && event.registration_mode === 'none') {
    // No registration: join the meeting directly (the link appears once it's added).
    reg.innerHTML = event.join_url
      ? `<a class="btn btn-coral btn-block" href="${esc(event.join_url)}" target="_blank" rel="noopener">Join the meeting</a>
        <p class="muted register-note">No registration needed: open the link at the start time.</p>`
      : '<p class="register-closed">No registration needed. The meeting link will be posted here before the event.</p>';
  } else if (isCpd && !event.is_past && event.registration_mode === 'external' && event.status === 'open' && event.registration_url) {
    reg.innerHTML = `<a class="btn btn-coral btn-block" href="${esc(event.registration_url)}" target="_blank" rel="noopener">Register now</a>
      <p class="muted register-note">Registration is on the organiser's form (opens in a new tab).</p>`;
  } else if (isCpd && event.seats_full) {
    // Closed automatically when the seats were filled; SLICNA may reopen it.
    reg.innerHTML = `<p class="register-closed">${esc(event.status_label)}</p>
      <p class="muted register-note">All seats have been filled, so registration is closed for now. More places may open later, so please check back.</p>`;
  } else if (isCpd) {
    const note = event.is_past ? 'This event has ended.' : event.status_label;
    reg.innerHTML = `<p class="register-closed">${esc(note)}</p>`;
  } else {
    reg.hidden = true;
  }

  // Bank details only while you can register for a paid event.
  if (event.registration_open && event.bank && (event.fees.some((f) => f.amount > 0) || foreign.some((f) => f.amount > 0))) {
    document.getElementById('event-bank-box').innerHTML = SLICNA_MEMBERSHIP.bankBox(event.bank);
    document.getElementById('event-bank').hidden = false;
  }
});
