// Membership page: category cards with live fees, the "which membership is
// right for me?" helper, and bank details.
document.addEventListener('DOMContentLoaded', async () => {
  const MS = SLICNA_MEMBERSHIP;
  const esc = SLICNA.escapeHtml;
  const grid = document.getElementById('cat-grid');
  let fees = {};

  function renderCards(recommended) {
    grid.innerHTML = MS.ORDER.map((code) => {
      const c = MS.CATEGORIES[code];
      const fee = fees[code];
      const featured = code === 'LT';
      return `
        <article class="cat-card${featured ? ' is-featured' : ''}${recommended === code ? ' is-recommended' : ''}" id="cat-${code}">
          ${recommended === code ? '<span class="cat-badge">Recommended for you</span>' : featured ? '<span class="cat-badge">Pay once</span>' : ''}
          <span class="cat-code">${code}</span>
          <h3>${esc(c.name)}</h3>
          <div class="price">${fee ? esc(MS.money(fee.amount)) : '&nbsp;'}<small>${fee ? esc(MS.period(fee)) : ''}</small></div>
          <p class="who">${esc(c.who)}</p>
          <p class="needs"><b>You'll need</b>${esc(c.needs)}</p>
          <a class="btn ${featured ? 'btn-coral' : 'btn-line'}" href="/pages/membership-apply.html?category=${code}">Apply for ${esc(c.short)}</a>
        </article>`;
    }).join('');
  }

  // Helper: up to three yes/no questions, each answer either recommends a
  // category or reveals the next question.
  const QUESTIONS = [
    { text: 'Are you currently a nursing student?', yes: 'PM', no: 1 },
    { text: 'Do you have a PBCN ICU diploma or certificate, or more than 10 years continuously in intensive care?', yes: 'LT', no: 2 },
    { text: 'Do you currently work in an intensive care unit of a government hospital?', yes: 'GM', no: 'OM' },
  ];
  const REASONS = {
    PM: 'Partial Membership is for nursing students.',
    LT: 'Your PBCN qualification or long ICU service makes you eligible for Lifetime Membership: pay once, never renew.',
    GM: 'General Membership is for nurses working in a government hospital ICU.',
    OM: 'Ordinary Membership is open to nurses at any government hospital.',
  };
  const questionsEl = document.getElementById('helper-questions');
  const resultEl = document.getElementById('helper-result');

  function showQuestion(index, answeredUpTo) {
    questionsEl.innerHTML = QUESTIONS.slice(0, index + 1).map((q, i) => `
      <div class="helper-q">
        <p>${i + 1}. ${esc(q.text)}</p>
        <div class="helper-options" role="group">
          <button type="button" class="chip" data-q="${i}" data-a="yes" aria-pressed="${answeredUpTo[i] === 'yes'}">Yes</button>
          <button type="button" class="chip" data-q="${i}" data-a="no" aria-pressed="${answeredUpTo[i] === 'no'}">No</button>
        </div>
      </div>`).join('');
  }

  let answers = [];
  showQuestion(0, answers);
  questionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    const i = Number(btn.dataset.q);
    answers = answers.slice(0, i);
    answers[i] = btn.dataset.a;
    const next = QUESTIONS[i][btn.dataset.a];
    if (typeof next === 'number') {
      resultEl.hidden = true;
      showQuestion(next, answers);
      renderCards(null);
      return;
    }
    showQuestion(i, answers);
    const c = MS.CATEGORIES[next];
    resultEl.innerHTML = `
      <p><strong>We suggest ${esc(c.name)}.</strong> ${esc(REASONS[next])}</p>
      <a class="btn btn-coral" href="/pages/membership-apply.html?category=${next}">Apply for ${esc(c.short)}</a>`;
    resultEl.hidden = false;
    renderCards(next);
  });

  try {
    const info = await SLICNA_API.membershipInfo();
    fees = Object.fromEntries(info.fees.map((f) => [f.category, f]));
    renderCards(null);
    document.getElementById('bank-details').innerHTML = MS.bankBox(info.bank);
  } catch (err) {
    renderCards(null);
    document.getElementById('bank-details').innerHTML = '<p class="empty">Payment details could not be loaded right now. Please call 077 353 6178.</p>';
  }
});
