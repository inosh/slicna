// Renewal page. Opened from a personal renewal link (?t=token), or after a
// lookup with the membership number. Shows the member's status and, where
// relevant, a form to renew or upgrade with a payment slip. After a lookup the
// contact details on record are only hinted at (anyone could type a number).
document.addEventListener('DOMContentLoaded', async () => {
  const MS = SLICNA_MEMBERSHIP;
  const esc = SLICNA.escapeHtml;
  const fmt = (d) => SLICNA.formatDate(d);
  const lookupForm = document.getElementById('lookup-form');
  const lookupError = document.getElementById('lookup-error');
  const host = document.getElementById('renewal');
  let token = new URLSearchParams(location.search).get('t');

  // Keep the token out of the address bar (and browser history) once read.
  if (token) history.replaceState(null, '', location.pathname);

  const STATE_TEXT = {
    active: (m) => m.valid_until ? `Active until ${fmt(m.valid_until)}.` : 'Lifetime member: no renewal needed.',
    renewal_due: (m) => `Your membership expires on ${fmt(m.valid_until)}. You can renew now: your new year starts when the current one ends.`,
    grace: (m) => `Your membership expired on ${fmt(m.valid_until)}. You're in the grace period, so renew now to keep it without a break.`,
    lapsed: () => 'Your membership has lapsed. Renew now to reactivate it; your membership number stays the same.',
    deactivated: () => 'Your membership is not active. Please contact SLICNA on 077 353 6178 or slicna2022@gmail.com.',
  };

  // While a renewal or upgrade waits for verification, the card says so instead of "renew now".
  const pendingRequest = (v) => v.latest_request && v.latest_request.status === 'pending';
  const PENDING_TEXT = 'Your payment has been received and is waiting for verification. Your membership will be updated once it is verified.';

  function memberCard(v) {
    const m = v.member;
    return `
      <div class="status-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <p class="muted" style="margin:0">${esc(m.category_label)}</p>
            <h2 style="font-size:26px;margin:4px 0 0">${esc(m.name_with_initials)}</h2>
            <div class="member-number" style="font-size:26px">${esc(m.membership_number)}</div>
          </div>
          <span class="status-chip status-${esc(m.state)}">${esc(m.state_label)}</span>
        </div>
        <p style="margin:14px 0 0">${esc(pendingRequest(v) ? PENDING_TEXT : STATE_TEXT[m.state](m))}</p>
      </div>`;
  }

  // "Email on record: in•••@gmail.com · Mobile on record: 071•••••68."
  function onRecord(m) {
    const parts = [m.email_hint && `Email on record: ${esc(m.email_hint)}`, m.mobile_hint && `Mobile on record: ${esc(m.mobile_hint)}`].filter(Boolean);
    return parts.length ? `${parts.join(' · ')}.` : 'We have no email or mobile on record for you.';
  }

  function render(v) {
    lookupForm.hidden = true;
    const latest = v.latest_request;
    let html = memberCard(v);

    if (latest && latest.status === 'pending') {
      html += `<div class="callout"><strong>Payment received: waiting for verification.</strong><p style="margin:6px 0 0">We received your ${latest.kind === 'upgrade' ? 'upgrade' : 'renewal'} (reference ${esc(latest.payment_reference)}) on ${esc(fmt(latest.created_at))}. We'll email you once it's verified.</p></div>`;
      host.innerHTML = html;
      return;
    }
    if (latest && latest.status === 'verified' && v.member.state === 'active' && (Date.now() - new Date(latest.reviewed_at)) < 30 * 86400000) {
      html += `<div class="callout"><strong>✓ ${latest.kind === 'upgrade' ? 'Upgrade' : 'Renewal'} confirmed.</strong> ${v.member.valid_until ? `Your membership is valid until ${esc(fmt(v.member.valid_until))}.` : 'You are now a Lifetime member.'}</div>`;
    }
    if (!v.renewal) {
      host.innerHTML = html;
      return;
    }
    if (latest && latest.status === 'rejected') {
      html += `<div class="callout callout-error" style="margin-bottom:20px"><strong>Your last payment could not be verified.</strong>${latest.status_note ? `<p style="margin:6px 0 0">${esc(latest.status_note)}</p>` : ''}<p style="margin:6px 0 0">Please submit it again below.</p></div>`;
    }

    // Renew, or upgrade to any category open to this member ("upgrade:GM"); each
    // option carries its own fee.
    const UPGRADE_META = {
      LT: () => 'Pay once, never renew. Requires a PBCN ICU qualification or 10+ years in ICU.',
      GM: (u) => `For nurses working in a government hospital ICU. New GM number, valid until ${fmt(u.new_valid_until)}.`,
      OM: (u) => `For nurses at any government hospital. New OM number, valid until ${fmt(u.new_valid_until)}.`,
    };
    const amounts = { renewal: v.renewal.amount, ...Object.fromEntries(v.upgrades.map((u) => [`upgrade:${u.to_category}`, u.amount])) };
    html += `
      <form class="form-card" id="renew-form" novalidate>
        <h2 style="font-size:24px">Choose an option</h2>
        <div class="choice-grid">
          <label class="choice"><input type="radio" name="option" value="renewal" checked>
            <span class="choice-box"><span class="choice-price">${esc(MS.money(v.renewal.amount))}</span><b>Renew for 12 months</b>
            <span class="choice-meta">Valid until ${esc(fmt(v.renewal.new_valid_until))}</span></span></label>
          ${v.upgrades.map((u) => `
          <label class="choice"><input type="radio" name="option" value="upgrade:${esc(u.to_category)}">
            <span class="choice-box"><span class="choice-price">${esc(MS.money(u.amount))}</span><b>Upgrade to ${esc(u.label.replace(' Membership', ''))}</b>
            <span class="choice-meta">${esc((UPGRADE_META[u.to_category] || (() => ''))(u))}</span></span></label>`).join('')}
        </div>

        <div class="upgrade-req" id="upgrade-req" hidden>
          <h3 style="font-size:20px;margin:0 0 4px">Lifetime requirement</h3>
          <p class="muted" style="margin:0 0 14px">Your Post Basic College of Nursing (PBCN) ICU training, as on the Lifetime application form.</p>
          <div class="form-grid">
            <div class="field"><label for="r-icu-batch">ICU training batch (PBCN)</label><input id="r-icu-batch" name="icu_training_batch" maxlength="50"></div>
            <div class="field"><label for="r-icu-type">Diploma or certificate</label>
              <select id="r-icu-type" name="icu_training_type"><option value="">Select</option><option value="diploma">Diploma</option><option value="certificate">Certificate</option></select></div>
            <div class="field"><label for="r-icu-year">Year</label><input id="r-icu-year" name="icu_training_year" type="number" min="1950" max="2100" inputmode="numeric"></div>
          </div>
        </div>

        <h3 style="font-size:20px;margin-top:26px">1. Pay the fee</h3>
        <p><span class="amount-due" id="amount-due">${esc(MS.money(v.renewal.amount))}</span></p>
        <p class="muted">Pay by bank transfer or deposit, then upload the slip or a screenshot below.</p>
        ${MS.bankBox(v.bank)}

        <h3 style="font-size:20px;margin-top:26px">2. ${v.member.contact_hidden ? 'Update your contact details (if they changed)' : 'Check your contact details'}</h3>
        ${v.member.contact_hidden ? `<p class="muted">${onRecord(v.member)} Leave these empty to keep what we have.</p>` : ''}
        <div class="form-grid">
          <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" maxlength="255" value="${esc(v.member.email)}"></div>
          <div class="field"><label for="r-mobile">Mobile</label><input id="r-mobile" name="mobile" type="tel" maxlength="13" placeholder="07XXXXXXXX" value="${esc(v.member.mobile)}"></div>
          <div class="field full"><label for="r-work">Current working place</label><input id="r-work" name="current_working_place" maxlength="255" value="${esc(v.member.current_working_place)}"></div>
        </div>

        <h3 style="font-size:20px;margin-top:26px">3. Upload your payment slip</h3>
        <div class="form-grid">
          <div class="field"><label for="r-date">Date you paid</label><input id="r-date" name="payment_date" type="date" required value="${esc(MS.today())}"></div>
          <div class="field full"><label for="r-receipt">Payment slip or screenshot</label>
            <div class="file-field"><div class="file-preview">No file</div><div><input type="file" id="r-receipt" name="receipt" accept="image/jpeg,image/png,image/webp,application/pdf" required><p class="hint">JPG / PNG / PDF, up to 10MB.</p></div></div></div>
        </div>
        <div class="form-status" id="renew-status" role="status"></div>
        <div class="step-nav" style="justify-content:flex-end"><button class="btn btn-coral" type="submit">Submit</button></div>
      </form>`;
    host.innerHTML = html;

    const form = document.getElementById('renew-form');
    MS.bindFilePreview(form.receipt);
    const upgradeReq = document.getElementById('upgrade-req');
    const upgradeInputs = [form.icu_training_batch, form.icu_training_type, form.icu_training_year];
    // The PBCN ICU details are asked only for an upgrade to Lifetime.
    form.addEventListener('change', (e) => {
      if (e.target.name === 'option') {
        const toLifetime = e.target.value === 'upgrade:LT';
        document.getElementById('amount-due').textContent = MS.money(amounts[e.target.value]);
        upgradeReq.hidden = !toLifetime;
        upgradeInputs.forEach((el) => { el.required = toLifetime; });
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const FE = SLICNA_FORM_ERRORS;
      const status = document.getElementById('renew-status');
      status.className = 'form-status';
      FE.clearAll(form);
      // Each problem is shown under its field, which gets focus.
      const fail = (input, msg) => {
        FE.setFieldError(input, msg);
        FE.focusOn(input);
      };
      const option = form.option.value;
      if (option === 'upgrade:LT') {
        const empty = upgradeInputs.find((el) => !el.value.trim());
        if (empty) return fail(empty, 'This is required for Lifetime Membership.');
        const year = Number(form.icu_training_year.value);
        if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()) return fail(form.icu_training_year, 'Please enter the year you completed the training.');
      }
      form.mobile.value = form.mobile.value.replace(/[\s-]/g, '');
      if (form.mobile.value && !/^(?:\+94|0)7[0-8][0-9]{7}$/.test(form.mobile.value)) return fail(form.mobile, 'Enter a mobile number like 07XXXXXXXX or +947XXXXXXXX.');
      if (!form.payment_date.value) return fail(form.payment_date, 'Please enter the date you paid.');
      if (!form.receipt.files.length) return fail(form.receipt, 'Please upload your payment slip or screenshot.');
      const problem = MS.fileProblem(form.receipt, { pdf: true });
      if (problem) return fail(form.receipt, problem);

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = 'Submitting…';
      try {
        // "upgrade:GM" is sent as kind = upgrade, to_category = GM.
        const data = new FormData(form);
        data.delete('option');
        data.set('kind', option === 'renewal' ? 'renewal' : 'upgrade');
        if (option !== 'renewal') data.set('to_category', option.slice(8));
        if (option !== 'upgrade:LT') ['icu_training_batch', 'icu_training_type', 'icu_training_year'].forEach((k) => data.delete(k));
        const result = await SLICNA_API.submitRenewal(token, data);
        host.innerHTML = memberCard({ ...v, latest_request: { status: 'pending' } }) + `
          <div class="form-card success-panel">
            <div class="tick" aria-hidden="true">✓</div>
            <h2>Thank you</h2>
            <p class="muted" style="max-width:50ch;margin:0 auto 12px">We received your payment slip (reference <strong>${esc(result.payment_reference)}</strong>). We'll verify it and confirm by email, usually within a few working days.</p>
          </div>`;
        FE.focusOn(host.querySelector('.success-panel'));
      } catch (err) {
        FE.showError(form, status, err.message);
        button.disabled = false;
        button.textContent = 'Submit';
      }
    });
  }

  async function load() {
    host.innerHTML = '<div class="skeleton" style="min-height:200px"></div>';
    try {
      render(await SLICNA_API.renewalView(token));
    } catch (err) {
      host.innerHTML = '';
      lookupForm.hidden = false;
      lookupError.className = 'form-status is-error';
      lookupError.textContent = err.message;
    }
  }

  lookupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('lookup-number').value.trim();
    lookupError.className = 'form-status';
    if (!number) {
      lookupError.className = 'form-status is-error';
      lookupError.textContent = 'Please enter your membership number.';
      return;
    }
    const button = lookupForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      token = (await SLICNA_API.renewalLookup(number)).token;
      await load();
    } catch (err) {
      lookupError.className = 'form-status is-error';
      lookupError.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });

  if (token) load();
  else lookupForm.hidden = false;
});
