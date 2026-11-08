// Admin: CPD and other events (with audience and fees) and CPD event
// registrations. Uses the shared helpers from admin.js (window.SLICNA_ADMIN).
// Every action that changes something asks for confirmation first.
(() => {
  const A = window.SLICNA_ADMIN;
  if (!A) return;
  const { api, esc, fmtDate, fmtDateTime, toast, confirmDialog, openForm, infoDialog, resourcePanel, docTiles, filterBar, query } = A;

  const BASE = '/events/admin';
  const MEMBER_CATEGORIES = [['LT', 'Lifetime'], ['GM', 'General'], ['OM', 'Ordinary'], ['PM', 'Partial']];
  const FEE_COLUMNS = { LT: 'fee_lt', GM: 'fee_gm', OM: 'fee_om', PM: 'fee_pm' };
  const REGISTERED_AS = { LT: 'Lifetime member', GM: 'General member', OM: 'Ordinary member', PM: 'Partial member', NM: 'Non-member', FO: 'Foreign · online', FP: 'Foreign · physical' };
  // Foreign participants' options in one line: "Online USD 10 · Physical USD 30".
  const foreignText = (e) => (e.foreign || []).map((f) => `${f.label} ${f.amount ? money(f.amount, 'USD') : 'free'}`).join(' · ');
  const REG_STATUS = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected' };
  const REG_CHIP = { pending: 'pending', confirmed: 'approved', rejected: 'rejected' };

  const money = (n, currency) => `${currency || 'LKR'} ` + Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const chip = (cls, label) => `<span class="status-chip status-${esc(cls)}">${esc(label)}</span>`;
  const dl = (rows) => `<dl class="detail-list">${rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${typeof v === 'object' ? v.html : esc(v)}</dd>`).join('')}</dl>`;
  const html = (s) => ({ html: s });
  const dateRange = (e) => {
    const end = e.ends_on !== undefined ? e.ends_on : e.end_date;
    return fmtDate(e.event_date) + (end ? ' – ' + fmtDate(end) : '');
  };

  // Event status -> chip colour.
  const chipClass = (e) => (e.is_past ? 'rejected' : e.status === 'open' ? 'approved' : e.status === 'closed' ? 'rejected' : 'pending');
  const ongoingChip = (e) => (e.is_ongoing ? ' <span class="status-chip status-ongoing">Ongoing</span>' : '');
  const eventChip = (e) => chip(chipClass(e), e.status_label) + ongoingChip(e);
  // Short statuses for the Events table, without the word "Registration".
  const SHORT_STATUS = {
    cpd: { coming_soon: 'Coming Soon', opening_soon: 'Opening Soon', open: 'Open', closed: 'Closed' },
    other: { coming_soon: 'Coming Soon', upcoming: 'Upcoming' },
  };
  // Registered on this website (the default), on another site, or not at all.
  const regMode = (e) => (e.category === 'cpd' ? e.registration_mode || 'online' : null);
  const shortChip = (e) => (regMode(e) === 'none' && !e.is_past
    ? chip('approved', 'No registration') + ongoingChip(e)
    : chip(chipClass(e), e.is_past ? 'Completed' : (SHORT_STATUS[e.category] || {})[e.status] || e.status_label) + ongoingChip(e));
  const AUDIENCE_SHORT = { public: 'Everyone', members: 'Members only' };
  // Compact fee for the table ("Free", "LKR 500", "Free – LKR 1,500"); the full list is in the tooltip.
  const feeText = (e) => {
    const amounts = e.fees.map((f) => Number(f.amount));
    if (!amounts.length || amounts.every((n) => !n)) return 'Free';
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return min === max ? money(min) : `${min ? money(min) : 'Free'} – ${money(max)}`;
  };
  const feeTitle = (e) => [...e.fees.map((f) => `${f.label}: ${f.amount ? money(f.amount) : 'Free'}`),
    ...(e.foreign || []).map((f) => `Foreign participants (${f.mode}): ${f.amount ? money(f.amount, 'USD') : 'Free'}`)].join('\n');

  let options = null;
  const loadOptions = async () => (options = options || await api('GET', `${BASE}/options`));

  // =====================================================================
  // Events
  // =====================================================================

  // Same grouping as the public pages (lib/events.js feeSummary).
  function feePreview(v) {
    if (v.fee_type !== 'paid') return 'Free for everyone.';
    const amt = (x) => (x === '' || x === null || x === undefined ? null : Number(x));
    const show = (n) => (n === null ? '—' : n ? money(n) : 'Free');
    const lines = [];
    if (v.member_pricing === 'by_category') {
      const groups = new Map();
      MEMBER_CATEGORIES.forEach(([c, name]) => {
        const n = amt(v[FEE_COLUMNS[c]]);
        if (!groups.has(n)) groups.set(n, []);
        groups.get(n).push(name);
      });
      if (groups.size === 1) lines.push(['All members', [...groups.keys()][0]]);
      else groups.forEach((names, n) => lines.push([(names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0]) + ' members', n]));
    } else {
      lines.push(['Members', amt(v.member_fee)]);
    }
    if (v.audience !== 'members') {
      const nm = amt(v.non_member_fee);
      if (lines.length === 1 && lines[0][1] === nm && nm !== null) return `Everyone pays ${show(nm)}.`;
      lines.push(['Non-members', nm]);
    } else {
      lines.push(['Non-members', 'cannot register']);
    }
    return lines.map(([label, n]) => `${label}: ${typeof n === 'string' ? n : show(n)}`).join(' · ');
  }

  const moneyInput = (name, label, value) => `
    <div class="fee-input">
      <label for="f-${name}">${esc(label)}</label>
      <div class="money-input"><span>LKR</span><input id="f-${name}" name="${name}" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(value ?? '')}"></div>
    </div>`;
  const radio = (name, value, label, current) => `<label><input type="radio" name="${name}" value="${value}"${current === value ? ' checked' : ''}> ${esc(label)}</label>`;

  // ---------- Time (as on SLNA: start and end time, or typed text) ----------

  const pad = (n) => String(n).padStart(2, '0');
  // "8.00 a.m. – 4.00 p.m." (older events' typed time) -> ["08:00", "16:00"], else null.
  function parseTimeRange(text) {
    const m = /^(\d{1,2})(?:[.:](\d{2}))?\s*([ap])\.?\s*m\.?\s*(?:–|-|to)\s*(\d{1,2})(?:[.:](\d{2}))?\s*([ap])\.?\s*m\.?$/i.exec(String(text || '').trim());
    if (!m) return null;
    const to24 = (h, min, ap) => `${pad((Number(h) % 12) + (ap.toLowerCase() === 'p' ? 12 : 0))}:${min || '00'}`;
    return [to24(m[1], m[2], m[3]), to24(m[4], m[5], m[6])];
  }
  // "08:00" -> "8.00 a.m."
  const time12 = (t) => {
    if (!t) return '';
    const [h, min] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}.${pad(min)} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  };
  // Hour / minute / AM-PM selects for one time ("start" or "end").
  function timeSelects(which, value) {
    const [h, min] = value ? value.split(':').map(Number) : [null, null];
    const hour12 = h === null ? '' : ((h + 11) % 12) + 1;
    const opts = (list, current) => list.map(([v, l]) => `<option value="${v}"${String(v) === String(current) ? ' selected' : ''}>${l}</option>`).join('');
    return `<span class="time-pick">
      <select data-t="${which}-h" aria-label="${which === 'start' ? 'Start' : 'End'} hour">${opts([['', '--'], ...Array.from({ length: 12 }, (_, i) => [i + 1, i + 1])], hour12)}</select>
      <span aria-hidden="true">:</span>
      <select data-t="${which}-m" aria-label="${which === 'start' ? 'Start' : 'End'} minute">${opts(Array.from({ length: 12 }, (_, i) => [pad(i * 5), pad(i * 5)]), min === null ? '00' : pad(min - (min % 5)))}</select>
      <select data-t="${which}-p" aria-label="${which === 'start' ? 'Start' : 'End'} a.m. or p.m.">${opts([['am', 'a.m.'], ['pm', 'p.m.']], h !== null && h >= 12 ? 'pm' : 'am')}</select>
    </span>`;
  }
  function timeBlock(v) {
    let start = (v.start_time || '').slice(0, 5);
    let end = (v.end_time || '').slice(0, 5);
    let text = v.time_text || '';
    // An older typed range ("8.00 a.m. – 4.00 p.m.") opens as start and end times.
    const parsed = !start && parseTimeRange(text);
    if (parsed) { [start, end] = parsed; text = ''; }
    const mode = text ? 'text' : 'range';
    return `
      <div class="field full" data-time-block>
        <span class="field-label">Time <span class="opt">(optional)</span></span>
        <div class="seg seg-sm" role="radiogroup" aria-label="How to give the time">
          ${radio('time_mode', 'range', 'Start and end time', mode)}
          ${radio('time_mode', 'text', 'Type it instead', mode)}
        </div>
        <div class="time-range" data-time-mode="range">
          <span>From</span>${timeSelects('start', start)}<span>to</span>${timeSelects('end', end)}
        </div>
        <input type="hidden" name="start_time" value="${esc(start)}"><input type="hidden" name="end_time" value="${esc(end)}">
        <div data-time-mode="text"><input type="text" name="time_text" maxlength="100" value="${esc(text)}" placeholder="For example: 12 PM EST, or Saturdays, 9.00 a.m."></div>
        <p class="hint" data-time-preview></p>
      </div>`;
  }

  // ---------- Duration (as on SLNA) ----------
  function durationBlock(v) {
    const units = Object.entries(options.duration_units || { day: 'Day(s)', month: 'Month(s)', year: 'Year(s)' });
    return `
      <div class="field full" data-duration-block>
        <span class="field-label">Programme duration</span>
        <div class="duration-row">
          <label>Length<input type="number" name="duration_number" min="1" max="366" step="1" required value="${esc(v.duration_number || 1)}"></label>
          <label>Unit<select name="duration_unit">${units.map(([k, l]) => `<option value="${k}"${(v.duration_unit || 'day') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>End date <span class="opt">(optional)</span><input type="date" name="end_date" value="${esc(String(v.end_date || '').slice(0, 10))}"></label>
        </div>
        <p class="hint">Defaults to 1 day: most CPD events run on a single day. Set the length for programmes that run longer (for example, a 3-month certificate course). If you know the exact last day, enter it as the end date and it is used instead of the calculated one.</p>
        <p class="hint duration-preview" data-duration-preview></p>
      </div>`;
  }
  // Last day from the start date and duration (as the server works it out).
  function lastDay(start, n, unit, exact) {
    if (exact) return exact;
    if (!start) return '';
    const d = new Date(start + 'T00:00:00Z');
    if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + n);
    else if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + n);
    else d.setUTCDate(d.getUTCDate() + n);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // Audience, fees and the brochure (PDF or image): the parts of the event form that the standard fields can't express.
  function eventExtras(v) {
    const audience = v.audience || 'public';
    const feeType = v.fee_type || 'free';
    const pricing = v.member_pricing || 'same';
    const regMode = v.registration_mode || 'online';
    return `
      <div class="field full form-section-title" data-cpd-only><h3>Registration &amp; fees</h3></div>
      <div class="field full" data-cpd-only>
        <span class="field-label" id="reg-label">How people take part</span>
        <div class="seg" role="radiogroup" aria-labelledby="reg-label">
          ${radio('registration_mode', 'online', 'Register on this website', regMode)}
          ${radio('registration_mode', 'external', 'Register on another site', regMode)}
          ${radio('registration_mode', 'none', 'No registration (open meeting)', regMode)}
        </div>
        <p class="hint" data-reg-hint></p>
      </div>
      <div class="field full" data-cpd-only data-reg="external">
        <label for="f-registration_url">Registration link</label>
        <input id="f-registration_url" type="url" name="registration_url" maxlength="500" placeholder="https://forms.gle/…" value="${esc(v.registration_url || '')}">
        <p class="hint">For example a Google Form. The Register button on the event page opens it.</p>
      </div>
      <div class="field full" data-cpd-only data-reg="none">
        <label for="f-join_url">Meeting link <span class="opt">(optional)</span></label>
        <input id="f-join_url" type="url" name="join_url" maxlength="500" placeholder="https://zoom.us/j/…" value="${esc(v.join_url || '')}">
        <p class="hint">Zoom, Teams or Google Meet. The event page shows a "Join the meeting" button until the event ends. You can add it later.</p>
      </div>
      <div class="field full" data-cpd-only data-reg-needed>
        <span class="field-label" id="aud-label">Audience</span>
        <div class="seg" role="radiogroup" aria-labelledby="aud-label">
          ${radio('audience', 'public', 'Open to everyone', audience)}
          ${radio('audience', 'members', 'SLICNA members only', audience)}
        </div>
      </div>
      <div class="field full fee-builder" data-cpd-only data-reg-needed>
        <span class="field-label" id="fee-label">Event fee</span>
        <div class="seg" role="radiogroup" aria-labelledby="fee-label">
          ${radio('fee_type', 'free', 'Free', feeType)}
          ${radio('fee_type', 'paid', 'Paid', feeType)}
        </div>
        <div class="fee-panel" data-fee-paid>
          <div class="fee-group">
            <div class="fee-group-head">
              <b>Members pay</b>
              <div class="seg seg-sm" role="radiogroup" aria-label="Member fees">
                ${radio('member_pricing', 'same', 'One fee for all members', pricing)}
                ${radio('member_pricing', 'by_category', 'Fee by membership category', pricing)}
              </div>
            </div>
            <div data-pricing="same">${moneyInput('member_fee', 'Member fee', v.member_fee)}</div>
            <div data-pricing="by_category" class="fee-cat-grid">
              ${MEMBER_CATEGORIES.map(([c, name]) => moneyInput(FEE_COLUMNS[c], `${name} (${c})`, v[FEE_COLUMNS[c]])).join('')}
            </div>
          </div>
          <div class="fee-group" data-non-member>
            <div class="fee-group-head"><b>Non-members pay</b></div>
            ${moneyInput('non_member_fee', 'Non-member fee', v.non_member_fee)}
          </div>
          <p class="hint">Enter 0 where a group attends free, for example free for members and paid for non-members.</p>
          <p class="fee-preview" data-fee-preview aria-live="polite"></p>
        </div>
        <!-- Foreign participants: online and/or physical, each with a USD fee. -->
        <div class="foreign-fees" data-foreign>
          <label class="consent"><input type="checkbox" data-foreign-toggle${v.foreign_online || v.foreign_physical ? ' checked' : ''}> Open to foreign participants</label>
          <div class="foreign-options" data-foreign-options>
            ${[['online', 'Online'], ['physical', 'Physical']].map(([mode, label]) => `
              <div class="foreign-row">
                <label class="consent"><input type="checkbox" name="foreign_${mode}" value="true"${v[`foreign_${mode}`] ? ' checked' : ''}> ${label}</label>
                <div class="money-input" data-foreign-fee="${mode}"><span>USD</span><input name="foreign_fee_${mode}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="${label} fee for foreign participants (USD)" value="${esc(v[`foreign_fee_${mode}`] ?? '')}"></div>
              </div>`).join('')}
            <p class="hint">Foreign participants register here as a separate option, choose online or physical, and pay in US dollars. They give a passport number instead of an NIC.</p>
          </div>
        </div>
      </div>
      <div class="field full">
        <label for="f-attachment">Programme or brochure (PDF or image) <span class="opt">(optional)</span></label>
        <input id="f-attachment" type="file" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp">
        <p class="hint">A PDF, or a JPEG, PNG or WEBP image, under 15MB. Shown on the event page as a download.${v.attachment_url ? ` Current file: ${esc(v.attachment_name || 'brochure')}. Choosing a new file replaces it.` : ''}</p>
        ${v.attachment_url ? '<label class="consent" style="margin-top:8px"><input type="checkbox" name="remove_attachment" value="true"> Remove the current file</label>' : ''}
      </div>`;
  }

  function mountEventForm(form, values) {
    const val = (name) => form.querySelector(`[name="${name}"]:checked`)?.value ?? form.elements[name]?.value;
    const tsel = (key) => form.querySelector(`[data-t="${key}"]`);

    // Foreign participants: ticking the box starts with both online and physical.
    const foreignToggle = form.querySelector('[data-foreign-toggle]');
    foreignToggle.addEventListener('change', () => {
      if (foreignToggle.checked && !form.elements.foreign_online.checked && !form.elements.foreign_physical.checked) {
        form.elements.foreign_online.checked = true;
        form.elements.foreign_physical.checked = true;
      }
    });

    // Time: the pickers fill the hidden start_time / end_time ("08:00"); in
    // "type it" mode only the text is sent.
    function readTime(which) {
      const h = tsel(`${which}-h`).value;
      if (!h) return '';
      return `${pad((Number(h) % 12) + (tsel(`${which}-p`).value === 'pm' ? 12 : 0))}:${tsel(`${which}-m`).value}`;
    }
    function syncTime() {
      const mode = val('time_mode');
      form.querySelectorAll('[data-time-mode]').forEach((el) => { el.hidden = el.dataset.timeMode !== mode; });
      const start = mode === 'range' ? readTime('start') : '';
      const end = mode === 'range' ? readTime('end') : '';
      form.elements.start_time.value = start;
      form.elements.end_time.value = end;
      form.elements.start_time.disabled = mode !== 'range';
      form.elements.end_time.disabled = mode !== 'range';
      form.elements.time_text.disabled = mode !== 'text';
      form.querySelector('[data-time-preview]').textContent = mode === 'range'
        ? (start ? `Shown as: ${time12(start)}${end ? ' – ' + time12(end) : ''}` : 'No time shown.')
        : 'Shown exactly as typed.';
    }
    // Duration: "Runs 25 Nov – 27 Nov 2026 (3 days)".
    function syncDuration() {
      const start = form.elements.event_date.value;
      const n = Math.max(1, Number(form.elements.duration_number.value) || 1);
      const unit = form.elements.duration_unit.value;
      const end = lastDay(start, n, unit, form.elements.end_date.value);
      const preview = form.querySelector('[data-duration-preview]');
      if (!start) { preview.textContent = ''; return; }
      preview.textContent = end && end > start ? `Runs ${fmtDate(start)} – ${fmtDate(end)}.` : `One day: ${fmtDate(start)}.`;
    }
    const kindSelect = form.elements.category;
    const typeSelect = form.elements.event_type;
    const statusSelect = form.elements.status;
    const cpdOnly = [...form.querySelectorAll('[data-cpd-only]'), form.elements.cpd_points.closest('.field')];

    const fillSelect = (select, list) => {
      const current = select.value;
      select.innerHTML = list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
      if (list.some(([v]) => v === current)) select.value = current;
    };

    function sync() {
      const kind = kindSelect.value;
      fillSelect(typeSelect, options.event_types[kind].map((t) => [t, t]));
      fillSelect(statusSelect, Object.entries(options.statuses[kind]));
      cpdOnly.forEach((el) => { el.hidden = kind !== 'cpd'; });
      // Registration: link field for "another site", meeting link for "no registration";
      // no audience, fees or status when nobody registers.
      const mode = val('registration_mode') || 'online';
      form.querySelectorAll('[data-reg]').forEach((el) => { el.hidden = kind !== 'cpd' || el.dataset.reg !== mode; });
      form.querySelectorAll('[data-reg-needed]').forEach((el) => { el.hidden = kind !== 'cpd' || mode === 'none'; });
      statusSelect.closest('.field').hidden = kind === 'cpd' && mode === 'none';
      form.elements.registration_url.required = kind === 'cpd' && mode === 'external';
      form.querySelector('[data-reg-hint]').textContent = {
        online: 'People register and pay here; you confirm them under Registrations.',
        external: 'The event page sends people to your own form. There are no registrations to review here.',
        none: 'For open sessions such as a Zoom talk: the event page says "No registration needed".',
      }[mode];
      syncTime();
      syncDuration();

      const paid = val('fee_type') === 'paid';
      const pricing = val('member_pricing');
      const membersOnly = val('audience') === 'members';
      form.querySelector('[data-fee-paid]').hidden = !paid;
      form.querySelectorAll('[data-pricing]').forEach((el) => { el.hidden = el.dataset.pricing !== pricing; });
      form.querySelector('[data-non-member]').hidden = membersOnly;
      // Foreign participants: events open to everyone. Unticked boxes send nothing
      // (disabled), and each USD fee shows only for a paid event and a ticked way to attend.
      form.querySelector('[data-foreign]').hidden = membersOnly;
      const foreignOn = foreignToggle.checked && !membersOnly && kind === 'cpd' && mode !== 'none';
      form.querySelector('[data-foreign-options]').hidden = !foreignToggle.checked;
      ['online', 'physical'].forEach((m) => {
        form.elements[`foreign_${m}`].disabled = !foreignOn;
        form.querySelector(`[data-foreign-fee="${m}"]`).hidden = !paid || !form.elements[`foreign_${m}`].checked;
      });
      // Only the amounts that apply are required.
      form.querySelectorAll('.fee-builder input[type="number"]').forEach((input) => {
        input.required = kind === 'cpd' && paid && !input.closest('[hidden]');
      });
      form.querySelector('[data-fee-preview]').textContent = feePreview({
        fee_type: val('fee_type'), member_pricing: pricing, audience: val('audience'),
        ...Object.fromEntries(['member_fee', 'non_member_fee', ...Object.values(FEE_COLUMNS)].map((n) => [n, form.elements[n].value])),
      }) + (foreignOn && paid ? ['online', 'physical'].filter((m) => form.elements[`foreign_${m}`].checked)
        .map((m) => { const n = form.elements[`foreign_fee_${m}`].value; return ` · Foreign (${m}): ${n === '' ? '—' : Number(n) ? money(n, 'USD') : 'Free'}`; }).join('') : '');
    }

    // Switching to "by category" starts every category at the single member fee,
    // so only the ones that differ need changing (and back again when they're all equal).
    form.querySelectorAll('[name="member_pricing"]').forEach((r) => r.addEventListener('change', () => {
      const single = form.elements.member_fee;
      const cats = Object.values(FEE_COLUMNS).map((n) => form.elements[n]);
      if (r.value === 'by_category' && r.checked) {
        cats.forEach((c) => { if (c.value === '') c.value = single.value; });
      } else if (r.value === 'same' && r.checked && single.value === '') {
        const values = new Set(cats.map((c) => c.value));
        if (values.size === 1) single.value = [...values][0];
      }
    }));

    // The type and status lists follow the kind; keep the saved values when editing.
    sync();
    if (values.event_type) typeSelect.value = values.event_type;
    if (values.status) statusSelect.value = values.status;
    form.addEventListener('change', sync);
    form.addEventListener('input', (e) => { if (e.target.type === 'number' || e.target.type === 'date') sync(); });
  }

  function validateEventForm(form) {
    const f = form.elements;
    if (f.end_date.value && f.end_date.value < f.event_date.value) return 'The end date cannot be before the start date.';
    if (!f.start_time.disabled && f.end_time.value && !f.start_time.value) return 'Please choose a start time as well.';
    if (!f.start_time.disabled && f.end_time.value && f.end_time.value <= f.start_time.value) return 'The end time must be after the start time.';
    const foreignToggle = form.querySelector('[data-foreign-toggle]');
    if (f.category.value === 'cpd' && foreignToggle.checked && !f.foreign_online.disabled && !f.foreign_online.checked && !f.foreign_physical.checked) {
      return 'Foreign participants: tick Online, Physical or both (or untick "Open to foreign participants").';
    }
    if (f.category.value !== 'cpd' || form.querySelector('[name="fee_type"]:checked')?.value !== 'paid') return null;
    const amounts = [...form.querySelectorAll('.fee-builder input[type="number"]')].filter((i) => !i.closest('[hidden]'));
    if (amounts.some((i) => Number(i.value) < 0)) return 'Fees cannot be negative.';
    if (amounts.every((i) => Number(i.value) === 0)) return 'Every fee is 0. Choose "Free" instead.';
    return null;
  }

  async function renderEvents(main) {
    await loadOptions();
    const tabs = document.createElement('div');
    tabs.className = 'admin-filters';
    main.appendChild(tabs);
    let kind = 'cpd';
    let all = [];

    const fields = () => [
      { name: 'title', label: 'Title', required: true, max: 300 },
      { name: 'category', label: 'Event kind', type: 'select', required: true, half: true, options: Object.entries(options.kinds) },
      { name: 'event_type', label: 'Type', type: 'select', required: true, half: true, options: [] },
      { name: 'status', label: 'Status', type: 'select', required: true, half: true, options: [], hint: 'Past events show as "Completed" automatically.' },
      { name: 'cpd_points', label: 'CPD points', type: 'number', step: '0.25', min: 0, half: true, hint: 'Leave empty if not yet awarded.' },
      { name: 'event_date', label: 'Start date', type: 'date', required: true, half: true },
      { name: 'location', label: 'Venue', max: 300, half: true, hint: 'Or "Online (Zoom)".' },
      { name: 'time_block', type: 'html', html: timeBlock },
      { name: 'duration_block', type: 'html', html: durationBlock },
      { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, max: 1000, hint: 'One or two sentences for the event lists.' },
      // Formatted like news articles (headings, lists, links), without pictures.
      { name: 'body', label: 'Details', type: 'richtext', images: false, hint: 'Shown on the event page: programme, speakers, what to bring. Use the toolbar for headings, bold, lists and links.' },
    ];

    // As on SLNA: Event (with its type), Date / Location, CPD points, Audience,
    // Fee, and Status / Registrations together. CPD-only columns are left out
    // on the Other Events tab.
    const eventColumns = [
      { label: 'Event', main: true, html: (r) => `${esc(r.title)}<div class="admin-muted">${esc(r.event_type)}</div>` },
      { label: 'Date / Location', html: (r) => `<span class="date-cell">${esc(dateRange(r))}</span>${r.location ? `<div class="admin-muted location-cell">${esc(r.location)}</div>` : ''}` },
      { label: 'CPD', cpdOnly: true, html: (r) => (r.category === 'cpd' && r.cpd_points != null ? `${esc(Number(r.cpd_points))}<span class="admin-muted"> pts</span>` : '<span class="admin-muted">—</span>') },
      { label: 'Audience', cpdOnly: true, html: (r) => (r.category === 'cpd' ? esc(AUDIENCE_SHORT[r.audience] || r.audience) : '<span class="admin-muted">—</span>') },
      { label: 'Fee', cpdOnly: true, html: (r) => (r.category === 'cpd' ? `<span class="admin-muted fee-text" title="${esc(feeTitle(r))}">${esc(feeText(r))}</span>${(r.foreign || []).length ? `<div class="admin-muted" title="${esc(feeTitle(r))}">+ foreign</div>` : ''}` : '<span class="admin-muted">—</span>') },
      { label: 'Status / Registrations', html: (r) => `<div class="status-reg">${shortChip(r)}${regMode(r) === 'online'
        ? `<div class="admin-muted">${r.registrations_total} registration${r.registrations_total === 1 ? '' : 's'}</div>`
        : regMode(r) === 'external' ? '<div class="admin-muted">Registers elsewhere</div>' : ''}</div>` },
    ];

    const panel = resourcePanel(main, {
      title: 'Events', intro: 'People can register online for CPD events while their status is "Registration Open".',
      endpoint: `${BASE}/events`, singular: 'event',
      async load() {
        all = await api('GET', `${BASE}/events`);
        const count = (k) => all.filter((e) => k === 'all' || e.category === k).length;
        tabs.innerHTML = [['cpd', 'CPD Events'], ['other', 'Other Events'], ['all', 'All']]
          .map(([k, label]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === kind}">${label} (${count(k)})</button>`).join('');
        return all.filter((e) => kind === 'all' || e.category === kind);
      },
      // Other events (AGMs, community events) take no registrations: no fee/registration columns or summary, as on SLNA.
      summary(rows) {
        if (kind === 'other') return '';
        const year = String(new Date().getFullYear());
        const cpd = all.filter((r) => r.category === 'cpd' && r.cpd_points != null && r.event_date.startsWith(year));
        const total = cpd.reduce((s, r) => s + Number(r.cpd_points), 0);
        const open = all.filter((r) => regMode(r) === 'online' && r.status === 'open' && !r.is_past).length;
        const pending = all.reduce((s, r) => s + r.registrations_pending, 0);
        return `<span>${year}: <b>${cpd.length}</b> CPD events, <b>${Number(total.toFixed(2))}</b> CPD points</span><span><b>${open}</b> open for registration</span><span><b>${pending}</b> registrations to review</span>`;
      },
      get columns() { return kind === 'other' ? eventColumns.filter((c) => !c.cpdOnly) : eventColumns; },
      image: { column: 'photo_url', field: 'photo', label: 'Poster or photo' },
      defaults: () => ({ category: kind === 'other' ? 'other' : 'cpd', audience: 'public', fee_type: 'free', member_pricing: 'same', duration_number: 1, duration_unit: 'day' }),
      get fields() { return fields(); },
      form: { extra: eventExtras, onMount: mountEventForm, validate: validateEventForm, wide: true },
      confirmAdd: 'It will appear on the public website straight away. If the status is "Registration Open", people can register.',
      deleteNote: 'Events that already have registrations cannot be deleted',
      // One-click registration switch for upcoming CPD events: Opening Soon -> Open -> Closed.
      belowActions: [{
        show: (r) => regMode(r) === 'online' && !r.is_past && (r.status === 'opening_soon' || r.status === 'open'),
        label: (r) => (r.status === 'open' ? 'Close Registration' : 'Open Registration'),
        cls: (r) => (r.status === 'open' ? 'btn-soft-danger' : 'btn-teal'),
        onClick: (r, reload) => switchRegistration(r, reload),
      }],
    });

    async function switchRegistration(r, reload) {
      const opening = r.status !== 'open';
      const ok = await confirmDialog({
        title: opening ? 'Open registration?' : 'Close registration?',
        message: opening
          ? `"${r.title}" will show "Registration Open" on the website and people can register straight away.`
          : `"${r.title}" will show "Registration Closed" and the registration form will stop taking new registrations. Existing registrations are kept.`,
        confirmText: opening ? 'Open Registration' : 'Close Registration',
      });
      if (!ok) return;
      try {
        const fd = new FormData();
        fd.append('status', opening ? 'open' : 'closed');
        await api('PATCH', `${BASE}/events/${r.id}/status`, fd);
        toast(opening ? 'Registration is open.' : 'Registration is closed.');
        reload();
      } catch (err) {
        toast(err.message, true);
      }
    }

    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      kind = b.dataset.kind;
      panel.reload();
    });
  }

  // =====================================================================
  // Registrations
  // =====================================================================

  // CPD events with their registration counts; "Registrations" opens the event's registrations.
  async function renderRegistrations(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);
    // One slim row: Upcoming / Past / All on the left, Refresh on the right
    // (the page heading above already explains the section).
    card.innerHTML = `
      <div class="admin-toolbar"><div class="admin-filters" data-when></div>
        <button type="button" class="btn btn-sky btn-sm" data-refresh>Refresh</button></div>
      <div data-list></div>`;
    const listEl = card.querySelector('[data-list]');
    const whenEl = card.querySelector('[data-when]');
    let events = [];
    let when = 'upcoming';

    function render() {
      const groups = { upcoming: events.filter((e) => !e.is_past), past: events.filter((e) => e.is_past), all: events };
      whenEl.innerHTML = [['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']]
        .map(([k, label]) => `<button type="button" class="chip" data-when-chip="${k}" aria-pressed="${k === when}">${label} (${groups[k].length})</button>`).join('');
      // Upcoming: soonest first. Past and All: newest first.
      const rows = when === 'upcoming' ? [...groups.upcoming].reverse() : groups[when];
      listEl.innerHTML = rows.length ? `
        <div class="admin-table-wrap"><table class="admin-table">
          <thead><tr><th>Date</th><th>Event</th><th>CPD</th><th>Status</th><th>Fee</th><th>Registrations</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${rows.map((e) => `
            <tr data-id="${e.id}" class="is-clickable" tabindex="0">
              <td><span class="date-cell">${esc(dateRange(e))}</span></td>
              <td class="main-col">${esc(e.title)}<div class="admin-muted">${esc(e.event_type)}</div></td>
              <td>${e.cpd_points != null ? `${esc(Number(e.cpd_points))}<span class="admin-muted"> pts</span>` : '<span class="admin-muted">—</span>'}</td>
              <td><div class="status-reg">${shortChip(e)}</div></td>
              <td><span class="admin-muted fee-text" title="${esc(feeTitle(e))}">${esc(feeText(e))}</span></td>
              <td>${regCounts(e)}</td>
              <td><div class="row-actions"><button type="button" class="btn ${e.registrations_pending ? 'btn-teal' : 'btn-light'} btn-xs" data-open>${e.registrations_pending ? `Review ${e.registrations_pending}` : 'Open'}</button></div></td>
            </tr>`).join('')}</tbody>
        </table></div>` : '<p class="admin-empty">No CPD events here.</p>';
    }

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        // Only events people register for on this website.
        events = (await api('GET', `${BASE}/events`)).filter((e) => regMode(e) === 'online');
        render();
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }

    whenEl.addEventListener('click', (e) => {
      const c = e.target.closest('[data-when-chip]');
      if (!c) return;
      when = c.dataset.whenChip;
      render();
    });
    card.querySelector('[data-refresh]').onclick = load;
    const openRow = (tr) => registrationsWindow(events.find((x) => String(x.id) === tr.dataset.id), () => { load(); A.refreshBadges(); });
    listEl.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openRow(tr); });
    listEl.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') openRow(tr); });
    load();
  }

  const regCounts = (e) => (e.registrations_total
    ? `<b>${e.registrations_total}</b> · ${e.registrations_confirmed} confirmed${e.registrations_pending || e.registrations_rejected ? `<div class="admin-muted">${[e.registrations_pending && `<b>${e.registrations_pending}</b> to review`, e.registrations_rejected && `${e.registrations_rejected} rejected`].filter(Boolean).join(' · ')}</div>` : ''}`
    : '<span class="admin-muted">None yet</span>');

  // One event's registrations: event details, status tabs with counts, search,
  // downloads, and the list. A row opens the registration to confirm or reject.
  function registrationsWindow(event, onChanged) {
    const view = infoDialog({ title: `Registrations · ${event.title}` });
    view.dialog.classList.add('admin-dialog-xwide');
    // Essentials only, in two short lines under the title (as in SLNA).
    const facts = [dateRange(event), event.location, event.cpd_points != null ? `${Number(event.cpd_points)} CPD points` : null, event.audience === 'members' ? 'Members only' : null]
      .filter(Boolean).map(esc).join(' · ');
    const fees = event.fees.length
      ? event.fees.map((f) => `${esc(f.label.replace(/ members$/, ''))}: <b>${f.amount ? esc(money(f.amount)) : 'Free'}</b>`).join(' · ')
      : '<b>Free</b>';
    const foreign = (event.foreign || []).length ? ` · Foreign: <b>${esc(foreignText(event))}</b>` : '';
    view.body.innerHTML = `
      <div class="reg-event-summary">
        <p>${facts} ${eventChip(event)}</p>
        <p>Event fee: ${fees}${foreign}</p>
      </div>
      <div data-filters></div>
      <div data-list></div>`;
    const listEl = view.body.querySelector('[data-list]');
    const filters = filterBar(view.body.querySelector('[data-filters]'), {
      chipKey: 'status',
      chips: [['all', 'All'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected']],
      onChange: load,
      actions: `<span class="filter-actions">
        <button type="button" class="btn btn-sky btn-sm" data-act="refresh">Refresh</button>
        <button type="button" class="btn btn-excel btn-sm" data-act="xlsx">Download Excel</button>
        <button type="button" class="btn btn-pdf btn-sm" data-act="pdf">Download PDF</button></span>`,
    });
    view.body.querySelector('[data-search]').placeholder = 'Search name, NIC / passport, email, membership number…';

    async function updateCounts() {
      try {
        const counts = await api('GET', `${BASE}/registrations/counts${query({ event_id: event.id, q: filters.q })}`);
        view.body.querySelectorAll('[data-chip]').forEach((c) => { c.textContent = `${c.dataset.label} (${counts[c.dataset.chip] || 0})`; });
      } catch (err) { /* keep the plain labels */ }
    }

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        const rows = await api('GET', `${BASE}/registrations${query({ status: filters.status, event_id: event.id, q: filters.q })}`);
        updateCounts();
        listEl.innerHTML = rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Registrant</th><th>NIC / Passport · Email</th><th>Registered as</th><th>Fee</th><th>Paid by</th><th>Slip</th><th>Status</th></tr></thead>
            <tbody>${rows.map((r) => `
              <tr class="is-clickable" data-id="${r.id}" tabindex="0">
                <td class="main-col">${esc(r.full_name)}<div class="admin-muted">${esc(r.reference_number)} · ${esc(fmtDate(r.created_at))}</div></td>
                <td>${esc(r.nic_number)}<div class="admin-muted">${esc(r.email)}</div></td>
                <td>${r.membership_number ? `${esc(r.membership_number)}<div class="admin-muted">${esc(REGISTERED_AS[r.fee_category])}${r.member_id ? '' : ' · not in register'}</div>` : r.registrant_type === 'foreign' ? `${esc(REGISTERED_AS[r.fee_category])}${r.country ? `<div class="admin-muted">${esc(r.country)}</div>` : ''}` : 'Non-member'}</td>
                <td>${Number(r.amount_due) ? esc(money(r.amount_due, r.currency)) : 'Free'}</td>
                <td>${r.pay_by ? (r.pay_by === 'organisation' ? 'Organisation' : 'Individual') : '—'}</td>
                <td>${r.has_receipt ? 'Yes' : '—'}</td>
                <td>${chip(REG_CHIP[r.status], REG_STATUS[r.status])}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="admin-empty">No registrations here.</p>';
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }

    const changed = () => { load(); onChanged(); };
    view.body.querySelector('[data-filters]').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'refresh') load();
      // Both downloads hold the registrations of the selected tab.
      else if (act === 'xlsx' || act === 'pdf') A.downloadPrivateFile(`${BASE}/events/${event.id}/registrations.${act}${query({ status: filters.status })}`);
    });
    listEl.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) reviewRegistration(Number(tr.dataset.id), changed);
    });
    listEl.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter') reviewRegistration(Number(tr.dataset.id), changed);
    });
    load();
  }

  async function reviewRegistration(id, onChanged) {
    let cleanup = () => {};
    const view = infoDialog({ title: 'Registration', onClose: () => cleanup() });
    view.body.innerHTML = '<p class="admin-muted">Loading…</p>';
    let r;
    try {
      r = await api('GET', `${BASE}/registrations/${id}`);
    } catch (err) {
      view.body.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      return;
    }
    view.dialog.querySelector('.dialog-head h2').textContent = `${r.reference_number} · ${r.full_name}`;
    const paid = Number(r.amount_due) > 0;

    view.body.innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="detail-section"><h3>Event</h3>${dl([['Event', r.event_title], ['Date', fmtDate(r.event_date)]])}</div>
          <div class="detail-section"><h3>Registrant</h3>${dl([
            ['Full name', r.full_name], ['Name on certificate', r.certificate_name], [r.registrant_type === 'foreign' ? 'Passport number' : 'NIC', r.nic_number], ['Country', r.country],
            ['SLNC registration', r.slnc_number], ['Email', r.email], ['Mobile', r.mobile], ['Postal address', r.postal_address],
            ['Workplace', r.workplace], ['Workplace address', r.workplace_address],
          ])}</div>
          <div class="detail-section"><h3>Registered as</h3>${dl([
            ['Type', REGISTERED_AS[r.fee_category]],
            ['Membership number', r.membership_number ? (r.member_id
              ? `${r.membership_number} (found in the member register)`
              : html(`${esc(r.membership_number)} <span class="status-chip status-pending">Not in the member register</span><div class="admin-muted">The fee was set from the number's prefix. Check the membership before confirming.</div>`)) : ''],
          ])}</div>
          <div class="detail-section"><h3>Payment</h3>${dl([
            ['Fee', paid ? money(r.amount_due, r.currency) : 'Free'],
            ['Paid by', paid ? (r.pay_by === 'organisation' ? 'Organisation' : 'Individual') : ''],
            ['Payment date', fmtDate(r.payment_date)],
          ])}</div>
        </div>
        <div>
          <div class="detail-section"><h3>Status</h3>
            <p>${chip(REG_CHIP[r.status], REG_STATUS[r.status])}</p>
            ${dl([
              ['Received', fmtDateTime(r.created_at)],
              ['Last reviewed', r.reviewed_at ? `${fmtDateTime(r.reviewed_at)}${r.reviewed_by_name ? ' by ' + r.reviewed_by_name : ''}` : ''],
              ['Message to registrant', r.status_note], ['Internal notes', r.admin_notes],
            ])}
          </div>
          ${paid ? '<div class="detail-section"><h3>Payment slip</h3><div data-docs></div></div>' : ''}
          <div class="action-bar">
            ${r.status !== 'confirmed' && r.status !== 'rejected' ? '<button type="button" class="btn btn-teal btn-sm" data-act="confirm">Confirm</button>' : ''}
            ${r.status !== 'rejected' ? '<button type="button" class="btn btn-light btn-sm" data-act="reject">Reject</button>' : ''}
            ${r.status !== 'pending' ? '<button type="button" class="btn btn-light btn-sm" data-act="pending">Move back to Pending</button>' : ''}
            <button type="button" class="btn btn-danger btn-sm" data-act="delete">Delete</button>
          </div>
        </div>
      </div>`;

    if (paid) {
      docTiles(view.body.querySelector('[data-docs]'), r.receipt_key ? [{ label: 'Payment slip', path: `${BASE}/registrations/${r.id}/receipt` }] : [])
        .then((c) => { cleanup = c; });
    }

    const done = (message) => {
      toast(message);
      view.close();
      onChanged();
      A.refreshBadges();
    };
    const patch = (fd) => api('PATCH', `${BASE}/registrations/${r.id}/status`, fd);
    const who = `${r.full_name} (${r.reference_number})`;

    view.body.querySelector('.action-bar').addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'confirm') {
        if (!(await confirmDialog({
          title: 'Confirm registration?',
          message: `${who} will be emailed that their place for "${r.event_title}" is confirmed.${paid ? `\n\nOnly confirm after checking the payment slip (${money(r.amount_due, r.currency)}).` : ''}`,
          confirmText: 'Confirm',
        }))) return;
        try {
          const fd = new FormData();
          fd.append('status', 'confirmed');
          await patch(fd);
          done('Registration confirmed.');
        } catch (err) { toast(err.message, true); }
      } else if (act === 'reject') {
        const ok = await openForm({
          title: 'Reject registration',
          fields: [
            { name: 'status_note', label: 'Reason (sent to the registrant)', type: 'textarea', required: true, rows: 4 },
            { name: 'admin_notes', label: 'Internal notes', type: 'textarea', rows: 2 },
          ],
          values: { admin_notes: r.admin_notes },
          hidden: { status: 'rejected' },
          saveLabel: 'Reject registration',
          confirmTitle: 'Reject this registration?',
          confirmMessage: `${who} will be emailed that the registration was not accepted, with your reason. They can then register again.`,
          submit: patch,
        });
        if (ok) done('Registration rejected.');
      } else if (act === 'pending') {
        if (!(await confirmDialog({ title: 'Move back to Pending?', message: `${who} goes back to the Pending list so it can be reviewed again. No email is sent.`, confirmText: 'Move to Pending' }))) return;
        try {
          const fd = new FormData();
          fd.append('status', 'pending');
          await patch(fd);
          done('Moved back to Pending.');
        } catch (err) { toast(err.message, true); }
      } else if (act === 'delete') {
        if (!(await confirmDialog({ title: 'Delete registration?', message: `${who} and its payment slip will be permanently deleted. No email is sent.\n\nThis cannot be undone.`, confirmText: 'Delete', danger: true }))) return;
        try {
          await api('DELETE', `${BASE}/registrations/${r.id}`);
          done('Registration deleted.');
        } catch (err) { toast(err.message, true); }
      }
    });
  }

  A.registerSection('events', { group: 'events', label: 'Events', sub: 'CPD and other events', render: renderEvents });
  A.registerSection('registrations', {
    group: 'events', label: 'Registrations', sub: 'CPD sign-ups to review', render: renderRegistrations,
    intro: 'Registrations for each CPD event. Confirming or rejecting emails the registrant.',
  });
})();
