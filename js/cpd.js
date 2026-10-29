document.addEventListener('DOMContentLoaded', async () => {
  const rowsEl = document.getElementById('cpd-rows');

  try {
    const events = await SLICNA_API.events();
    // Show the latest year that has CPD programmes.
    const withPoints = events.filter((e) => e.cpd_points);
    const year = Math.max(...withPoints.map((e) => SLICNA.parseDate(e.event_date)?.getFullYear() || 0));
    const list = withPoints.filter((e) => SLICNA.parseDate(e.event_date)?.getFullYear() === year);
    const total = list.reduce((sum, e) => sum + Number(e.cpd_points), 0);

    rowsEl.innerHTML = list.map((e, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, '0')}</td>
        <td style="white-space:nowrap">${SLICNA.formatDate(e.event_date)}</td>
        <td><a href="/pages/event-detail.html?id=${encodeURIComponent(e.id)}">${SLICNA.escapeHtml(e.title)}</a></td>
        <td class="num">${Number(e.cpd_points).toFixed(2)}</td>
      </tr>`).join('');

    document.getElementById('cpd-foot').textContent = total.toFixed(2);
    document.getElementById('cpd-total').textContent = SLICNA.formatPoints(total);
    document.getElementById('cpd-count').textContent = list.length;
    document.querySelectorAll('[data-cpd-year]').forEach((el) => { el.textContent = year; });
  } catch (err) {
    rowsEl.innerHTML = '<tr><td colspan="4">The CPD programme could not be loaded right now.</td></tr>';
  }
});
