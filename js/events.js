document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('events-list');
  const state = { when: 'upcoming', cat: 'all' };
  let events = [];

  function render() {
    let list = events.filter((e) => (state.when === 'upcoming') === SLICNA.isUpcoming(e));
    if (state.cat !== 'all') list = list.filter((e) => (e.category || 'cpd') === state.cat);
    if (state.when === 'past') list = [...list].reverse();

    listEl.innerHTML = list.length
      ? list.map(SLICNA.eventRow).join('')
      : `<p class="empty">${state.when === 'upcoming' ? 'No upcoming events in this category yet. New programmes are announced on our Facebook page.' : 'No past events in this category.'}</p>`;
  }

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.when ? 'when' : 'cat';
      state[key] = chip.dataset[key];
      document.querySelectorAll(`.chip[data-${key}]`).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      render();
    });
  });

  try {
    events = await SLICNA_API.events();
    render();
  } catch (err) {
    listEl.innerHTML = '<p class="empty">Events could not be loaded right now.</p>';
  }
});
