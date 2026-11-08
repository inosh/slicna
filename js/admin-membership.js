// Admin: membership applications, member directory, renewals and settings.
// Uses the shared helpers from admin.js (window.SLICNA_ADMIN). Every action
// that changes something asks for confirmation first.
(() => {
  const A = window.SLICNA_ADMIN;
  if (!A) return;
  const { api, esc, fmtDate, today, toast, confirmDialog, openForm, infoDialog, docTiles, filterBar, query } = A;

  const BASE = '/membership/admin';
  const CATEGORIES = { LT: 'Lifetime', GM: 'General', OM: 'Ordinary', PM: 'Partial' };
  // Upgrades open to each category (same as the backend's M.UPGRADES).
  const UPGRADES = { GM: ['LT'], OM: ['GM', 'LT'], PM: ['OM', 'GM', 'LT'] };
  // "Renewal" or "Upgrade to GM" for a renewal request.
  const requestType = (r) => (r.kind === 'upgrade' ? `Upgrade to ${r.to_category}` : 'Renewal');
  const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([k, v]) => [k, `${v} (${k})`]);
  const APP_STATUS = { pending: 'Pending', more_info_required: 'More info needed', approved: 'Approved', rejected: 'Rejected' };
  const MEMBER_STATE = { active: 'Active', renewal_due: 'Renewal due', grace: 'Grace period', lapsed: 'Lapsed', deactivated: 'Deactivated' };
  const REMINDER_KINDS = { notice_30: 'First reminder', notice_7: '7-day reminder', expired: 'Expired (grace started)', grace_ending: 'Grace ending', lapsed: 'Lapsed notice' };

  const money = (n) => 'LKR ' + Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  // "YYYY-MM-DD" one year later (29 Feb -> 28 Feb), matching the backend.
  const addYear = (d) => {
    const [y, m, day] = String(d).split('-').map(Number);
    const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
    return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
  };
  const chip = (status, label) => `<span class="status-chip status-${esc(status)}">${esc(label)}</span>`;
  const dl = (rows) => `<dl class="detail-list">${rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${typeof v === 'object' ? v.html : esc(v)}</dd>`).join('')}</dl>`;
  const html = (s) => ({ html: s });
  const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  // =====================================================================
  // Applications
  // =====================================================================

  function renderApplications(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);
    card.innerHTML = '<div class="admin-card-head"><div><h2>Membership applications</h2><p>Click an application to review its details, photo and payment slip.</p></div><button type="button" class="btn btn-sky btn-sm" data-refresh>Refresh</button></div><div data-filters></div><div data-list></div>';
    const listEl = card.querySelector('[data-list]');
    card.querySelector('[data-refresh]').onclick = () => { load(); A.refreshBadges(); };

    const filters = filterBar(card.querySelector('[data-filters]'), {
      chipKey: 'status',
      chips: [['pending', 'Pending'], ['id_application', 'ID Application'], ['more_info_required', 'More Info Needed'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']],
      selects: [{ key: 'category', label: 'Category', options: CATEGORY_OPTIONS }],
      onChange: load,
    });

    // "Pending (2)", "ID Application (1)"…: counts follow the category and search filters.
    async function updateCounts() {
      try {
        const counts = await api('GET', `${BASE}/applications/counts${query({ category: filters.category, q: filters.q })}`);
        card.querySelectorAll('[data-chip]').forEach((c) => {
          c.textContent = `${c.dataset.label} (${counts[c.dataset.chip] || 0})`;
        });
      } catch (err) { /* keep the plain labels */ }
    }

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        const rows = await api('GET', `${BASE}/applications${query({ status: filters.status, category: filters.category, q: filters.q })}`);
        updateCounts();
        listEl.innerHTML = rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Received</th><th>Reference</th><th>Applicant</th><th>Category</th><th>Status</th></tr></thead>
            <tbody>${rows.map((r) => `
              <tr class="is-clickable" data-id="${r.id}" tabindex="0">
                <td>${esc(fmtDate(r.created_at))}</td>
                <td>${esc(r.reference_number)}${r.membership_number ? `<div class="admin-muted">${esc(r.membership_number)}</div>` : ''}</td>
                <td class="main-col">${esc(r.name_with_initials)}<div class="admin-muted">${esc(r.nic_number)} · ${esc(r.current_working_place || '')}</div></td>
                <td>${esc(CATEGORIES[r.category])} (${esc(r.category)})</td>
                <td>${chip(r.status, APP_STATUS[r.status])}${r.member_id ? `<div class="admin-muted" style="margin-top:4px">ID application ${r.id_application_created_at ? 'created' : 'pending'}</div>` : ''}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="admin-empty">No applications here.</p>';
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }

    listEl.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) reviewApplication(Number(tr.dataset.id), load, { idApplication: filters.status === 'id_application' });
    });
    listEl.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter') reviewApplication(Number(tr.dataset.id), load, { idApplication: filters.status === 'id_application' });
    });
    load();
  }

  // idApplication: opened from the "ID Application" tab, which is the only place
  // the ID application panel (download and confirm) is shown.
  async function reviewApplication(id, onChanged, { idApplication = false } = {}) {
    let cleanup = () => {};
    const view = infoDialog({ title: 'Application', onClose: () => cleanup() });
    view.body.innerHTML = '<p class="admin-muted">Loading…</p>';
    let a;
    try {
      a = await api('GET', `${BASE}/applications/${id}`);
    } catch (err) {
      view.body.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      return;
    }
    view.dialog.querySelector('.dialog-head h2').textContent = `${a.reference_number} · ${CATEGORIES[a.category]} (${a.category})`;
    const isPm = a.category === 'PM';

    const locked = a.status === 'approved';
    view.body.innerHTML = `
      ${idApplication && locked && a.member ? idApplicationPanel(a) : ''}
      <div class="detail-grid">
        <div>
          <div class="detail-section"><h3>Applicant</h3>${dl([
            ['Name', `${a.title || ''} ${a.full_name}`], ['Name with initials', a.name_with_initials], ['NIC', a.nic_number],
            ['Date of birth', fmtDate(a.date_of_birth)], ['Sex', a.sex], ['Marital status', a.marital_status],
            ['Email', a.email], ['Mobile', a.mobile], ['WhatsApp', a.whatsapp], ['Residential phone', a.residential_phone], ['Office phone', a.office_phone],
            ['Permanent address', a.permanent_address],
          ])}</div>
          <div class="detail-section"><h3>${isPm ? 'Studies' : 'Nursing'}</h3>${dl([
            ['SLNC registration', isPm ? '' : a.slnc_not_registered ? 'Not registered yet (ticked by applicant)' : [a.slnc_number, fmtDate(a.slnc_date)].filter(Boolean).join(' · ')],
            ['SLNA membership', a.slna_not_member ? 'No SLNA number yet (ticked by applicant)' : [a.slna_number, fmtDate(a.slna_date)].filter(Boolean).join(' · ')],
            [isPm ? 'Institution' : 'Working place', a.current_working_place], ['Official address', a.official_address], ['Designation', a.designation],
            ['Nursing school', [a.nursing_school, a.batch && 'batch ' + a.batch].filter(Boolean).join(', ')],
            ['First appointment', [fmtDate(a.first_appointment_date), a.first_appointment_place].filter(Boolean).join(', ')],
            ['Student number', a.student_number], ['Registered at institute', fmtDate(a.institute_registration_date)],
            ['ICU training', [a.icu_training_type, a.icu_training_batch, a.icu_training_year].filter(Boolean).join(', ')],
            ['Higher qualifications', a.higher_qualifications],
          ])}</div>
          <div class="detail-section"><h3>Payment</h3>${dl([
            ['Fee due', a.payment_amount != null ? money(a.payment_amount) : ''], ['Paid on', fmtDate(a.payment_date)],
          ])}</div>
        </div>
        <div>
          <div class="detail-section"><h3>Status</h3>
            <p>${chip(a.status, APP_STATUS[a.status])}</p>
            ${dl([
              ['Received', fmtDateTime(a.created_at)],
              ['Last reviewed', a.reviewed_at ? `${fmtDateTime(a.reviewed_at)}${a.reviewed_by_name ? ' by ' + a.reviewed_by_name : ''}` : ''],
              ['Message to applicant', a.status_note], ['Internal notes', a.admin_notes],
              ['Member', a.member ? `${a.member.membership_number}${a.member.valid_until ? ' · valid until ' + fmtDate(a.member.valid_until) : ' · lifetime'}` : ''],
            ])}
          </div>
          <div class="detail-section"><h3>Documents</h3><div data-docs></div></div>
          ${locked ? '' : `<div class="action-bar">
            ${a.status === 'more_info_required' ? '<button type="button" class="btn btn-light btn-sm" data-act="info-received">Information received</button>' : ''}
            <button type="button" class="btn btn-light btn-sm" data-act="info">Request more info</button>
            <button type="button" class="btn btn-teal btn-sm" data-act="approve">Approve</button>
            <button type="button" class="btn btn-light btn-sm" data-act="reject">Reject</button>
            <button type="button" class="btn btn-danger btn-sm" data-act="delete">Delete</button>
          </div>`}
        </div>
      </div>`;

    const docs = [
      a.photo_key && { label: 'Photo', path: `${BASE}/applications/${a.id}/files/photo` },
      a.receipt_key && { label: 'Payment slip', path: `${BASE}/applications/${a.id}/files/receipt` },
    ].filter(Boolean);
    docTiles(view.body.querySelector('[data-docs]'), docs).then((c) => { cleanup = c; });

    const done = (message) => {
      toast(message);
      view.close();
      onChanged();
      A.refreshBadges();
    };
    const patch = (fd) => api('PATCH', `${BASE}/applications/${a.id}/status`, fd);

    const idPanel = view.body.querySelector('[data-id-panel]');
    if (idPanel) {
      bindIdApplication(idPanel, {
        base: `${BASE}/applications/${a.id}`,
        number: a.member.membership_number,
        name: a.name_with_initials,
        onConfirmed: () => done('ID application confirmed.'),
      });
    }
    const fdOf = (obj) => { const f = new FormData(); Object.entries(obj).forEach(([k, v]) => f.append(k, v)); return f; };

    view.body.querySelector('.action-bar')?.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;

      if (act === 'info-received') {
        if (!(await confirmDialog({ title: 'Information received?', message: `"${a.reference_number}" moves back to Pending so it can be approved or rejected. Your earlier message is cleared from the applicant's status page.`, confirmText: 'Move to Pending' }))) return;
        try {
          await patch(fdOf({ status: 'pending', status_note: '' }));
          done('Moved back to Pending.');
        } catch (err) { toast(err.message, true); }
      } else if (act === 'info') {
        const ok = await openForm({
          title: 'Request more information',
          fields: [
            { name: 'status_note', label: 'What do you need from the applicant?', type: 'textarea', required: true, rows: 4, hint: 'Shown on their status page and emailed to them.' },
            { name: 'admin_notes', label: 'Internal notes', type: 'textarea', rows: 2, hint: 'Only visible to admins.' },
          ],
          values: { admin_notes: a.admin_notes },
          hidden: { status: 'more_info_required' },
          saveLabel: 'Send request',
          confirmTitle: 'Request more information?',
          confirmMessage: `The application will be marked "More info needed" and ${a.name_with_initials} will be asked for the information.`,
          submit: patch,
        });
        if (ok) done('More information requested.');
      } else if (act === 'reject') {
        const ok = await openForm({
          title: 'Reject application',
          fields: [
            { name: 'status_note', label: 'Reason (shown to the applicant)', type: 'textarea', required: true, rows: 4 },
            { name: 'admin_notes', label: 'Internal notes', type: 'textarea', rows: 2 },
          ],
          values: { admin_notes: a.admin_notes },
          hidden: { status: 'rejected' },
          saveLabel: 'Reject application',
          confirmTitle: 'Reject this application?',
          confirmMessage: `${a.name_with_initials} will be told the application was not approved, with your reason.`,
          submit: patch,
        });
        if (ok) done('Application rejected.');
      } else if (act === 'approve') {
        let suggestion = '';
        try { suggestion = (await api('GET', `${BASE}/next-number?category=${a.category}`)).membership_number; } catch (err) { /* type it in */ }
        // Annual memberships: the start date defaults to the day the application
        // was submitted; the admin can change it. Lifetime has no end, so no start date is asked.
        const isLt = a.category === 'LT';
        const submittedOn = new Date(a.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
        const ok = await openForm({
          title: 'Approve application',
          fields: [
            { name: 'membership_number', label: 'Membership number', required: true, half: true, hint: `Suggested next ${a.category} number. Format: ${a.category} 0000/YY.` },
            ...(isLt ? [] : [{ name: 'joined_on', label: 'Membership starts on', type: 'date', required: true, half: true, hint: `Defaults to the date the application was submitted (${fmtDate(submittedOn)}). Valid for 12 months from this date.` }]),
            { name: 'status_note', label: 'Welcome message (optional)', type: 'textarea', rows: 3, hint: 'Included in the approval email.' },
          ],
          values: { membership_number: suggestion, joined_on: submittedOn },
          hidden: { status: 'approved' },
          saveLabel: 'Approve',
          confirmTitle: 'Approve and create the member?',
          confirmMessage: (fd) => {
            const validity = isLt
              ? `Lifetime membership, member since ${fmtDate(submittedOn)} (the submitted date).`
              : `Membership from ${fmtDate(fd.get('joined_on'))} until ${fmtDate(addYear(fd.get('joined_on')))}.`;
            return `${a.name_with_initials} becomes a ${CATEGORIES[a.category]} member (${fd.get('membership_number')}).\n${validity}\n\nThey will be emailed their membership number. An approved application can no longer be changed.`;
          },
          submit: patch,
        });
        if (ok) done('Application approved and member created.');
      } else if (act === 'delete') {
        if (!(await confirmDialog({ title: 'Delete application?', message: `${a.reference_number} (${a.name_with_initials}) and its photo, payment slip and documents will be permanently deleted.\n\nThis cannot be undone.`, confirmText: 'Delete', danger: true }))) return;
        try {
          await api('DELETE', `${BASE}/applications/${a.id}`);
          done('Application deleted.');
        } catch (err) { toast(err.message, true); }
      }
    });
  }

  // =====================================================================
  // ID card application (approved applications only; not in the member directory)
  // =====================================================================

  const idStatusChip = (createdAt) => (createdAt
    ? chip('approved', 'ID application created')
    : chip('pending', 'ID application pending'));

  // Download the form and the photo, check them, then confirm. a: an approved
  // application with its member (id_application_created_at, has_photo).
  function idApplicationPanel(a) {
    const m = a.member;
    const createdAt = m.id_application_created_at;
    return `
      <section class="id-panel" data-id-panel>
        <div class="id-panel-head">
          <div>
            <h3>ID card application · ${esc(m.membership_number)}</h3>
            <p class="admin-muted">${createdAt
              ? `Confirmed ${esc(fmtDateTime(createdAt))}${m.id_application_created_by_name ? ' by ' + esc(m.id_application_created_by_name) : ''}. The form and photo can still be downloaded again.`
              : 'Download the form and the passport-size photo, check them, then confirm.'}</p>
          </div>
          ${idStatusChip(createdAt)}
        </div>
        <div class="id-docs">
          <button type="button" class="id-doc" data-id-act="pdf">
            <span class="id-doc-ico" aria-hidden="true">PDF</span>
            <span><b>ID application form</b><span>A4 PDF with details and photo</span></span>
          </button>
          ${m.has_photo === false ? '' : `
          <button type="button" class="id-doc" data-id-act="photo">
            <span class="id-doc-ico id-doc-ico-img" aria-hidden="true">IMG</span>
            <span><b>Passport photo</b><span>Named for the ID card</span></span>
          </button>`}
          ${createdAt ? '' : '<button type="button" class="btn btn-teal id-confirm-btn" data-id-act="confirm">Confirm ID application created</button>'}
        </div>
      </section>`;
  }

  function bindIdApplication(panel, { base, number, name, onConfirmed }) {
    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-id-act]');
      if (!btn) return;
      const act = btn.dataset.idAct;
      if (act === 'pdf' || act === 'photo') {
        btn.disabled = true;
        const ok = await A.downloadPrivateFile(act === 'pdf' ? `${base}/id-application.pdf` : `${base}/id-photo`);
        btn.disabled = false;
        if (ok) btn.classList.add('is-done');
      } else if (act === 'confirm') {
        if (!(await confirmDialog({
          title: 'Confirm ID application created?',
          message: `Records that the ID card application for ${number} (${name}) has been created, with today's date and your name.\n\nOnly confirm after checking the downloaded form and photo.`,
          confirmText: 'Confirm created',
        }))) return;
        try {
          await api('POST', `${base}/id-application`);
          onConfirmed();
        } catch (err) { toast(err.message, true); }
      }
    });
  }

  // =====================================================================
  // Members
  // =====================================================================

  const MEMBER_FIELDS = [
    { name: 'category', label: 'Category', type: 'select', required: true, half: true, options: CATEGORY_OPTIONS },
    { name: 'membership_number', label: 'Membership number', required: true, half: true },
    { name: 'title', label: 'Title', type: 'select', half: true, options: [['', 'Select title'], ...['Prof.', 'Dr.', 'Mr.', 'Miss.', 'Mrs.'].map((t) => [t, t])] },
    { name: 'sex', label: 'Sex', type: 'select', half: true, options: [['', '—'], ['Female', 'Female'], ['Male', 'Male']] },
    { name: 'full_name', label: 'Name in full', required: true },
    { name: 'name_with_initials', label: 'Name with initials', required: true, half: true },
    { name: 'nic_number', label: 'NIC number', required: true, half: true },
    { name: 'date_of_birth', label: 'Date of birth', type: 'date', half: true },
    { name: 'email', label: 'Email', half: true },
    { name: 'mobile', label: 'Mobile', half: true, hint: '07XXXXXXXX or +947XXXXXXXX' },
    { name: 'whatsapp', label: 'WhatsApp', half: true },
    { name: 'current_working_place', label: 'Working place', half: true },
    { name: 'designation', label: 'Designation', half: true },
    { name: 'joined_on', label: 'Member since', type: 'date', required: true, half: true },
    { name: 'valid_until', label: 'Valid until', type: 'date', half: true, hint: 'Ignored for Lifetime. If empty: one year from "Member since".' },
    { name: 'admin_notes', label: 'Internal notes', type: 'textarea', rows: 2 },
  ];

  async function suggestionsHint() {
    try {
      const nums = await Promise.all(Object.keys(CATEGORIES).map((c) => api('GET', `${BASE}/next-number?category=${c}`)));
      return 'Next free: ' + nums.map((n) => n.membership_number).join(' · ');
    } catch (err) {
      return '';
    }
  }

  function renderMembers(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);
    card.innerHTML = `
      <div class="admin-card-head"><div><h2>Member directory</h2><p>Statuses are worked out from each member's "valid until" date and the grace period, so lapsing happens automatically.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-sky btn-sm" data-refresh>Refresh</button>
          <button type="button" class="btn btn-excel btn-sm" data-export>Download Excel</button>
          <button type="button" class="btn btn-coral btn-sm" data-add>Add member</button>
        </div></div>
      <div class="stat-tiles" data-tiles></div>
      <div data-filters></div>
      <div data-list></div>`;
    const listEl = card.querySelector('[data-list]');
    const tilesEl = card.querySelector('[data-tiles]');
    const filters = filterBar(card.querySelector('[data-filters]'), {
      chipKey: 'state',
      // "Members" is everyone who isn't deactivated (active, renewal due, grace period and lapsed).
      chips: [['current', 'Members'], ['renewal_due', 'Renewal Due'], ['grace', 'Grace Period'], ['lapsed', 'Lapsed'], ['pending_renewal', 'Renewals to Verify'], ['deactivated', 'Deactivated']],
      selects: [{ key: 'category', label: 'Category', options: CATEGORY_OPTIONS }],
      onChange: load,
    });

    async function loadTiles() {
      try {
        const o = await api('GET', `${BASE}/overview`);
        tilesEl.innerHTML = [
          ['current', o.members.total - o.members.deactivated, 'Members'], ['renewal_due', o.members.renewal_due, 'Renewal Due'],
          ['grace', o.members.grace, 'Grace Period'], ['lapsed', o.members.lapsed, 'Lapsed'],
          ['pending_renewal', o.pending_renewals, 'Renewals to Verify'], ['deactivated', o.members.deactivated, 'Deactivated'],
        ].map(([state, n, label]) => `<button type="button" class="stat-tile" data-tile="${state}"><b>${esc(n)}</b><span>${esc(label)}</span></button>`).join('');
      } catch (err) { tilesEl.innerHTML = ''; }
    }

    // "Members (42)", "Lapsed (5)"…: counts follow the category and search filters.
    async function updateCounts() {
      try {
        const counts = await api('GET', `${BASE}/members/counts${query({ category: filters.category, q: filters.q })}`);
        card.querySelectorAll('[data-chip]').forEach((c) => { c.textContent = `${c.dataset.label} (${counts[c.dataset.chip] || 0})`; });
      } catch (err) { /* keep the plain labels */ }
    }
    tilesEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tile]');
      if (!t) return;
      card.querySelector(`[data-chip="${t.dataset.tile}"]`).click();
    });

    // Buttons on each row. The Lapsed tab gets everything needed to follow up a
    // lapsed member; elsewhere Renew / Upgrade, and the card has the rest.
    // A renewal waiting for verification is reviewed first (it would block a new one).
    const btn = (act, label, cls = 'btn-light') => `<button type="button" class="btn ${cls} btn-xs" data-row-act="${act}">${label}</button>`;
    function rowActions(m) {
      if (m.state === 'deactivated') return btn('reactivate', 'Reactivate', 'btn-teal');
      if (m.has_pending_renewal) return btn('review', 'Review Renewal', 'btn-teal');
      if (m.category === 'LT') return '';
      // Three buttons stack in two rows (reminder on top) to keep the table narrow.
      if (filters.state === 'lapsed') return `<div class="row-actions-stack">${btn('reminder', 'Renewal Reminder', 'btn-sky')}${btn('renew', 'Renew / Upgrade', 'btn-teal')}${btn('deactivate', 'Deactivate', 'btn-danger')}</div>`;
      return btn('renew', 'Renew / Upgrade', 'btn-teal');
    }
    let rows = [];

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        rows = await api('GET', `${BASE}/members${query({ state: filters.state, category: filters.category, q: filters.q })}`);
        updateCounts();
        listEl.innerHTML = rows.length ? `
          <p class="admin-muted">${rows.length} member${rows.length === 1 ? '' : 's'}</p>
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Number</th><th>Member</th><th>Category</th><th>Valid until</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>${rows.map((m) => `
              <tr class="is-clickable" data-id="${m.id}" tabindex="0">
                <td style="white-space:nowrap">${esc(m.membership_number)}</td>
                <td class="main-col">${esc(m.name_with_initials)}<div class="admin-muted">${esc(m.nic_number)}${m.mobile ? ' · ' + esc(m.mobile) : ''}</div></td>
                <td>${esc(CATEGORIES[m.category])}</td>
                <td>${m.valid_until ? esc(fmtDate(m.valid_until)) : 'Lifetime'}</td>
                <td>${chip(m.state, MEMBER_STATE[m.state])}${m.has_pending_renewal ? '<div class="admin-muted" style="margin-top:4px;white-space:nowrap">Renewal to verify</div>' : ''}</td>
                <td><div class="row-actions">${rowActions(m)}</div></td>
              </tr>`).join('')}</tbody>
          </table></div>` : '<p class="admin-empty">No members here yet.</p>';
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }
    const reload = () => { load(); loadTiles(); A.refreshBadges(); };

    // A row opens the member card; in "Renewals to Verify" it opens the renewal to verify.
    const openRow = (id) => {
      if (filters.state === 'pending_renewal') openPendingRenewal(id, reload);
      else memberDetail(id, reload);
    };
    listEl.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const act = e.target.closest('[data-row-act]')?.dataset.rowAct;
      if (!act) return openRow(Number(tr.dataset.id));
      const m = rows.find((r) => r.id === Number(tr.dataset.id));
      if (act === 'review') openPendingRenewal(m.id, reload);
      else if (act === 'reminder') renewalLinkDialog(m);
      else if (act === 'renew' && await renewUpgrade(m)) { toast('Membership renewed / upgraded.'); reload(); }
      else if (act === 'deactivate' && await deactivateMember(m)) { toast('Member deactivated.'); reload(); }
      else if (act === 'reactivate' && await reactivateMember(m)) { toast('Member reactivated.'); reload(); }
    });
    listEl.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter' && !e.target.closest('[data-row-act]')) openRow(Number(tr.dataset.id));
    });

    // The list as currently filtered, as an Excel file (named by the server).
    card.querySelector('[data-refresh]').onclick = reload;
    card.querySelector('[data-export]').onclick = () =>
      A.downloadPrivateFile(`${BASE}/members/export.xlsx${query({ state: filters.state, category: filters.category, q: filters.q })}`);

    card.querySelector('[data-add]').onclick = async () => {
      const hint = await suggestionsHint();
      const fields = MEMBER_FIELDS.map((f) => (f.name === 'membership_number' ? { ...f, hint } : f));
      const ok = await openForm({
        title: 'Add member',
        fields,
        image: { column: 'photo_preview', field: 'photo', label: 'Photo', allowRemove: false },
        values: { category: 'GM', joined_on: today() },
        saveLabel: 'Add member',
        confirmTitle: 'Add this member?',
        confirmMessage: 'The member will be added to the directory. Use this for members who joined on paper.',
        submit: (fd) => api('POST', `${BASE}/members`, fd),
      });
      if (ok) { toast('Member added.'); reload(); }
    };

    reload();
  }

  // ---------- Member actions (table rows and the member card) ----------

  async function loadFees() {
    try { return Object.fromEntries((await api('GET', `${BASE}/settings`)).fees.map((f) => [f.category, f.amount])); } catch (err) { return {}; }
  }

  // Renew or upgrade with a payment received offline (cash, a slip handed in),
  // verified straight away. With reactivate: true it's the Reactivate window,
  // where renewing or upgrading is an option. Resolves true when saved.
  async function renewUpgrade(m, { reactivate = false } = {}) {
    const fees = await loadFees();
    // One option per upgrade open to this category ("upgrade:GM"), each with the
    // next free number in that category's series.
    const targets = UPGRADES[m.category] || [];
    const nextNumber = {};
    await Promise.all(targets.map(async (to) => {
      try { nextNumber[to] = (await api('GET', `${BASE}/next-number?category=${to}`)).membership_number; } catch (err) { nextNumber[to] = ''; }
    }));
    const fee = { renewal: fees[m.category], ...Object.fromEntries(targets.map((to) => [`upgrade:${to}`, fees[to]])) };
    const kinds = [
      ...(reactivate ? [['', 'No, reactivate only']] : []),
      ['renewal', `${reactivate ? 'Yes, renew' : 'Renew'} for 12 months (${money(fee.renewal || 0)})`],
      ...targets.map((to) => [`upgrade:${to}`, `${reactivate ? 'Yes, upgrade' : 'Upgrade'} to ${CATEGORIES[to]} (${money(fee[`upgrade:${to}`] || 0)})`]),
    ];
    const upgradeTo = (kind) => (kind && kind.startsWith('upgrade:') ? kind.slice(8) : null);
    const label = (fd) => {
      const to = upgradeTo(fd.get('kind'));
      return to ? `upgraded to ${CATEGORIES[to]}` : 'renewed for 12 months';
    };
    return openForm({
      title: reactivate ? `Reactivate ${m.membership_number}` : `Renew / Upgrade ${m.membership_number}`,
      fields: [
        { name: 'kind', label: reactivate ? 'Also renew or upgrade' : 'Payment for', type: 'select', required: !reactivate, options: kinds },
        { name: 'amount', label: 'Amount received (LKR)', type: 'number', step: '0.01', required: true, half: true },
        { name: 'payment_date', label: 'Payment date', type: 'date', required: true, half: true },
        { name: 'payment_reference', label: 'Receipt / reference number', half: true },
        { name: 'membership_number', label: 'New membership number', required: true, half: true, hint: `Next free number. ${m.membership_number} is kept reserved.` },
        { name: 'status_note', label: 'Note', type: 'textarea', rows: 2 },
      ],
      values: { kind: reactivate ? '' : 'renewal', amount: fee.renewal, payment_date: today() },
      // Payment fields only when there is a payment; the new number only for an upgrade.
      onMount: (form) => {
        const show = (name, on) => {
          const field = form.elements[name].closest('.field');
          field.hidden = !on;
          field.style.display = on ? '' : 'none';
        };
        const sync = () => {
          const kind = form.elements.kind.value;
          const to = upgradeTo(kind);
          ['amount', 'payment_date', 'payment_reference', 'status_note'].forEach((n) => show(n, Boolean(kind)));
          show('membership_number', Boolean(to));
          if (to) {
            form.elements.membership_number.value = nextNumber[to] || '';
            const hint = form.elements.membership_number.closest('.field').querySelector('.hint');
            if (hint) hint.textContent = `Next free ${to} number. ${m.membership_number} is kept reserved.`;
          }
          if (kind) form.elements.amount.value = fee[kind] ?? '';
        };
        form.elements.kind.addEventListener('change', sync);
        sync();
      },
      saveLabel: reactivate ? 'Reactivate' : 'Renew / Upgrade',
      confirmTitle: reactivate ? 'Reactivate this member?' : 'Renew / upgrade this member?',
      confirmMessage: (fd) => {
        const payment = fd.get('kind')
          ? `${m.membership_number} (${m.name_with_initials}) will be ${label(fd)}${upgradeTo(fd.get('kind')) ? ` as ${fd.get('membership_number')}` : ''}. The payment of ${money(fd.get('amount') || 0)} is recorded as verified straight away and the member is emailed.`
          : '';
        if (!reactivate) return `${payment}\n\nUse this for payments received outside the website (cash, a slip handed in), not online submissions.`;
        return fd.get('kind')
          ? `${m.membership_number} will be active again.\n\n${payment}`
          : `${m.membership_number} (${m.name_with_initials}) will be active again. Their status will follow their "valid until" date.`;
      },
      submit: (fd) => {
        // "upgrade:GM" is sent as kind = upgrade, to_category = GM.
        const to = upgradeTo(fd.get('kind'));
        if (to) {
          fd.set('kind', 'upgrade');
          fd.set('to_category', to);
        } else {
          fd.delete('membership_number');
        }
        if (reactivate && !fd.get('kind')) ['kind', 'amount', 'payment_date', 'payment_reference', 'status_note'].forEach((k) => fd.delete(k));
        return api('POST', `${BASE}/members/${m.id}/${reactivate ? 'reactivate' : 'payments'}`, fd);
      },
    });
  }

  async function reactivateMember(m) {
    if (m.category !== 'LT') return renewUpgrade(m, { reactivate: true });
    if (!(await confirmDialog({ title: 'Reactivate member?', message: `${m.membership_number} (${m.name_with_initials}) will be active again.`, confirmText: 'Reactivate' }))) return false;
    try {
      await api('POST', `${BASE}/members/${m.id}/reactivate`);
      return true;
    } catch (err) {
      toast(err.message, true);
      return false;
    }
  }

  function deactivateMember(m) {
    return openForm({
      title: `Deactivate ${m.membership_number}`,
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true, rows: 3, hint: 'Internal: for example "Resigned" or "Duplicate record".' }],
      saveLabel: 'Deactivate',
      confirmTitle: 'Deactivate this member?',
      confirmMessage: `${m.membership_number} (${m.name_with_initials}) will be marked inactive and stop receiving reminders. The record is kept and can be reactivated.`,
      submit: (fd) => api('POST', `${BASE}/members/${m.id}/deactivate`, fd),
    });
  }

  // The member's renewal waiting for verification, in the Renewals window.
  async function openPendingRenewal(memberId, onChanged) {
    try {
      const r = (await api('GET', `${BASE}/renewals?status=pending`)).find((x) => x.member_id === memberId);
      if (r) renewalDetail(r, onChanged);
      else toast('This renewal has already been reviewed.', true);
    } catch (err) { toast(err.message, true); }
  }

  async function memberDetail(id, onChanged) {
    let photoUrl = null;
    const view = infoDialog({ title: 'Member', onClose: () => { if (photoUrl) URL.revokeObjectURL(photoUrl); } });
    view.body.innerHTML = '<p class="admin-muted">Loading…</p>';
    let m;
    try {
      m = await api('GET', `${BASE}/members/${id}`);
    } catch (err) {
      view.body.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      return;
    }
    if (m.has_photo) {
      try { photoUrl = URL.createObjectURL(await A.apiBlob(`${BASE}/members/${m.id}/photo`)); } catch (err) { /* no photo */ }
    }
    view.dialog.querySelector('.dialog-head h2').textContent = `${m.membership_number} · ${m.name_with_initials}`;
    const isLt = m.category === 'LT';

    view.body.innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="detail-section"><h3>Membership</h3>${dl([
            ['Number', m.membership_number], ['Category', `${CATEGORIES[m.category]} (${m.category})`],
            ['Status', html(chip(m.state, MEMBER_STATE[m.state]) + (m.has_pending_renewal ? ' <span class="admin-muted">Renewal to verify</span>' : ''))],
            ['Member since', fmtDate(m.joined_on)], ['Valid until', m.valid_until ? fmtDate(m.valid_until) : 'Lifetime'],
            ['Grace period ends', m.grace_ends ? fmtDate(m.grace_ends) : ''],
            ['Deactivated', m.deactivated_at ? `${fmtDate(m.deactivated_at)}: ${m.deactivated_reason}` : ''],
            ['Joined through', m.source === 'manual' ? 'Added by an admin' : m.application ? `Application ${m.application.reference_number}` : 'Application'],
            ['Previous number', (m.previous_numbers || []).map((p) => `${p.membership_number} (until ${fmtDate(p.retired_at)}, then upgraded; reserved)`).join(', ')],
          ])}</div>
          <div class="detail-section"><h3>Details</h3>${dl([
            ['Name', `${m.title || ''} ${m.full_name}`], ['NIC', m.nic_number], ['Date of birth', fmtDate(m.date_of_birth)], ['Sex', m.sex],
            ['Email', m.email], ['Mobile', m.mobile], ['WhatsApp', m.whatsapp], ['Working place', m.current_working_place], ['Designation', m.designation],
            ['Internal notes', m.admin_notes],
          ])}</div>
          <div class="detail-section"><h3>Payments &amp; renewals</h3>${m.renewals.length ? `<ul class="history-list">${m.renewals.map((r) => `
            <li>${chip(r.status, { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' }[r.status])}
              <strong>${requestType(r)}</strong> · ${esc(money(r.amount))} · ref ${esc(r.payment_reference)}
              <div class="admin-muted">${r.recorded_by_admin ? 'Recorded by admin' : 'Submitted online'} ${esc(fmtDate(r.created_at))}${r.new_valid_until ? ' · valid until ' + esc(fmtDate(r.new_valid_until)) : ''}${r.reviewed_by_name ? ' · by ' + esc(r.reviewed_by_name) : ''}${r.status_note ? ' · ' + esc(r.status_note) : ''}</div>
            </li>`).join('')}</ul>` : '<p class="admin-muted">None yet.</p>'}</div>
          ${!isLt ? `<div class="detail-section"><h3>Reminder emails</h3>${m.reminders.length ? `<ul class="history-list">${m.reminders.map((r) => `
            <li><strong>${esc(REMINDER_KINDS[r.kind] || r.kind)}</strong> · ${esc(r.status)} · ${esc(fmtDateTime(r.created_at))}${r.detail ? `<div class="admin-muted">${esc(r.detail)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="admin-muted">None sent yet.</p>'}</div>` : ''}
        </div>
        <div>
          <div class="detail-section"><h3>Photo</h3>${photoUrl ? `<img src="${photoUrl}" alt="" style="width:160px;border-radius:12px">` : '<p class="admin-muted">No photo.</p>'}</div>
          <div class="action-bar" style="flex-direction:column;align-items:stretch">
            <button type="button" class="btn btn-light btn-sm" data-act="edit">Edit details</button>
            ${!isLt && m.state !== 'deactivated' ? '<button type="button" class="btn btn-light btn-sm" data-act="link">Renewal Reminder</button>' : ''}
            ${m.has_pending_renewal ? '<button type="button" class="btn btn-teal btn-sm" data-act="review">Review Renewal</button>'
              : !isLt && m.state !== 'deactivated' ? '<button type="button" class="btn btn-teal btn-sm" data-act="payment">Renew / Upgrade</button>' : ''}
            ${m.state === 'deactivated'
              ? '<button type="button" class="btn btn-teal btn-sm" data-act="reactivate">Reactivate</button>'
              : '<button type="button" class="btn btn-danger btn-sm" data-act="deactivate">Deactivate</button>'}
          </div>
        </div>
      </div>`;

    const refresh = (message) => {
      toast(message);
      view.close();
      onChanged();
      memberDetail(id, onChanged);
    };

    view.body.querySelector('.action-bar').addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;

      if (act === 'edit') {
        const ok = await openForm({
          title: 'Edit member',
          fields: MEMBER_FIELDS,
          image: { column: 'photo_preview', field: 'photo', label: 'Photo', allowRemove: false },
          values: { ...m, photo_preview: photoUrl },
          saveLabel: 'Save changes',
          confirmTitle: 'Save changes?',
          confirmMessage: `Changes to ${m.membership_number} will be saved.`,
          submit: (fd) => api('PUT', `${BASE}/members/${m.id}`, fd),
        });
        if (ok) refresh('Member updated.');
      } else if (act === 'link') {
        renewalLinkDialog(m);
      } else if (act === 'review') {
        view.close();
        openPendingRenewal(m.id, onChanged);
      } else if (act === 'payment') {
        if (await renewUpgrade(m)) refresh('Membership renewed / upgraded.');
      } else if (act === 'deactivate') {
        if (await deactivateMember(m)) refresh('Member deactivated.');
      } else if (act === 'reactivate') {
        if (await reactivateMember(m)) refresh('Member reactivated.');
      }
    });
  }

  function renewalLinkDialog(m) {
    const view = infoDialog({ title: `Renewal Reminder · ${m.membership_number}`, wide: false });
    view.body.innerHTML = `
      <p>Email ${esc(m.name_with_initials)} a renewal reminder, or copy their personal renewal link to send by WhatsApp or SMS. The link opens their renewal page with their details filled in and works for 90 days.</p>
      <div class="action-bar" style="border-top:0;margin-top:0;padding-top:0">
        <button type="button" class="btn btn-light btn-sm" data-act="create">Create link to copy</button>
        ${m.email ? `<button type="button" class="btn btn-teal btn-sm" data-act="email">Email link to ${esc(m.email)}</button>` : '<span class="admin-muted">No email address on record.</span>'}
      </div>
      <div data-result></div>`;
    const result = view.body.querySelector('[data-result]');
    view.body.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'email' && !(await confirmDialog({ title: 'Email renewal link?', message: `A renewal reminder with a personal link will be emailed to ${m.email}.`, confirmText: 'Send email' }))) return;
      try {
        const fd = new FormData();
        fd.append('send_email', act === 'email' ? 'true' : 'false');
        const r = await api('POST', `${BASE}/members/${m.id}/renewal-link`, fd);
        const emailNote = r.email
          ? r.email.status === 'sent' ? '<p class="callout">Email sent.</p>' : `<p class="callout callout-warn">The email was not sent: ${esc(r.email.detail || r.email.status)}. You can copy the link below and send it by WhatsApp or SMS instead.</p>`
          : '';
        result.innerHTML = `${emailNote}<div class="copy-field"><input readonly value="${esc(r.url)}" aria-label="Renewal link"><button type="button" class="btn btn-light btn-sm" data-copy-link>Copy</button></div>`;
        result.querySelector('[data-copy-link]').onclick = async (ev) => {
          try { await navigator.clipboard.writeText(r.url); ev.target.textContent = 'Copied'; } catch (err) { result.querySelector('input').select(); }
        };
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // =====================================================================
  // Renewals
  // =====================================================================

  function renderRenewals(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);
    card.innerHTML = '<div class="admin-card-head"><div><h2>Renewals &amp; upgrades</h2><p>Check each payment slip, then verify or reject it.</p></div><button type="button" class="btn btn-sky btn-sm" data-refresh>Refresh</button></div><div data-filters></div><div data-list></div>';
    const listEl = card.querySelector('[data-list]');
    card.querySelector('[data-refresh]').onclick = () => { load(); A.refreshBadges(); };
    const filters = filterBar(card.querySelector('[data-filters]'), {
      chipKey: 'status', search: false,
      chips: [['pending', 'To Verify'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['all', 'All']],
      onChange: load,
    });
    let rows = [];

    async function updateCounts() {
      try {
        const counts = await api('GET', `${BASE}/renewals/counts`);
        card.querySelectorAll('[data-chip]').forEach((c) => { c.textContent = `${c.dataset.label} (${counts[c.dataset.chip] || 0})`; });
      } catch (err) { /* keep the plain labels */ }
    }

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        rows = await api('GET', `${BASE}/renewals${query({ status: filters.status })}`);
        updateCounts();
        listEl.innerHTML = rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Submitted</th><th>Member</th><th>Type</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>${rows.map((r) => `
              <tr class="is-clickable" data-id="${r.id}" tabindex="0">
                <td>${esc(fmtDate(r.created_at))}</td>
                <td class="main-col">${esc(r.membership_number)}<div class="admin-muted">${esc(r.name_with_initials)}</div></td>
                <td>${requestType(r)}${r.recorded_by_admin ? '<div class="admin-muted">Recorded by admin</div>' : ''}</td>
                <td>${esc(money(r.amount))}</td>
                <td>${esc(r.payment_reference)}</td>
                <td>${chip(r.status, { pending: 'To verify', verified: 'Verified', rejected: 'Rejected' }[r.status])}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : `<p class="admin-empty">${filters.status === 'pending' ? 'Nothing to verify right now.' : 'No renewals here.'}</p>`;
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }

    const open = (id) => renewalDetail(rows.find((r) => r.id === id), () => { load(); A.refreshBadges(); });
    listEl.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) open(Number(tr.dataset.id)); });
    listEl.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') open(Number(tr.dataset.id)); });
    load();
  }

  async function renewalDetail(r, onChanged) {
    let cleanup = () => {};
    const view = infoDialog({ title: `${r.kind === 'upgrade' ? 'Upgrade' : 'Renewal'} · ${r.membership_number}`, onClose: () => cleanup() });
    const changes = [['Email', r.email], ['Mobile', r.mobile], ['Working place', r.current_working_place]].filter(([, v]) => v);
    view.body.innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="detail-section"><h3>Payment</h3>${dl([
            ['Member', `${r.membership_number} · ${r.name_with_initials}`],
            ['Type', r.kind === 'upgrade' ? `Upgrade ${r.from_category} → ${r.to_category} (${CATEGORIES[r.to_category]})` : `Renewal of ${CATEGORIES[r.from_category]}`],
            ['Previous number', r.previous_membership_number ? `${r.previous_membership_number} (reserved, not reused)` : ''],
            ['Amount due', money(r.amount)], ['Payment reference', r.payment_reference], ['Paid on', fmtDate(r.payment_date)],
            ['Submitted', fmtDateTime(r.created_at)],
            ['Valid until (before)', r.previous_valid_until ? fmtDate(r.previous_valid_until) : ''],
            ['Valid until (after)', r.new_valid_until ? fmtDate(r.new_valid_until) : r.status === 'pending' ? (r.to_category === 'LT' ? 'Lifetime' : 'One year more, set when verified') : ''],
            ['Status', html(chip(r.status, { pending: 'To verify', verified: 'Verified', rejected: 'Rejected' }[r.status]))],
            ['Message to member', r.status_note],
          ])}</div>
          ${r.kind === 'upgrade' && r.icu_training_type ? `<div class="detail-section"><h3>Lifetime requirement</h3>${dl([
            ['ICU training (PBCN)', `${r.icu_training_type === 'diploma' ? 'Diploma' : 'Certificate'}, batch ${r.icu_training_batch}, ${r.icu_training_year}`],
          ])}<p class="admin-muted">Check this before verifying the upgrade.</p></div>` : ''}
          ${changes.length ? `<div class="detail-section"><h3>Contact details to update</h3>${dl(changes)}<p class="admin-muted">Applied to the member record when verified.</p></div>` : ''}
        </div>
        <div>
          <div class="detail-section"><h3>Payment slip</h3><div data-docs></div></div>
          ${r.status === 'pending' ? `<div class="action-bar">
            <button type="button" class="btn btn-teal btn-sm" data-act="verify">Verify payment</button>
            <button type="button" class="btn btn-light btn-sm" data-act="reject">Reject</button>
          </div>` : ''}
          <p style="margin-top:12px"><button type="button" class="btn btn-light btn-sm" data-act="member">Open member</button></p>
        </div>
      </div>`;
    if (r.has_receipt) docTiles(view.body.querySelector('[data-docs]'), [{ label: 'Payment slip', path: `${BASE}/renewals/${r.id}/receipt` }]).then((c) => { cleanup = c; });
    else view.body.querySelector('[data-docs]').innerHTML = '<p class="admin-muted">No slip (recorded by an admin).</p>';

    const done = (message) => { toast(message); view.close(); onChanged(); };
    view.body.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'member') {
        view.close();
        memberDetail(r.member_id, onChanged);
      } else if (act === 'verify') {
        if (r.kind === 'upgrade') {
          let suggestion = '';
          try { suggestion = (await api('GET', `${BASE}/next-number?category=${r.to_category}`)).membership_number; } catch (err) { /* type it */ }
          const ok = await openForm({
            title: `Verify upgrade to ${CATEGORIES[r.to_category]}`,
            fields: [{ name: 'membership_number', label: `New ${CATEGORIES[r.to_category]} membership number`, required: true, hint: `Next free ${r.to_category} number. The member's current number is ${r.membership_number}.` }],
            values: { membership_number: suggestion },
            hidden: { status: 'verified' },
            saveLabel: 'Verify and upgrade',
            confirmTitle: 'Verify this payment and upgrade?',
            confirmMessage: `Confirm you've checked the payment slip for ${money(r.amount)} (${r.payment_reference}). ${r.name_with_initials} becomes a ${CATEGORIES[r.to_category]} member${r.to_category === 'LT' ? '' : ' (valid for 12 months, like a renewal)'} and is emailed.`,
            submit: (fd) => api('PATCH', `${BASE}/renewals/${r.id}`, fd),
          });
          if (ok) done('Upgrade verified.');
          return;
        }
        if (!(await confirmDialog({ title: 'Verify this payment?', message: `Confirm you've checked the payment slip for ${money(r.amount)} (${r.payment_reference}).\n\n${r.membership_number} will be extended by 12 months and the member will be emailed.`, confirmText: 'Verify payment' }))) return;
        try {
          const fd = new FormData();
          fd.append('status', 'verified');
          await api('PATCH', `${BASE}/renewals/${r.id}`, fd);
          done('Payment verified. Membership extended.');
        } catch (err) { toast(err.message, true); }
      } else if (act === 'reject') {
        const ok = await openForm({
          title: 'Reject payment',
          fields: [{ name: 'status_note', label: 'Reason (sent to the member)', type: 'textarea', required: true, rows: 3, hint: 'For example: "The slip is unreadable" or "Payment not found on the statement".' }],
          hidden: { status: 'rejected' },
          saveLabel: 'Reject payment',
          confirmTitle: 'Reject this payment?',
          confirmMessage: `${r.name_with_initials} will be emailed your reason and asked to submit again. The membership is not changed.`,
          submit: (fd) => api('PATCH', `${BASE}/renewals/${r.id}`, fd),
        });
        if (ok) done('Payment rejected.');
      }
    });
  }

  // =====================================================================
  // Settings
  // =====================================================================

  function renderSettings(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    main.appendChild(card);

    async function load() {
      card.innerHTML = '<p class="admin-muted">Loading…</p>';
      let s;
      try { s = await api('GET', `${BASE}/settings`); } catch (err) {
        card.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
        return;
      }
      card.innerHTML = `
        <div class="admin-card-head"><div><h2>Fees</h2><p>Shown on the membership pages and used for new applications and renewals.</p></div></div>
        <div class="admin-table-wrap"><table class="admin-table">
          <thead><tr><th>Category</th><th>Fee</th><th>Period</th><th></th></tr></thead>
          <tbody>${s.fees.map((f) => `<tr><td class="main-col">${esc(f.label)} (${esc(f.category)})</td><td>${esc(money(f.amount))}</td><td>${f.is_annual ? 'Per year' : 'One-time'}</td>
            <td><div class="row-actions"><button type="button" class="btn btn-light btn-sm" data-fee="${esc(f.category)}">Edit</button></div></td></tr>`).join('')}</tbody>
        </table></div>

        <div class="settings-section">
          <div class="admin-card-head"><div><h2>Bank details: membership</h2><p>Shown for membership fees and renewals.</p></div>
            <button type="button" class="btn btn-light btn-sm" data-edit-bank>Edit</button></div>
          ${dl([['Bank', s.bank.bank_name], ['Account number', s.bank.account_number], ['Branch', s.bank.branch], ['Account name', s.bank.account_name]])}
        </div>

        <div class="settings-section">
          <div class="admin-card-head"><div><h2>Bank details: CPD events</h2><p>Shown on paid CPD event pages and the event registration form.</p></div>
            <button type="button" class="btn btn-light btn-sm" data-edit-event-bank>Edit</button></div>
          ${dl([['Bank', s.event_bank.bank_name], ['Account number', s.event_bank.account_number], ['Branch', s.event_bank.branch], ['Account name', s.event_bank.account_name]])}
        </div>

        <div class="settings-section">
          <div class="admin-card-head"><div><h2>Renewals</h2><p>When annual memberships are due and how long members can still renew after expiry.</p></div>
            <button type="button" class="btn btn-light btn-sm" data-edit-renewals>Edit</button></div>
          ${dl([['First reminder', `${s.notice_days} days before expiry`], ['Grace period', `${s.grace_days} days after expiry`]])}
        </div>

        <div class="admin-card-head" style="margin-top:28px"><div><h2>Renewal reminder emails</h2>
          <p>A daily scheduled job sends reminders (${s.notice_days} and 7 days before expiry, on expiry, 14 days before the grace period ends, and when a membership lapses). You can also run it now.</p></div>
          <button type="button" class="btn btn-teal btn-sm" data-run>Send due reminders now</button></div>
        ${s.email_configured ? '<p class="callout">Email sending is switched on.</p>' : '<p class="callout callout-warn"><strong>Email sending is not set up yet.</strong> Reminders and notifications are logged but not sent until a Resend API key is added to the backend. Meanwhile, use "Renewal Reminder" on a member to copy their link and send it by WhatsApp or SMS.</p>'}
        <div data-run-result></div>`;

      card.querySelectorAll('[data-fee]').forEach((btn) => {
        btn.onclick = async () => {
          const f = s.fees.find((x) => x.category === btn.dataset.fee);
          const ok = await openForm({
            title: `Edit fee: ${f.label}`,
            fields: [{ name: 'amount', label: 'Fee (LKR)', type: 'number', step: '0.01', min: 0, required: true }],
            values: { amount: f.amount },
            saveLabel: 'Save fee',
            confirmTitle: 'Change this fee?',
            confirmMessage: `The new ${f.label} fee shows on the website straight away and applies to new applications and renewals.`,
            submit: (fd) => api('PUT', `${BASE}/fees/${f.category}`, fd),
          });
          if (ok) { toast('Fee updated.'); load(); }
        };
      });

      card.querySelector('[data-edit-bank]').onclick = async () => {
        const ok = await openForm({
          title: 'Bank details: membership',
          fields: [
            { name: 'bank_name', label: 'Bank', required: true, half: true },
            { name: 'bank_branch', label: 'Branch', required: true, half: true },
            { name: 'bank_account_number', label: 'Account number', required: true, half: true },
            { name: 'bank_account_name', label: 'Account name', required: true, half: true },
          ],
          values: { bank_name: s.bank.bank_name, bank_branch: s.bank.branch, bank_account_number: s.bank.account_number, bank_account_name: s.bank.account_name },
          saveLabel: 'Save bank details',
          confirmTitle: 'Save these bank details?',
          confirmMessage: 'The new details show on the membership and renewal pages straight away.',
          submit: (fd) => api('PUT', `${BASE}/settings`, fd),
        });
        if (ok) { toast('Bank details saved.'); load(); }
      };

      card.querySelector('[data-edit-event-bank]').onclick = async () => {
        const b = s.event_bank;
        const ok = await openForm({
          title: 'Bank details: CPD events',
          fields: [
            { name: 'event_bank_name', label: 'Bank', required: true, half: true },
            { name: 'event_bank_branch', label: 'Branch', required: true, half: true },
            { name: 'event_bank_account_number', label: 'Account number', required: true, half: true },
            { name: 'event_bank_account_name', label: 'Account name', required: true, half: true },
          ],
          values: { event_bank_name: b.bank_name, event_bank_branch: b.branch, event_bank_account_number: b.account_number, event_bank_account_name: b.account_name },
          saveLabel: 'Save bank details',
          confirmTitle: 'Save these bank details?',
          confirmMessage: 'The new details show on paid CPD event pages and the registration form straight away.',
          submit: (fd) => api('PUT', `${BASE}/settings`, fd),
        });
        if (ok) { toast('Event bank details saved.'); load(); }
      };

      card.querySelector('[data-edit-renewals]').onclick = async () => {
        const ok = await openForm({
          title: 'Renewal settings',
          fields: [
            { name: 'membership_notice_days', label: 'First reminder (days before expiry)', type: 'number', min: 7, required: true, half: true, hint: 'Also when a member shows as "Renewal Due". 7 to 90 days.' },
            { name: 'membership_grace_days', label: 'Grace period (days after expiry)', type: 'number', min: 0, required: true, half: true, hint: 'How long they can still renew before they lapse.' },
          ],
          values: { membership_notice_days: s.notice_days, membership_grace_days: s.grace_days },
          saveLabel: 'Save renewal settings',
          confirmTitle: 'Save these renewal settings?',
          confirmMessage: 'Member statuses use the new values straight away; reminders follow them from the next daily run.',
          submit: (fd) => api('PUT', `${BASE}/settings`, fd),
        });
        if (ok) { toast('Renewal settings saved.'); load(); }
      };

      card.querySelector('[data-run]').onclick = async () => {
        if (!(await confirmDialog({ title: 'Send due reminders now?', message: 'Members whose reminder is due today and hasn\'t been sent will get it now. Members are never sent the same reminder twice.', confirmText: 'Send reminders' }))) return;
        const out = card.querySelector('[data-run-result]');
        out.innerHTML = '<p class="admin-muted">Running…</p>';
        try {
          const r = await api('POST', `${BASE}/reminders/run`);
          out.innerHTML = `<p class="callout" style="margin-top:12px">Checked ${r.checked} annual members: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed.</p>
            ${r.details.length ? `<ul class="history-list">${r.details.map((d) => `<li><strong>${esc(d.membership_number)}</strong> · ${esc(REMINDER_KINDS[d.kind] || d.kind)} · ${esc(d.status)}${d.detail ? ' · ' + esc(d.detail) : ''}</li>`).join('')}</ul>` : ''}`;
        } catch (err) {
          out.innerHTML = '';
          toast(err.message, true);
        }
      };
    }
    load();
  }

  // =====================================================================
  // Register
  // =====================================================================

  A.registerSection('applications', {
    label: 'Applications', sub: 'Review new members', render: renderApplications,
    intro: 'Review online applications: check the details, photo and payment slip, then approve, ask for more information or reject.',
  });
  A.registerSection('members', {
    label: 'Members', sub: 'Directory and renewals', render: renderMembers,
    intro: 'Every member, with their status worked out from their "valid until" date.',
  });
  A.registerSection('renewals', {
    label: 'Renewals', sub: 'Payments to verify', render: renderRenewals,
    intro: 'Renewal and upgrade payments submitted by members through their renewal link.',
  });
  A.registerSection('membership-settings', {
    label: 'Membership Settings', sub: 'Fees, bank, reminders', render: renderSettings,
    intro: 'Settings for membership fees, payment details and renewal reminders.',
  });
})();
