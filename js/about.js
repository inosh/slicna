document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('milestones');
  const photoEl = document.getElementById('journey-photo');
  const esc = SLICNA.escapeHtml;

  try {
    const [milestones, settings] = await Promise.all([SLICNA_API.milestones(), SLICNA_API.settings()]);

    listEl.innerHTML = milestones.map((m) => `
      <li><span class="year">${esc(m.year_label)}</span><div><h3>${esc(m.title)}</h3>${m.description ? `<p>${esc(m.description)}</p>` : ''}</div></li>`).join('');

    if (settings.about_journey_photo) {
      photoEl.innerHTML = `<img src="${SLICNA.media(settings.about_journey_photo)}" alt="SLICNA milestones">`;
      photoEl.hidden = false;
    }
  } catch (err) {
    listEl.innerHTML = '<li class="empty">Milestones could not be loaded right now.</li>';
  }
});
