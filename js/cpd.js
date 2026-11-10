// CPD page: the programme table and totals for one year, with a button for
// each year that has CPD programmes (newest first). ?year=2025 opens that year
// (the home page's "Previous years" links use it).
document.addEventListener('DOMContentLoaded', async () => {
  const rowsEl = document.getElementById('cpd-rows');
  const yearsEl = document.getElementById('cpd-years');

  function show(y) {
    rowsEl.innerHTML = y.events.map((e, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, '0')}</td>
        <td style="white-space:nowrap">${SLICNA.formatDate(e.event_date)}</td>
        <td><a href="/pages/event-detail.html?id=${encodeURIComponent(e.id)}">${SLICNA.escapeHtml(e.title)}</a></td>
        <td class="num">${Number(e.cpd_points).toFixed(2)}</td>
      </tr>`).join('');
    document.getElementById('cpd-foot').textContent = y.points.toFixed(2);
    document.getElementById('cpd-total').textContent = SLICNA.formatPoints(y.points);
    document.getElementById('cpd-count').textContent = y.count;
    document.querySelectorAll('[data-cpd-year]').forEach((el) => { el.textContent = y.year; });
    yearsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.year) === y.year)));
  }

  try {
    const years = SLICNA.cpdYears(await SLICNA_API.events());
    if (!years.length) {
      rowsEl.innerHTML = '<tr><td colspan="4">No CPD programmes yet.</td></tr>';
      return;
    }
    const wanted = Number(new URLSearchParams(location.search).get('year'));
    const current = years.find((y) => y.year === wanted) || years[0];

    if (years.length > 1) {
      yearsEl.innerHTML = years.map((y) => `<button type="button" data-year="${y.year}" aria-pressed="false">${y.year}</button>`).join('');
      yearsEl.hidden = false;
      yearsEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-year]');
        if (!b) return;
        const y = years.find((x) => x.year === Number(b.dataset.year));
        show(y);
        // The address keeps the year (the latest year needs none).
        const url = new URL(location.href);
        if (y === years[0]) url.searchParams.delete('year'); else url.searchParams.set('year', y.year);
        history.replaceState(null, '', url);
      });
    }
    show(current);
  } catch (err) {
    rowsEl.innerHTML = '<tr><td colspan="4">The CPD programme could not be loaded right now.</td></tr>';
  }
});
