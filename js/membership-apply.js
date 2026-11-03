// Membership application: a step-by-step form whose fields adapt to the
// chosen category (LT / GM / OM / PM). Text answers are saved as a draft in
// this browser, so an applicant can come back later; files are not saved.
document.addEventListener('DOMContentLoaded', async () => {
  const MS = SLICNA_MEMBERSHIP;
  const esc = SLICNA.escapeHtml;
  const form = document.getElementById('apply-form');
  const allPanels = [...form.querySelectorAll('.step-panel')];
  const stepperEl = document.getElementById('stepper');
  const backBtn = document.getElementById('back-btn');
  const nextBtn = document.getElementById('next-btn');
  const DRAFT_KEY = 'slicna_membership_draft_v1';

  let info = null;
  let category = null;
  let current = 0;

  // ---------- Steps ----------

  const steps = () => allPanels.filter((p) => !(p.dataset.step === 'endorsement' && category === 'LT'));

  function renderStepper() {
    stepperEl.innerHTML = steps().map((p, i) => `<li class="${i < current ? 'is-done' : i === current ? 'is-current' : ''}"${i === current ? ' aria-current="step"' : ''}>${p.dataset.title}</li>`).join('');
  }

  function showStep(index) {
    const list = steps();
    current = Math.max(0, Math.min(index, list.length - 1));
    allPanels.forEach((p) => { p.hidden = p !== list[current]; });
    if (list[current].dataset.step === 'review') buildReview();
    if (list[current].dataset.step === 'endorsement') updateDownloadLinks();
    backBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = current === list.length - 1 ? 'Submit application' : 'Continue';
    renderStepper();
    document.getElementById('apply-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Category ----------

  function renderCategoryChoices() {
    const fees = info ? Object.fromEntries(info.fees.map((f) => [f.category, f])) : {};
    document.getElementById('category-choices').innerHTML = MS.ORDER.map((code) => {
      const c = MS.CATEGORIES[code];
      const fee = fees[code];
      return `
        <label class="choice">
          <input type="radio" name="category" value="${code}" required${category === code ? ' checked' : ''}>
          <span class="choice-box">
            ${fee ? `<span class="choice-price">${esc(MS.money(fee.amount))}</span>` : ''}
            <b>${esc(c.name)} (${code})</b>
            <span class="choice-meta">${esc(c.who)}</span>
            <span class="choice-meta"><strong>${fee ? esc(MS.period(fee)) : ''}</strong> · ${esc(c.needs)}</span>
          </span>
        </label>`;
    }).join('');
  }

  // Shows only the fields that apply to the category and sets which are required.
  function applyCategory(cat) {
    category = cat;
    const isPm = cat === 'PM';
    form.querySelectorAll('[data-only]').forEach((el) => { el.hidden = !el.dataset.only.split(' ').includes(cat); });
    form.querySelectorAll('[data-hide]').forEach((el) => { el.hidden = el.dataset.hide.split(' ').includes(cat); });
    syncRequired();
    form.querySelectorAll('[data-label-pm]').forEach((label) => {
      label.dataset.labelDefault = label.dataset.labelDefault || label.childNodes[0].textContent.trim();
      label.childNodes[0].textContent = (isPm ? label.dataset.labelPm : label.dataset.labelDefault) + ' ';
    });
    form.querySelectorAll('[data-text-pm]').forEach((el) => {
      el.dataset.textDefault = el.dataset.textDefault || el.textContent;
      el.textContent = isPm ? el.dataset.textPm : el.dataset.textDefault;
    });
    form.querySelectorAll('[data-placeholder-pm]').forEach((el) => {
      el.dataset.placeholderDefault = el.dataset.placeholderDefault || el.placeholder;
      el.placeholder = isPm ? el.dataset.placeholderPm : el.dataset.placeholderDefault;
    });

    const fee = info && info.fees.find((f) => f.category === cat);
    document.getElementById('fee-amount').textContent = fee ? MS.money(fee.amount) : '';
    document.getElementById('fee-period').textContent = fee ? (fee.is_annual ? 'per year (12 months from approval)' : 'one-time, for life') : '';
    renderStepper();
  }

  // A field is required when it applies to the category, unless its
  // "I do not have my SLNC / SLNA number yet" box is ticked.
  function syncRequired() {
    form.querySelectorAll('[data-required-for]').forEach((el) => {
      const group = el.closest('[data-toggle-group]');
      const toggledOff = group && form.querySelector(`[data-toggles="${group.dataset.toggleGroup}"]`).checked;
      el.required = el.dataset.requiredFor.split(' ').includes(category) && !toggledOff;
    });
  }

  // Ticking the box hides and clears the number and date, as in SLNA's join form.
  function applyToggle(checkbox) {
    const group = form.querySelector(`[data-toggle-group="${checkbox.dataset.toggles}"]`);
    group.hidden = checkbox.checked;
    if (checkbox.checked) {
      group.querySelectorAll('input').forEach((el) => {
        el.value = '';
        const field = el.closest('.field');
        field.classList.remove('has-error');
        field.querySelectorAll('.field-error').forEach((m) => m.remove());
      });
    }
    syncRequired();
  }

  // Sri Lankan numbers, as in SLNA's join form: 0XXXXXXXXX or +94XXXXXXXXX,
  // mobiles starting 070-078. Spaces and dashes are removed as you type.
  const PHONE_RULES = {
    mobile: { re: /^(?:\+94|0)7[0-8][0-9]{7}$/, message: 'Enter a mobile number like 07XXXXXXXX or +947XXXXXXXX.' },
    phone: { re: /^(?:\+94|0)[1-9][0-9]{8}$/, message: 'Enter a number like 0XXXXXXXXX or +94XXXXXXXXX.' },
  };
  form.querySelectorAll('[data-phone]').forEach((input) => {
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[\s-]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
    });
  });
  const nicInput = document.getElementById('nic_number');
  nicInput.addEventListener('input', () => {
    const cleaned = nicInput.value.replace(/\s/g, '').toUpperCase();
    if (cleaned !== nicInput.value) nicInput.value = cleaned;
  });

  function updateDownloadLinks() {
    const name = [val('title'), val('name_with_initials') || val('full_name')].filter(Boolean).join(' ');
    const params = new URLSearchParams({ category: category || '', name });
    document.getElementById('download-lt-page').href = `/pages/membership-recommendation.html?${params}`;
    params.set('student', val('student_number'));
    params.set('full_name', val('full_name'));
    document.getElementById('download-pm-page').href = `/pages/membership-recommendation.html?${params}`;
  }

  // ---------- Values ----------

  function val(name) {
    const els = form.querySelectorAll(`[name="${name}"]`);
    if (!els.length) return '';
    if (els[0].type === 'radio') return (form.querySelector(`[name="${name}"]:checked`) || {}).value || '';
    return els[0].value.trim();
  }

  const checked = (name) => Boolean(form.querySelector('[name="' + name + '"]:checked'));

  // The recommendation inputs for this category (Lifetime member or institution).
  // Only the other category's block is excluded: the step panel itself may be
  // hidden (e.g. on the review step) and its values are still needed.
  function endorserInputs() {
    return [...form.querySelectorAll('[data-name]')].filter((el) => !el.closest('[data-only][hidden]'));
  }

  // ---------- Validation ----------

  const isVisible = (el) => !el.closest('[hidden]');

  function setError(el, message) {
    const field = el.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.textContent = message;
    field.appendChild(msg);
  }

  function validatePanel(panel) {
    panel.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
    panel.querySelectorAll('.field-error').forEach((m) => m.remove());
    const problems = [];
    const seenRadio = new Set();

    panel.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!isVisible(el) || el.type === 'checkbox') return;
      if (el.type === 'radio') {
        if (seenRadio.has(el.name)) return;
        seenRadio.add(el.name);
        const group = panel.querySelectorAll(`[name="${el.name}"]`);
        if ([...group].some((r) => r.required) && !panel.querySelector(`[name="${el.name}"]:checked`)) problems.push([el, 'Please choose one.']);
        return;
      }
      if (el.type === 'file') {
        if (el.required && !el.files.length) problems.push([el, 'Please choose a file.']);
        else {
          const problem = MS.fileProblem(el, { pdf: 'pdf' in el.dataset });
          if (problem) problems.push([el, problem]);
        }
        return;
      }
      const v = el.value.trim();
      if (el.required && !v) return problems.push([el, 'This is required.']);
      if (!v) return;
      if ('nic' in el.dataset && !/^(\d{9}[VvXx]|\d{12})$/.test(v.replace(/\s/g, ''))) problems.push([el, 'Enter 12 digits, or 9 digits followed by V or X.']);
      if (el.dataset.phone && !PHONE_RULES[el.dataset.phone].re.test(v.replace(/[\s-]/g, ''))) problems.push([el, PHONE_RULES[el.dataset.phone].message]);
      if (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) problems.push([el, 'Please enter a valid email address.']);
      if (el.type === 'date' && v > new Date().toISOString().slice(0, 10)) problems.push([el, 'This date cannot be in the future.']);
    });

    problems.forEach(([el, msg]) => setError(el, msg));
    if (problems.length) {
      const first = problems[0][0];
      (first.type === 'radio' ? first.closest('.field, .choice-grid') : first).scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (first.type !== 'radio' && first.type !== 'file') first.focus({ preventScroll: true });
    }
    return problems.length === 0;
  }

  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field.has-error');
    if (field) {
      field.classList.remove('has-error');
      field.querySelectorAll('.field-error').forEach((m) => m.remove());
    }
    saveDraft();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'category') applyCategory(e.target.value);
    if (e.target.dataset.toggles) applyToggle(e.target);
    saveDraft();
  });

  // ---------- Draft (text answers only, this browser only) ----------

  let draftTimer = null;
  let submitted = false;
  function saveDraft() {
    clearTimeout(draftTimer);
    if (submitted) return;
    draftTimer = setTimeout(() => {
      const data = {};
      form.querySelectorAll('input, select, textarea').forEach((el) => {
        // Recommendation inputs share backend names between two sets, so they're saved by id.
        const key = el.name || (el.dataset.name ? el.id : '');
        if (el.type === 'checkbox' && el.dataset.toggles) { if (el.checked) data[el.name] = 'true'; return; }
        if (!key || el.type === 'file' || el.type === 'checkbox') return;
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; return; }
        if (el.value) data[key] = el.value;
      });
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (err) { /* storage unavailable */ }
    }, 400);
  }

  function restoreDraft() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (err) { /* ignore */ }
    if (!data || !Object.keys(data).length) return false;
    Object.entries(data).forEach(([key, value]) => {
      const toggle = form.querySelector(`input[type="checkbox"][data-toggles][name="${key}"]`);
      if (toggle) { toggle.checked = value === 'true'; applyToggle(toggle); return; }
      const radio = form.querySelector(`input[type="radio"][name="${key}"][value="${CSS.escape(value)}"]`);
      if (radio) { radio.checked = true; return; }
      const el = form.querySelector(`[name="${key}"]:not([type="radio"])`) || document.getElementById(key);
      if (el && el.type !== 'file') el.value = value;
    });
    return data.category || true;
  }

  function clearDraft() {
    clearTimeout(draftTimer);
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
  }

  // ---------- Review ----------

  function buildReview() {
    const row = (label, value) => (value ? `<dt>${esc(label)}</dt><dd>${esc(value).replace(/\n/g, '<br>')}</dd>` : '');
    const fileName = (id) => { const f = document.getElementById(id).files[0]; return f ? f.name : ''; };
    const stepIndex = (name) => steps().findIndex((p) => p.dataset.step === name);
    const group = (title, step, rows) => `
      <div class="review-group">
        <h3>${esc(title)} <button type="button" data-goto="${stepIndex(step)}">Edit</button></h3>
        <dl>${rows.join('')}</dl>
      </div>`;
    const c = MS.CATEGORIES[category];
    const isPm = category === 'PM';
    const endorser = Object.fromEntries(endorserInputs().map((el) => [el.dataset.name, el.value.trim()]));

    document.getElementById('review').innerHTML = [
      group('Category', 'category', [row('Membership', `${c.name} (${category})`), row('Fee', document.getElementById('fee-amount').textContent + ' ' + document.getElementById('fee-period').textContent)]),
      group('About you', 'personal', [
        row('Name', `${val('title')} ${val('full_name')}`), row('Name with initials', val('name_with_initials')), row('NIC', val('nic_number')),
        row('Date of birth', val('date_of_birth')), row('Sex', val('sex')), row('Marital status', val('marital_status')),
        row('Email', val('email')), row('Mobile', val('mobile')), row('WhatsApp', val('whatsapp')), row('Address', val('permanent_address')),
      ]),
      group(isPm ? 'Your studies' : 'Your nursing', 'nursing', [
        !isPm ? row('SLNC registration', checked('slnc_not_registered') ? 'Not registered yet' : [val('slnc_number'), val('slnc_date')].join(', ')) : '',
        row('SLNA membership', checked('slna_not_member') ? 'No SLNA number yet' : [val('slna_number'), val('slna_date')].join(', ')),
        row('Official address', val('official_address')),
        row(isPm ? 'Institution' : 'Working place', val('current_working_place')), row('Designation', val('designation')),
        row('Nursing school / university', val('nursing_school')), row('Batch', val('batch')),
        isPm ? row('Student number', [val('student_number'), val('institute_registration_date') && 'registered ' + val('institute_registration_date')].filter(Boolean).join(', ')) : row('First appointment', [val('first_appointment_date'), val('first_appointment_place')].filter(Boolean).join(', ')),
        category === 'LT' ? row('ICU training', [val('icu_training_type'), val('icu_training_batch'), val('icu_training_year')].filter(Boolean).join(', ')) : '',
        row('Higher qualifications', val('higher_qualifications')),
      ]),
      category !== 'LT' ? group(isPm ? 'Certification' : 'Recommendation', 'endorsement', isPm ? [
        row('Institution', endorser.endorser_workplace), row('Signed by', [endorser.endorser_name, endorser.endorser_designation].filter(Boolean).join(', ')),
        row('Contact', endorser.endorser_contact), row('Signed page', fileName('endorsement')),
      ] : [
        row('Lifetime member', endorser.endorser_name), row('LT number', endorser.endorser_membership_number),
        row('Contact', endorser.endorser_contact), row('Workplace', endorser.endorser_workplace), row('Signed page', fileName('endorsement')),
      ]) : '',
      group('Photo & payment', 'payment', [row('Photo', fileName('photo')), row('Payment date', val('payment_date')), row('Payment slip', fileName('receipt'))]),
    ].join('');
  }

  document.getElementById('review').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) showStep(Number(btn.dataset.goto));
  });

  // ---------- Submit ----------

  async function submit() {
    const status = document.getElementById('submit-status');
    const declaration = document.getElementById('declaration');
    if (!declaration.checked) {
      status.className = 'form-status is-error';
      status.textContent = 'Please confirm that your details are true.';
      return;
    }

    const data = new FormData(form);
    if (category === 'LT') data.delete('endorsement');
    endorserInputs().forEach((el) => data.set(el.dataset.name, el.value.trim()));
    data.set('nic_number', val('nic_number').replace(/\s/g, '').toUpperCase());
    ['photo', 'receipt', 'endorsement'].forEach((name) => {
      const file = data.get(name);
      if (file && !file.size) data.delete(name);
    });

    nextBtn.disabled = true;
    backBtn.disabled = true;
    nextBtn.textContent = 'Submitting…';
    status.className = 'form-status';
    try {
      const result = await SLICNA_API.applyMembership(data);
      submitted = true;
      clearDraft();
      document.getElementById('apply-card').hidden = true;
      document.getElementById('draft-note').hidden = true;
      const success = document.getElementById('success');
      success.innerHTML = `
        <div class="tick" aria-hidden="true">✓</div>
        <h2>Application submitted</h2>
        <p class="muted">Thank you. Your reference number is:</p>
        <p><span class="ref-code">${esc(result.reference_number)} <button type="button" class="copy-btn" data-copy="${esc(result.reference_number)}">Copy</button></span></p>
        <p class="muted" style="max-width:52ch;margin:16px auto">Please keep this number. We have also emailed it to you. The committee will check your details and payment, and you'll hear from us by email. You can check progress at any time with this number and your NIC.</p>
        <p><a class="btn btn-teal" href="/pages/membership-status.html?ref=${encodeURIComponent(result.reference_number)}">Check application status</a></p>`;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      status.className = 'form-status is-error';
      status.textContent = err.message;
      nextBtn.disabled = false;
      backBtn.disabled = false;
      nextBtn.textContent = 'Submit application';
    }
  }

  nextBtn.addEventListener('click', () => {
    const panel = steps()[current];
    if (panel.dataset.step === 'review') return submit();
    if (!validatePanel(panel)) return;
    showStep(current + 1);
  });
  backBtn.addEventListener('click', () => showStep(current - 1));

  // ---------- Start ----------

  form.querySelectorAll('.file-field input[type="file"]').forEach(MS.bindFilePreview);

  try {
    info = await SLICNA_API.membershipInfo();
    document.getElementById('bank-details').innerHTML = MS.bankBox(info.bank);
  } catch (err) {
    document.getElementById('bank-details').innerHTML = '<p class="callout callout-error">Payment details could not be loaded. Please call 077 353 6178.</p>';
  }

  const fromUrl = (new URLSearchParams(location.search).get('category') || '').toUpperCase();
  renderCategoryChoices();
  const restored = restoreDraft();
  const startCategory = MS.CATEGORIES[fromUrl] ? fromUrl : typeof restored === 'string' ? restored : null;
  if (startCategory) {
    const radio = form.querySelector(`input[name="category"][value="${startCategory}"]`);
    radio.checked = true;
    applyCategory(startCategory);
  }

  if (restored) {
    const note = document.getElementById('draft-note');
    note.innerHTML = 'We restored the answers you started earlier on this device. Photos and files need to be chosen again. <button type="button" class="copy-btn" id="start-over">Start over</button>';
    note.hidden = false;
    document.getElementById('start-over').onclick = () => {
      clearDraft();
      location.href = location.pathname + (fromUrl ? '?category=' + fromUrl : '');
    };
  }

  showStep(0);
  window.scrollTo(0, 0);
});
