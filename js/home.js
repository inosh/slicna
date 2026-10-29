document.addEventListener('DOMContentLoaded', async () => {
  const eventsEl = document.getElementById('home-events');
  const cpdEl = document.getElementById('home-cpd');
  const newsEl = document.getElementById('home-news');

  try {
    const events = await SLICNA_API.events();
    const upcoming = events.filter(SLICNA.isUpcoming).slice(0, 3);
    eventsEl.innerHTML = upcoming.length
      ? upcoming.map(SLICNA.eventRow).join('')
      : '<p class="empty">New programmes will be announced soon. Follow us on Facebook for updates.</p>';

    const year = new Date().getFullYear();
    // The last five programmes of the year, keeping their number in the full-year list.
    const cpdYear = events.filter((e) => e.cpd_points && SLICNA.parseDate(e.event_date)?.getFullYear() === year);
    const offset = Math.max(0, cpdYear.length - 5);
    cpdEl.innerHTML = cpdYear.slice(offset).map((e, i) => `
      <li data-n="${String(offset + i + 1).padStart(2, '0')}">
        <span><span class="cpd-title">${SLICNA.escapeHtml(e.title)}</span><span class="cpd-date">${SLICNA.formatDate(e.event_date)}</span></span>
        <span class="cpd-pts">${SLICNA.formatPoints(e.cpd_points)}<small>pts</small></span>
      </li>`).join('');
  } catch (err) {
    eventsEl.innerHTML = '<p class="empty">Events could not be loaded right now.</p>';
  }

  try {
    const news = (await SLICNA_API.news()).slice(0, 4);
    newsEl.innerHTML = news.map((n, i) => SLICNA.newsCard(n, i === 0)).join('');
  } catch (err) {
    newsEl.innerHTML = '<p class="empty">News could not be loaded right now.</p>';
  }
});
