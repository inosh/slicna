// CPD event registration. Members check their membership first (number +
// NIC) so the fee for their category is applied; non-members pay the
// non-member fee. Paid registrations upload the payment slip.
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const MS = SLICNA_MEMBERSHIP;
  const id = new URLSearchParams(window.location.search).get('id');
  const form = document.getElementById('reg-form');
  const statusEl = document.getElementById('reg-status');
  const $ = (sel) => document.getElementById(sel);

  let event = null;
  try {
    event = id ? await SLICNA_API.event(id) : null;
  } catch (err) { /* handled below */ }

  if (!event) {
    $('reg-title').textContent = 'Event not found';
    showClosed('This event may have been removed.');
    return;
  }

  document.title = `Register: ${event.title} | SLICNA`;
  $('reg-title').textContent = event.title;
  $('crumb-event').textContent = event.title.length > 40 ? event.title.slice(0, 40) + '…' : event.title;
  $('crumb-event').href = `/pages/event-detail.html?id=${encodeURIComponent(event.id)}`;
  $('reg-lede').textContent = [SLICNA.formatDate(event.event_date) + (event.end_date ? ' – ' + SLICNA.formatDate(event.end_date) : ''), event.time_text, event.location].filter(Boolean).join(' · ');

  const state = { type: null, member: null, fee: null, currency: 'LKR', attendance: null };
  const money = (n, currency) => (Number(n) ? SLICNA.formatMoney(n, currency) : 'Free');
  // Foreign participants: online and/or physical, each with a USD fee.
  const foreign = event.foreign || [];

  function renderSummary() {
    const facts = [
      ['Date', SLICNA.formatDate(event.event_date) + (event.end_date ? ' – ' + SLICNA.formatDate(event.end_date) : '')],
      ['Time', event.time_text], ['Venue', event.location],
      ['CPD points', event.cpd_points != null ? SLICNA.formatPoints(event.cpd_points) : null],
      ['Who can attend', event.audience_label],
    ].filter(([, v]) => v);
    $('reg-summary').innerHTML = `
      <p class="eyebrow" style="margin-bottom:6px">You're registering for</p>
      <h2 class="summary-title">${esc(event.title)}</h2>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="event-fees"><h3>Event fee</h3>${event.fees.length || foreign.some((f) => f.amount)
        ? `<ul class="fee-list">${[
          ...event.fees.map((f) => [f.label, money(f.amount)]),
          ...foreign.map((f) => [`Foreign participants – ${f.mode}`, money(f.amount, f.currency)]),
        ].map(([label, amount]) => `<li><span>${esc(label)}</span><b>${esc(amount)}</b></li>`).join('')}</ul>`
        : '<p class="fee-free">Free of charge</p>'}</div>
      ${state.fee !== null ? `<div class="your-fee"><span>Your fee</span><b>${esc(money(state.fee, state.currency))}</b></div>` : ''}`;
  }

  function showClosed(message) {
    $('reg-closed').innerHTML = `
      <h2 style="font-size:24px">Registration is not open</h2>
      <p class="muted">${esc(message)}</p>
      <p><a class="btn btn-teal" href="${event ? `/pages/event-detail.html?id=${encodeURIComponent(event.id)}` : '/pages/events.html'}">Back to the event</a></p>`;
    $('reg-closed').hidden = false;
  }

  renderSummary();
  if (!event.registration_open) {
    showClosed(event.is_past ? 'This event has ended.' : `${event.status_label || 'Registration is closed'}. Please check back later.`);
    return;
  }
  form.hidden = false;

  const membersOnly = event.fee_by_category.NM === null;
  if (membersOnly) {
    $('non-member-choice').hidden = true;
    $('members-only-note').hidden = false;
    form.querySelector('[name="registrant_type"][value="member"]').checked = true;
  }

  // Foreign participants get a third choice, then online / physical.
  if (foreign.length) {
    $('foreign-choice').hidden = false;
    $('type-legend').textContent = 'How are you registering?';
    $('foreign-meta').textContent = `From outside Sri Lanka: ${foreign.map((f) => `${f.mode} ${money(f.amount, f.currency).replace('Free', 'free')}`).join(', ')}.`;
    $('attend-choices').innerHTML = foreign.map((f) => `<label class="choice"><input type="radio" name="attendance" value="${f.mode}"><span class="choice-box"><b>${esc(f.label)}</b><span class="choice-meta">${esc(money(f.amount, f.currency))}</span></span></label>`).join('');
    $('attend-choices').querySelectorAll('[name="attendance"]').forEach((r) => r.addEventListener('change', () => chooseAttendance(r.value)));
  }

  // NIC for Sri Lankans; passport number, country and an international mobile for foreign participants.
  function setForeignFields(isForeign) {
    const nic = $('nic_number');
    $('nic-label').textContent = isForeign ? 'Passport number' : 'NIC number';
    nic.maxLength = isForeign ? 20 : 12;
    if (isForeign) delete nic.dataset.nic; else nic.dataset.nic = '';
    $('country-field').hidden = !isForeign;
    $('country').required = isForeign;
    $('slnc-label').innerHTML = isForeign ? 'Nursing registration number <span class="opt">(optional)</span>' : 'SLNC registration number <span class="opt">(optional)</span>';
    $('mobile').placeholder = isForeign ? '+960 7XXXXXX' : '07XXXXXXXX';
    $('mobile').dataset.phone = isForeign ? 'intl' : 'mobile';
    $('pay-how').textContent = isForeign
      ? 'Pay the US dollar amount by international bank transfer to the account below, then upload the transfer confirmation or a screenshot.'
      : 'Pay by bank transfer or deposit, then upload the slip or a screenshot below.';
  }

  function chooseAttendance(mode) {
    const option = foreign.find((f) => f.mode === mode);
    state.attendance = option ? mode : null;
    if (!option) return;
    showDetails(true);
    setFee(option.amount, 'USD');
  }

  // ---------- Steps ----------

  function setFee(fee, currency = 'LKR') {
    state.fee = fee;
    state.currency = currency;
    const paid = fee !== null && fee > 0;
    $('payment-step').hidden = fee === null;
    $('payment-paid').hidden = !paid;
    $('payment-free').hidden = paid;
    $('payment_date').required = paid;
    $('receipt').required = paid;
    if (paid) {
      $('amount-due').textContent = SLICNA.formatMoney(fee, currency);
      if (!$('bank-details').innerHTML && event.bank) $('bank-details').innerHTML = MS.bankBox(event.bank);
    }
    renderSummary();
  }

  function showDetails(show) {
    $('details-step').hidden = !show;
    if (!show) setFee(null);
  }

  function chooseType(type) {
    state.type = type;
    state.member = null;
    state.attendance = null;
    $('member-result').hidden = true;
    $('member-check').hidden = type !== 'member';
    $('foreign-attend').hidden = type !== 'foreign';
    setForeignFields(type === 'foreign');
    if (type === 'foreign') {
      $('attend-choices').querySelectorAll('[name="attendance"]').forEach((r) => { r.checked = false; });
      showDetails(false);
      // Only one way to attend: choose it straight away.
      if (foreign.length === 1) {
        $('attend-choices').querySelector('[name="attendance"]').checked = true;
        chooseAttendance(foreign[0].mode);
      }
    } else if (type === 'non_member') {
      showDetails(true);
      setFee(event.fee_by_category.NM);
    } else {
      showDetails(false);
    }
  }

  form.querySelectorAll('[name="registrant_type"]').forEach((r) => r.addEventListener('change', () => chooseType(r.value)));
  if (membersOnly) chooseType('member');

  // ---------- Membership check ----------

  function memberResult(html, ok) {
    const el = $('member-result');
    el.className = 'member-result ' + (ok ? 'is-ok' : 'is-warn');
    el.innerHTML = html;
    el.hidden = false;
  }

  // The number's prefix (LT/GM/OM/PM) sets the fee. Numbers in our register are
  // also checked for lapsed or deactivated memberships; others are accepted and
  // checked by SLICNA.
  $('check-btn').addEventListener('click', async () => {
    const number = $('membership_number').value.trim();
    if (!/^(LT|GM|OM|PM)\s*\d{1,4}\s*(\/\s*\d{2})?$/i.test(number)) {
      return memberResult('Enter your membership number like GM 0012/25: LT, GM, OM or PM and the number. The year is optional.', false);
    }
    const btn = $('check-btn');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      const q = await SLICNA_API.eventMemberCheck(event.id, number);
      if (!q.eligible) {
        state.member = null;
        showDetails(false);
        memberResult(`<b>${esc(q.membership_number)}</b> · ${esc(q.category_label)}<br>${esc(q.message)}
          ${!membersOnly ? '<p style="margin:10px 0 0"><button type="button" class="btn btn-light btn-sm" data-as-non-member>Register as a non-member</button> <a class="link-arrow" href="/pages/membership-renew.html">Renew my membership</a></p>' : '<p style="margin:10px 0 0"><a class="link-arrow" href="/pages/membership-renew.html">Renew my membership</a></p>'}`, false);
        return;
      }
      state.member = q;
      memberResult(`<span class="check-mark" aria-hidden="true">✓</span>
        <span><b>${esc(q.membership_number)}</b> · ${esc(q.category_label)} · your fee: <b>${esc(money(q.fee))}</b>${q.found ? '' : `<br><span class="member-note">${esc(q.message)}</span>`}</span>`, true);
      showDetails(true);
      setFee(q.fee);
      $('full_name').focus();
    } catch (err) {
      state.member = null;
      showDetails(false);
      memberResult(esc(err.message), false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check my membership';
    }
  });

  $('member-result').addEventListener('click', (e) => {
    if (!e.target.closest('[data-as-non-member]')) return;
    form.querySelector('[name="registrant_type"][value="non_member"]').checked = true;
    chooseType('non_member');
  });

  // Changing the number after it was accepted needs a new check.
  $('membership_number').addEventListener('input', () => {
    if (!state.member) return;
    state.member = null;
    $('member-result').hidden = true;
    showDetails(false);
  });
  $('membership_number').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('check-btn').click();
    }
  });

  // ---------- Name on certificate ----------

  const certSame = $('cert-same');
  const syncCert = () => {
    $('certificate_name').readOnly = certSame.checked;
    if (certSame.checked) $('certificate_name').value = $('full_name').value;
  };
  certSame.addEventListener('change', syncCert);
  $('full_name').addEventListener('input', syncCert);
  syncCert();

  MS.bindFilePreview($('receipt'));

  // ---------- Validation and submit ----------

  function clearErrors() {
    form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
    form.querySelectorAll('.field-error').forEach((m) => m.remove());
  }
  function setError(el, message) {
    const field = el.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.textContent = message;
    field.appendChild(msg);
  }
  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field.has-error');
    if (field) {
      field.classList.remove('has-error');
      field.querySelectorAll('.field-error').forEach((m) => m.remove());
    }
  });

  function validate() {
    clearErrors();
    const problems = [];
    const visible = [...form.querySelectorAll('#details-step input, #details-step textarea, #payment-step input')]
      .filter((el) => !el.closest('[hidden]') && el.type !== 'radio' && el.type !== 'checkbox');
    visible.forEach((el) => {
      if (el.type === 'file') {
        if (el.required && !el.files.length) problems.push([el, 'Please upload your payment slip.']);
        else if (el.files.length) {
          const problem = MS.fileProblem(el, { pdf: true });
          if (problem) problems.push([el, problem]);
        }
        return;
      }
      const v = el.value.trim();
      if (el.required && !v) return problems.push([el, 'This is required.']);
      if (!v) return;
      if ('nic' in el.dataset && !/^(\d{9}[VvXx]|\d{12})$/.test(v.replace(/\s/g, ''))) problems.push([el, 'Enter 12 digits, or 9 digits followed by V or X.']);
      if (el.dataset.phone === 'mobile' && !/^(?:\+94|0)7[0-8][0-9]{7}$/.test(v.replace(/[\s-]/g, ''))) problems.push([el, 'Enter a mobile number like 07XXXXXXXX or +947XXXXXXXX.']);
      if (el.dataset.phone === 'intl' && !/^\+?\d{7,15}$/.test(v.replace(/[\s()-]/g, ''))) problems.push([el, 'Enter your mobile number with the country code, for example +960 7771234.']);
      if (el.id === 'nic_number' && state.type === 'foreign' && !/^[A-Za-z0-9-]{5,20}$/.test(v.replace(/\s/g, ''))) problems.push([el, 'Enter your passport number (letters and numbers only).']);
      if (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) problems.push([el, 'Please enter a valid email address.']);
      if (el.type === 'date' && v > new Date().toISOString().slice(0, 10)) problems.push([el, 'This date cannot be in the future.']);
    });
    problems.forEach(([el, msg]) => setError(el, msg));
    if (problems.length) {
      const first = problems[0][0];
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (first.type !== 'file') first.focus({ preventScroll: true });
    }
    return !problems.length;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.className = 'form-status';
    if (!state.type || state.fee === null) {
      SLICNA_FORM_ERRORS.showError(form, statusEl, state.type === 'member' ? 'Please check your membership first.'
        : state.type === 'foreign' ? 'Please choose whether you will attend online or physically.' : 'Please choose whether you are a member.');
      return;
    }
    if (!validate()) return;

    const data = new FormData(form);
    data.set('registrant_type', state.type);
    if (state.type === 'member') {
      data.set('membership_number', state.member.membership_number);
    } else {
      data.delete('membership_number');
    }
    if (state.type === 'foreign') data.set('attendance', state.attendance);
    else { data.delete('attendance'); data.delete('country'); }
    if (!(state.fee > 0)) ['pay_by', 'payment_date', 'receipt'].forEach((k) => data.delete(k));
    else if (!$('receipt').files.length) data.delete('receipt');

    const button = $('submit-btn');
    button.disabled = true;
    button.textContent = 'Submitting…';
    try {
      const result = await SLICNA_API.registerForEvent(event.id, data);
      showDone(result);
    } catch (err) {
      SLICNA_FORM_ERRORS.showError(form, statusEl, err.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Submit registration';
    }
  });

  function showDone(result) {
    form.hidden = true;
    $('reg-done').innerHTML = `
      <div class="done-mark" aria-hidden="true">✓</div>
      <h2>Registration received</h2>
      <p>Thank you. Your registration for <strong>${esc(result.event_title)}</strong> has been sent to SLICNA.</p>
      <div class="ref-box"><span>Your reference</span><b>${esc(result.reference_number)}</b></div>
      <ul class="check-list">
        ${Number(result.amount_due) > 0 ? `<li>We'll check your payment of ${esc(SLICNA.formatMoney(result.amount_due, result.currency || 'LKR'))}.</li>` : ''}
        <li>You'll get an email at <strong>${esc(result.email)}</strong> once your place is confirmed.</li>
        <li>Questions? Call 071 338 5768 or email slicna2022@gmail.com and quote your reference.</li>
      </ul>
      <p style="margin-top:22px"><a class="btn btn-teal" href="/pages/events.html">See other events</a></p>`;
    $('reg-done').hidden = false;
    SLICNA_FORM_ERRORS.focusOn($('reg-done'));
  }
});
