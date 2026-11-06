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
  const REGISTERED_AS = { LT: 'Lifetime member', GM: 'General member', OM: 'Ordinary member', PM: 'Partial member', NM: 'Non-member' };
  const REG_STATUS = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected' };
  const REG_CHIP = { pending: 'pending', confirmed: 'approved', rejected: 'rejected' };

  const money = (n) => 'LKR ' + Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const chip = (cls, label) => `<span class="status-chip status-${esc(cls)}">${esc(label)}</span>`;
  const dl = (rows) => `<dl class="detail-list">${rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${typeof v === 'object' ? v.html : esc(v)}</dd>`).join('')}</dl>`;
  const dateRange = (e) => fmtDate(e.event_date) + (e.end_date ? ' – ' + fmtDate(e.end_date) : '');

  // Event status -> chip colour.
  const eventChip = (e) => chip(e.is_past ? 'rejected' : e.status === 'open' ? 'approved' : e.status === 'closed' ? 'rejected' : 'pending', e.status_label);
  // Compact fee for the table ("Free", "LKR 500", "Free – LKR 1,500"); the full list is in the tooltip.
  const feeText = (e) => {
    const amounts = e.fees.map((f) => Number(f.amount));
    if (!amounts.length || amounts.every((n) => !n)) return 'Free';
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return min === max ? money(min) : `${min ? money(min) : 'Free'} – ${money(max)}`;
  };
  const feeTitle = (e) => e.fees.map((f) => `${f.label}: ${f.amount ? money(f.amount) : 'Free'}`).join('\n');

  let options = null;
  const loadOptions = async () => (options = options || await api('GET', `${BASE}/options`));

  // Set by "Registrations" on an event row, read when the Registrations section opens.
  let preselectEventId = '';
  function openRegistrations(eventId) {
    preselectEventId = String(eventId);
    document.querySelector('#admin-nav button[data-key="registrations"]').click();
  }

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

  // Audience, fees and the PDF attachment: the parts of the event form that the standard fields can't express.
  function eventExtras(v) {
    const audience = v.audience || 'public';
    const feeType = v.fee_type || 'free';
    const pricing = v.member_pricing || 'same';
    return `
      <div class="field full form-section-title" data-cpd-only><h3>Who can register &amp; fees</h3></div>
      <div class="field full" data-cpd-only>
        <span class="field-label" id="aud-label">Audience</span>
        <div class="seg" role="radiogroup" aria-labelledby="aud-label">
          ${radio('audience', 'public', 'Open to everyone', audience)}
          ${radio('audience', 'members', 'SLICNA members only', audience)}
        </div>
      </div>
      <div class="field full fee-builder" data-cpd-only>
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
      </div>
      <div class="field full">
        <label for="f-attachment">Programme or brochure (PDF) <span class="opt">(optional)</span></label>
        <input id="f-attachment" type="file" name="attachment" accept="application/pdf">
        <p class="hint">Shown on the event page as a download.${v.attachment_url ? ` Current file: ${esc(v.attachment_name || 'PDF')}. Choosing a new file replaces it.` : ''}</p>
        ${v.attachment_url ? '<label class="consent" style="margin-top:8px"><input type="checkbox" name="remove_attachment" value="true"> Remove the current PDF</label>' : ''}
      </div>`;
  }

  function mountEventForm(form, values) {
    const val = (name) => form.querySelector(`[name="${name}"]:checked`)?.value ?? form.elements[name]?.value;
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

      const paid = val('fee_type') === 'paid';
      const pricing = val('member_pricing');
      const membersOnly = val('audience') === 'members';
      form.querySelector('[data-fee-paid]').hidden = !paid;
      form.querySelectorAll('[data-pricing]').forEach((el) => { el.hidden = el.dataset.pricing !== pricing; });
      form.querySelector('[data-non-member]').hidden = membersOnly;
      // Only the amounts that apply are required.
      form.querySelectorAll('.fee-builder input[type="number"]').forEach((input) => {
        input.required = kind === 'cpd' && paid && !input.closest('[hidden]');
      });
      form.querySelector('[data-fee-preview]').textContent = feePreview({
        fee_type: val('fee_type'), member_pricing: pricing, audience: val('audience'),
        ...Object.fromEntries(['member_fee', 'non_member_fee', ...Object.values(FEE_COLUMNS)].map((n) => [n, form.elements[n].value])),
      });
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
    form.addEventListener('input', (e) => { if (e.target.type === 'number') sync(); });
  }

  function validateEventForm(form) {
    const f = form.elements;
    if (f.end_date.value && f.end_date.value < f.event_date.value) return 'The end date cannot be before the start date.';
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
      { name: 'event_date', label: 'Date', type: 'date', required: true, half: true },
      { name: 'end_date', label: 'End date', type: 'date', half: true, hint: 'Only for events over several days.' },
      { name: 'time_text', label: 'Time', max: 100, half: true, hint: 'For example: 8.00 a.m. – 4.00 p.m.' },
      { name: 'location', label: 'Venue', max: 300, half: true },
      { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, max: 1000, hint: 'One or two sentences for the event lists.' },
      { name: 'body', label: 'Details', type: 'textarea', rows: 6, max: 20000, hint: 'Shown on the event page: programme, speakers, what to bring. Leave a blank line between paragraphs.' },
    ];

    const panel = resourcePanel(main, {
      title: 'Events', intro: 'CPD events take online registrations when their status is "Registration Open". Other events (AGMs, community events) are for information.',
      endpoint: `${BASE}/events`, singular: 'event',
      async load() {
        all = await api('GET', `${BASE}/events`);
        const count = (k) => all.filter((e) => k === 'all' || e.category === k).length;
        tabs.innerHTML = [['cpd', 'CPD Events'], ['other', 'Other Events'], ['all', 'All']]
          .map(([k, label]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === kind}">${label} (${count(k)})</button>`).join('');
        return all.filter((e) => kind === 'all' || e.category === kind);
      },
      summary(rows) {
        const year = String(new Date().getFullYear());
        const cpd = all.filter((r) => r.category === 'cpd' && r.cpd_points != null && r.event_date.startsWith(year));
        const total = cpd.reduce((s, r) => s + Number(r.cpd_points), 0);
        const open = all.filter((r) => r.category === 'cpd' && r.status === 'open' && !r.is_past).length;
        const pending = all.reduce((s, r) => s + r.registrations_pending, 0);
        return `<span>${year}: <b>${cpd.length}</b> CPD events, <b>${Number(total.toFixed(2))}</b> CPD points</span><span><b>${open}</b> open for registration</span><span><b>${pending}</b> registrations to review</span>`;
      },
      columns: [
        { label: 'Date', html: (r) => esc(dateRange(r)) },
        { label: 'Event', main: true, html: (r) => `${esc(r.title)}<div class="admin-muted">${esc(r.event_type)}${r.location ? ' · ' + esc(r.location) : ''}${r.cpd_points != null ? ` · ${Number(r.cpd_points)} CPD pts` : ''}</div>` },
        { label: 'Status', html: (r) => eventChip(r) },
        { label: 'Fee', html: (r) => (r.category === 'cpd' ? `<span class="admin-muted" title="${esc(feeTitle(r))}">${esc(feeText(r))}</span>` : '—') },
        { label: 'Registrations', html: (r) => (r.category !== 'cpd' ? '—' : r.registrations_total
          ? `<b>${r.registrations_confirmed}</b> confirmed${r.registrations_pending ? `<div class="admin-muted"><b>${r.registrations_pending}</b> to review</div>` : ''}`
          : '<span class="admin-muted">None</span>') },
      ],
      rowActions: [{ label: 'Registrations', onClick: (r) => (r.category === 'cpd' ? openRegistrations(r.id) : toast('Only CPD events take registrations.', true)) }],
      image: { column: 'photo_url', field: 'photo', label: 'Poster or photo' },
      defaults: () => ({ category: kind === 'other' ? 'other' : 'cpd', audience: 'public', fee_type: 'free', member_pricing: 'same' }),
      get fields() { return fields(); },
      form: { extra: eventExtras, onMount: mountEventForm, validate: validateEventForm, wide: true },
      confirmAdd: 'It will appear on the public website straight away. If the status is "Registration Open", people can register.',
      deleteNote: 'Events that already have registrations cannot be deleted',
    });

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

  async function renderRegistrations(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);
    card.innerHTML = `
      <div class="admin-card-head"><div><h2>Event registrations</h2><p>Check each registration and payment slip, then confirm or reject it. The registrant is emailed either way.</p></div>
        <div class="export-actions" data-exports hidden>
          <button type="button" class="btn btn-light btn-sm" data-export="xlsx">Download Excel</button>
          <button type="button" class="btn btn-light btn-sm" data-export="pdf">Attendance sheet (PDF)</button>
        </div></div>
      <div data-filters></div><div data-list></div>`;
    const listEl = card.querySelector('[data-list]');
    const exportsEl = card.querySelector('[data-exports]');

    let events = [];
    try { events = (await api('GET', `${BASE}/events`)).filter((e) => e.category === 'cpd'); } catch (err) { /* list still works */ }
    const eventOptions = events.map((e) => [String(e.id), `${fmtDate(e.event_date)} · ${e.title}${e.registrations_pending ? ` (${e.registrations_pending} to review)` : ''}`]);

    const filters = filterBar(card.querySelector('[data-filters]'), {
      chipKey: 'status',
      chips: [['pending', 'Pending'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected'], ['all', 'All']],
      selects: [{ key: 'event_id', label: 'Event', options: eventOptions }],
      onChange: load,
    });
    if (preselectEventId) {
      card.querySelector('[data-select="event_id"]').value = preselectEventId;
      filters.event_id = preselectEventId;
      preselectEventId = '';
    }

    async function updateCounts() {
      try {
        const counts = await api('GET', `${BASE}/registrations/counts${query({ event_id: filters.event_id, q: filters.q })}`);
        card.querySelectorAll('[data-chip]').forEach((c) => { c.textContent = `${c.dataset.label} (${counts[c.dataset.chip] || 0})`; });
      } catch (err) { /* keep the plain labels */ }
    }

    async function load() {
      exportsEl.hidden = !filters.event_id;
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        const rows = await api('GET', `${BASE}/registrations${query({ status: filters.status, event_id: filters.event_id, q: filters.q })}`);
        updateCounts();
        const showEvent = !filters.event_id;
        listEl.innerHTML = rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Received</th><th>Registrant</th>${showEvent ? '<th>Event</th>' : ''}<th>Registered as</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody>${rows.map((r) => `
              <tr class="is-clickable" data-id="${r.id}" tabindex="0">
                <td>${esc(fmtDate(r.created_at))}<div class="admin-muted">${esc(r.reference_number)}</div></td>
                <td class="main-col">${esc(r.full_name)}<div class="admin-muted">${esc(r.nic_number)} · ${esc(r.workplace)}</div></td>
                ${showEvent ? `<td>${esc(r.event_title)}<div class="admin-muted">${esc(fmtDate(r.event_date))}</div></td>` : ''}
                <td>${r.membership_number ? `${esc(r.membership_number)}<div class="admin-muted">${esc(REGISTERED_AS[r.fee_category])}</div>` : 'Non-member'}</td>
                <td>${Number(r.amount_due) ? esc(money(r.amount_due)) : 'Free'}</td>
                <td>${chip(REG_CHIP[r.status], REG_STATUS[r.status])}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="admin-empty">No registrations here.</p>';
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }

    exportsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-export]');
      if (b) A.downloadPrivateFile(`${BASE}/events/${filters.event_id}/registrations.${b.dataset.export}`);
    });
    listEl.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) reviewRegistration(Number(tr.dataset.id), load);
    });
    listEl.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter') reviewRegistration(Number(tr.dataset.id), load);
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
            ['Full name', r.full_name], ['Name on certificate', r.certificate_name], ['NIC', r.nic_number],
            ['SLNC registration', r.slnc_number], ['Email', r.email], ['Mobile', r.mobile], ['Postal address', r.postal_address],
            ['Workplace', r.workplace], ['Workplace address', r.workplace_address],
          ])}</div>
          <div class="detail-section"><h3>Registered as</h3>${dl([
            ['Type', REGISTERED_AS[r.fee_category]],
            ['Membership number', r.membership_number ? `${r.membership_number} (checked against the member register)` : ''],
          ])}</div>
          <div class="detail-section"><h3>Payment</h3>${dl([
            ['Fee', paid ? money(r.amount_due) : 'Free'],
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
            ${r.status !== 'confirmed' && r.status !== 'rejected' ? '<button type="button" class="btn btn-teal btn-sm" data-act="confirm">Confirm…</button>' : ''}
            ${r.status !== 'rejected' ? '<button type="button" class="btn btn-light btn-sm" data-act="reject">Reject…</button>' : ''}
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
        const ok = await openForm({
          title: 'Confirm registration',
          fields: [
            { name: 'status_note', label: 'Message to the registrant', type: 'textarea', rows: 3, hint: 'Optional, included in the confirmation email (for example the reporting time).' },
            { name: 'admin_notes', label: 'Internal notes', type: 'textarea', rows: 2, hint: 'Only visible to admins.' },
          ],
          values: { admin_notes: r.admin_notes },
          hidden: { status: 'confirmed' },
          saveLabel: 'Confirm registration',
          confirmTitle: 'Confirm this registration?',
          confirmMessage: `${who} will be emailed that their place for "${r.event_title}" is confirmed.${paid ? `\n\nOnly confirm after checking the payment slip (${money(r.amount_due)}).` : ''}`,
          submit: patch,
        });
        if (ok) done('Registration confirmed.');
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
    intro: 'Registrations for CPD events. Confirming or rejecting emails the registrant.',
  });
})();
