document.addEventListener('DOMContentLoaded', async () => {
  const leadEl = document.getElementById('committee-lead');
  const restEl = document.getElementById('committee-rest');
  const LEAD_SLOTS = ['president', 'vice-president', 'secretary'];

  const initials = (name, role) => (name || role).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const card = (m) => `
    <article class="person reveal is-in">
      <div class="photo">${m.photo_url
        ? `<img src="${SLICNA.escapeHtml(m.photo_url)}" alt="${SLICNA.escapeHtml(m.name)}" loading="lazy">`
        : `<span class="initials">${SLICNA.escapeHtml(initials(m.name, m.role_title))}</span>`}</div>
      <div class="role">${SLICNA.escapeHtml(m.role_title)}</div>
      <h3>${SLICNA.escapeHtml(m.name || 'To be announced')}</h3>
      ${m.designation ? `<div class="desig">${SLICNA.escapeHtml(m.designation)}</div>` : ''}
    </article>`;

  try {
    const data = await SLICNA_API.committee();
    const members = data.members || data;
    const lead = members.filter((m) => LEAD_SLOTS.includes(m.slot_key));
    const rest = members.filter((m) => !LEAD_SLOTS.includes(m.slot_key));
    leadEl.innerHTML = lead.map(card).join('');
    restEl.innerHTML = rest.map(card).join('');
  } catch (err) {
    leadEl.innerHTML = '<p class="empty">The committee could not be loaded right now.</p>';
  }
});
