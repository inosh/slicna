// Admin: messages from the Contact page (as on SLNA). Tabs New / Read / All
// with counts, search, and a message window to read it, reply by email
// (the sender's message is quoted under the reply), mark it read or new, or
// delete it. As on SLNA, a message stays New until it's marked read (row or
// window button) or a reply is sent; just opening it changes nothing.
(() => {
  const A = window.SLICNA_ADMIN;
  const { api, esc, toast, confirmDialog, infoDialog, filterBar, query, fmtDateTime } = A;
  const BASE = '/contact/admin';

  const chip = (cls, label) => `<span class="status-chip status-${esc(cls)}">${esc(label)}</span>`;
  // As on SLNA: New / Read, and Replied / Not replied.
  const statusChips = (m) => (m.status === 'new' ? chip('pending', 'New') : chip('approved', 'Read'))
    + (m.replied_at ? chip('ongoing', 'Replied') : chip('lapsed', 'Not replied'));
  const preview = (text, n = 140) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

  function render(main) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-head"><div><h2>Contact messages</h2><p>Messages sent from the Contact page, newest first. Each new message is also emailed to the secretary.</p></div>
        <button type="button" class="btn btn-sky btn-sm" data-refresh>Refresh</button></div>
      <div data-filters></div>
      <div data-list></div>`;
    main.appendChild(card);
    const listEl = card.querySelector('[data-list]');
    const filters = filterBar(card.querySelector('[data-filters]'), {
      chipKey: 'status',
      // The same tabs as SLNA; Replied / Not replied shows in each row's status.
      chips: [['new', 'New'], ['read', 'Read'], ['all', 'All']],
      onChange: load,
    });
    card.querySelector('[data-search]').placeholder = 'Search name, email, phone or message…';
    let rows = [];

    async function updateCounts() {
      try {
        const c = await api('GET', `${BASE}/counts${query({ q: filters.q })}`);
        card.querySelectorAll('[data-chip]').forEach((b) => { b.textContent = `${b.dataset.label} (${c[b.dataset.chip] || 0})`; });
      } catch (err) { /* plain labels */ }
    }

    async function load() {
      listEl.innerHTML = '<p class="admin-muted">Loading…</p>';
      try {
        rows = await api('GET', `${BASE}/messages${query({ status: filters.status, q: filters.q })}`);
        updateCounts();
        listEl.innerHTML = rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table contact-table">
            <thead><tr><th>Received</th><th>From</th><th>Topic</th><th>Message</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>${rows.map((m) => `
              <tr class="is-clickable${m.status === 'new' ? ' is-unread' : ''}" data-id="${m.id}" tabindex="0">
                <td class="date-cell">${esc(fmtDateTime(m.created_at))}</td>
                <td class="from-col">${esc(m.full_name)}<div class="admin-muted">${esc(m.email)}</div>${m.phone ? `<div class="admin-muted">${esc(m.phone)}</div>` : ''}</td>
                <td>${esc(m.subject_label)}</td>
                <td class="main-col">${esc(preview(m.message))}</td>
                <td><div class="status-reg contact-status">${statusChips(m)}</div>${m.replied_at ? `<div class="admin-muted">${esc(fmtDateTime(m.replied_at))}</div>` : ''}</td>
                <td><div class="row-actions-stack">
                  <button type="button" class="btn btn-light btn-xs" data-row-act="toggle">${m.status === 'new' ? 'Mark as read' : 'Mark as new'}</button>
                  <button type="button" class="btn btn-danger btn-xs" data-row-act="delete">Delete</button>
                </div></td>
              </tr>`).join('')}</tbody>
          </table></div>` : `<p class="admin-empty">${filters.status === 'new' ? 'No new messages.' : 'No messages here.'}</p>`;
      } catch (err) {
        listEl.innerHTML = `<p class="admin-empty">${esc(err.message)}</p>`;
      }
    }
    const reload = () => { load(); A.refreshBadges(); };

    const open = (id) => openMessage(rows.find((r) => r.id === id), reload);
    // A row opens the message; its buttons mark it read / new or delete it (as on SLNA).
    listEl.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const m = rows.find((r) => r.id === Number(tr.dataset.id));
      const act = e.target.closest('[data-row-act]')?.dataset.rowAct;
      if (!act) return open(m.id);
      if (act === 'toggle' && await toggleRead(m)) reload();
      if (act === 'delete' && await deleteMessage(m)) reload();
    });
    listEl.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter' && !e.target.closest('[data-row-act]')) open(Number(tr.dataset.id)); });
    card.querySelector('[data-refresh]').onclick = reload;
    load();
  }

  async function setStatus(m, status) {
    const fd = new FormData();
    fd.append('status', status);
    return api('PATCH', `${BASE}/messages/${m.id}/status`, fd);
  }

  // New <-> read. Resolves true when changed.
  async function toggleRead(m) {
    const to = m.status === 'new' ? 'read' : 'new';
    try {
      Object.assign(m, await setStatus(m, to));
      toast(to === 'read' ? 'Marked as read.' : 'Marked as new.');
      return true;
    } catch (err) { toast(err.message, true); return false; }
  }

  async function deleteMessage(m) {
    if (!(await confirmDialog({ title: 'Delete this message?', message: `The message from ${m.full_name} will be deleted. This can't be undone.`, confirmText: 'Delete', danger: true }))) return false;
    try { await api('DELETE', `${BASE}/messages/${m.id}`); toast('Message deleted.'); return true; } catch (err) { toast(err.message, true); return false; }
  }

  // The message window: details, the full message, any earlier reply, and a reply box.
  // As on SLNA, opening a message doesn't change it: it stays New until it's marked
  // read or a reply is sent.
  async function openMessage(m, onChanged) {
    if (!m) return;
    const view = infoDialog({ title: `Message from ${m.full_name}` });
    const draw = () => {
      view.body.innerHTML = `
        <dl class="detail-list">
          <dt>From</dt><dd>${esc(m.full_name)}</dd>
          <dt>Email</dt><dd><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></dd>
          ${m.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(m.phone.replace(/[^\d+]/g, ''))}">${esc(m.phone)}</a></dd>` : ''}
          <dt>Topic</dt><dd>${esc(m.subject_label)}</dd>
          <dt>Received</dt><dd>${esc(fmtDateTime(m.created_at))}</dd>
          <dt>Status</dt><dd>${statusChips(m)}</dd>
        </dl>
        <h3 class="contact-h">Message</h3>
        <div class="contact-message">${esc(m.message)}</div>
        ${m.replied_at ? `
          <h3 class="contact-h">Your reply <span class="admin-muted">· ${esc(fmtDateTime(m.replied_at))}${m.replied_by_name ? ` by ${esc(m.replied_by_name)}` : ''}</span></h3>
          <div class="contact-message contact-reply">${esc(m.admin_reply)}</div>` : ''}
        <form class="contact-reply-form" novalidate>
          <label for="contact-reply-text" class="contact-h">${m.replied_at ? 'Reply again' : 'Reply by email'}</label>
          <textarea id="contact-reply-text" name="reply" rows="6" maxlength="10000" placeholder="Write your reply. It is emailed to ${esc(m.email)} with their message quoted underneath."></textarea>
          <p class="hint">${m.replied_at ? 'Sending again replaces the saved reply. ' : ''}When they reply to your email, it comes to ${esc('SLICNA\'s contact address')}.</p>
          <p class="field-error" data-error hidden></p>
          <div class="contact-actions">
            <button type="submit" class="btn btn-teal btn-sm">Send reply</button>
            <button type="button" class="btn btn-light btn-sm" data-mark>${m.status === 'new' ? 'Mark as read' : 'Mark as new'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>
          </div>
        </form>`;
      const formEl = view.body.querySelector('form');
      const errEl = view.body.querySelector('[data-error]');
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = formEl.reply.value.trim();
        errEl.hidden = true;
        if (!text) { errEl.textContent = 'Please write a reply first.'; errEl.hidden = false; formEl.reply.focus(); return; }
        if (!(await confirmDialog({ title: 'Send this reply?', message: `Your reply will be emailed to ${m.full_name} (${m.email}).`, confirmText: 'Send reply' }))) return;
        const btn = formEl.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
          const fd = new FormData();
          fd.append('reply', text);
          Object.assign(m, await api('POST', `${BASE}/messages/${m.id}/reply`, fd));
          toast('Reply sent.');
          onChanged();
          draw();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.hidden = false;
          btn.disabled = false;
        }
      });
      view.body.querySelector('[data-mark]').onclick = async () => {
        if (await toggleRead(m)) { onChanged(); draw(); }
      };
      view.body.querySelector('[data-delete]').onclick = async () => {
        if (await deleteMessage(m)) { onChanged(); view.close(); }
      };
    };
    draw();
  }

  A.registerSection('contact', { group: 'messages', label: 'Contact', sub: 'Messages from the Contact page', intro: 'Read and reply to messages sent from the website\'s Contact page.', render });
})();
