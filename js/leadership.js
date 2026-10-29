document.addEventListener('DOMContentLoaded', async () => {
  const leadEl = document.getElementById('committee-lead');
  const restEl = document.getElementById('committee-rest');
  const LEAD_COUNT = 3;

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
    if (data.term) {
      const elected = data.elected_on ? `, elected on ${SLICNA.formatDate(data.elected_on)}` : '';
      document.getElementById('committee-term').textContent = `Executive Committee ${data.term}${elected}.`;
    }
    // Members keep the order they come in; the first row is the first three.
    const lead = members.slice(0, LEAD_COUNT);
    const rest = members.slice(LEAD_COUNT);
    leadEl.innerHTML = lead.map(card).join('');
    restEl.innerHTML = rest.map(card).join('');
  } catch (err) {
    leadEl.innerHTML = '<p class="empty">The committee could not be loaded right now.</p>';
  }
});
