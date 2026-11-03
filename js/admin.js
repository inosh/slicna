// SLICNA admin panel.
// One reusable "resource panel" (list + add/edit form + delete) drives every
// content type; each section below only declares its fields and columns.
// Every save and delete asks for confirmation, and closing a form with
// unsaved changes asks before discarding them.
(() => {
  const TOKEN_KEY = 'slicna_admin_token';
  const USER_KEY = 'slicna_admin_user';
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.replace('/pages/admin-login.html');
    return;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CATEGORY_LABELS = { cpd: 'CPD programme', international: 'International', community: 'Community' };

  // ---------- Helpers ----------

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v) => {
    if (!v) return '';
    const d = new Date(String(v).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nextOrder = (rows) => (rows.length ? Math.max(...rows.map((r) => Number(r.display_order) || 0)) + 10 : 10);
  const thumb = (url) => (url ? `<img class="admin-thumb" src="${esc(SLICNA_API.mediaUrl(url))}" alt="">` : '<span class="admin-thumb-empty">No photo</span>');

  function logout(message) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.replace('/pages/admin-login.html' + (message ? '?' + message : ''));
  }

  // Authenticated API call. Expired sessions go back to the login page.
  async function api(method, path, body) {
    const headers = { Authorization: 'Bearer ' + token };
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    try {
      return await SLICNA_API.request(path, { method, headers, body });
    } catch (err) {
      if (err.status === 401) logout('expired=1');
      throw err;
    }
  }

  function toast(message, isError = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' is-error' : '');
    el.textContent = message;
    document.getElementById('toast-stack').appendChild(el);
    setTimeout(() => el.remove(), isError ? 6000 : 3500);
  }

  // ---------- Dialogs ----------

  // Dialogs are closed and removed directly (not via the "close" event, which
  // some browsers deliver late), and the caller's promise resolves at once.
  function makeDialog(className = '') {
    const dialog = document.createElement('dialog');
    dialog.className = 'admin-dialog ' + className;
    document.body.appendChild(dialog);
    return dialog;
  }

  function closeDialog(dialog) {
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  // Resolves true if the user confirms, false if they cancel or press Escape.
  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const dialog = makeDialog('admin-dialog-sm');
      dialog.innerHTML = `
        <div class="dialog-head"><h2>${esc(title)}</h2></div>
        <div class="dialog-body"><p class="confirm-message">${esc(message)}</p></div>
        <div class="dialog-foot">
          <button type="button" class="btn btn-light" data-answer="no">Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-teal'}" data-answer="yes">${esc(confirmText)}</button>
        </div>`;
      const finish = (answer) => {
        closeDialog(dialog);
        resolve(answer);
      };
      dialog.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-answer]');
        if (btn) finish(btn.dataset.answer === 'yes');
      });
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        finish(false);
      });
      dialog.showModal();
      dialog.querySelector('[data-answer="yes"]').focus();
    });
  }

  // ---------- Form fields ----------

  function fieldHtml(f, value) {
    const id = 'f-' + f.name;
    const req = f.required ? ' required' : '';
    const label = `<label for="${id}">${esc(f.label)}${f.required ? '' : ' <span class="opt">(optional)</span>'}</label>`;
    const hint = f.hint ? `<p class="hint">${esc(f.hint)}</p>` : '';
    const v = value ?? '';
    let input;
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${req}${f.max ? ` maxlength="${f.max}"` : ''}>${esc(v)}</textarea>`;
        break;
      case 'select':
        input = `<select id="${id}" name="${f.name}"${req}>${f.options.map(([val, text]) => `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
        break;
      case 'date':
        input = `<input id="${id}" name="${f.name}" type="date" value="${esc(String(v).slice(0, 10))}"${req}>`;
        break;
      case 'number':
        input = `<input id="${id}" name="${f.name}" type="number" step="${f.step || 1}"${f.min !== undefined ? ` min="${f.min}"` : ''} value="${esc(v)}"${req}>`;
        break;
      case 'files':
        input = `<input id="${id}" name="${f.name}" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif"${req} data-multi>
          <div class="photo-picks" data-picks></div>`;
        break;
      default:
        input = `<input id="${id}" name="${f.name}" type="text" value="${esc(v)}"${req}${f.max ? ` maxlength="${f.max}"` : ''}>`;
    }
    return `<div class="field${f.half ? '' : ' full'}">${label}${input}${hint}</div>`;
  }

  function imageFieldHtml(image, currentUrl) {
    return `
      <div class="field full">
        <label for="f-image">${esc(image.label)} <span class="opt">(optional)</span></label>
        <div class="image-field">
          <div class="image-preview" data-preview>${currentUrl ? `<img src="${esc(SLICNA_API.mediaUrl(currentUrl))}" alt="">` : 'No photo'}</div>
          <div>
            <input id="f-image" type="file" name="${image.field}" accept="image/jpeg,image/png,image/webp,image/gif">
            <p class="hint">JPEG, PNG, WEBP or GIF, under 15MB.${currentUrl ? ' Choosing a new photo replaces the current one.' : ''}</p>
            ${currentUrl && image.allowRemove !== false ? '<label class="consent" style="margin-top:8px"><input type="checkbox" name="remove_image" value="true"> Remove the current photo</label>' : ''}
          </div>
        </div>
      </div>`;
  }

  // Snapshot of every input, so we can tell whether the form has unsaved changes.
  function formState(form) {
    return JSON.stringify([...form.elements].filter((el) => el.name).map((el) => [el.name, el.type === 'file' ? el.files.length : el.type === 'checkbox' ? el.checked : el.value]));
  }

  // Opens the add/edit form. Resolves when the item was saved (true) or the form was closed (false).
  function openForm({ title, fields, image, values = {}, hidden = {}, saveLabel, confirmTitle, confirmMessage, submit }) {
    return new Promise((resolve) => {
      const dialog = makeDialog();
      dialog.innerHTML = `
        <form novalidate>
          <div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="dialog-close" data-close aria-label="Close">&times;</button></div>
          <div class="dialog-body">
            <div class="form-grid">
              ${fields.map((f) => fieldHtml(f, values[f.name])).join('')}
              ${image ? imageFieldHtml(image, values[image.column]) : ''}
            </div>
            <div class="form-error" hidden></div>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn btn-light" data-close>Cancel</button>
            <button type="submit" class="btn btn-coral">${esc(saveLabel)}</button>
          </div>
        </form>`;
      const form = dialog.querySelector('form');
      const errorEl = dialog.querySelector('.form-error');
      const initial = formState(form);
      let saved = false;

      // Multi-photo pickers show a thumbnail of each chosen photo.
      form.querySelectorAll('[data-multi]').forEach((input) => {
        input.addEventListener('change', () => {
          const picks = input.parentElement.querySelector('[data-picks]');
          const files = [...input.files];
          picks.innerHTML = files.length
            ? `<p class="hint">${files.length} photo${files.length > 1 ? 's' : ''} chosen. The first one becomes the album cover.</p>
               <div class="photo-pick-grid">${files.map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join('')}</div>`
            : '';
        });
      });

      const fileInput = form.querySelector('#f-image');
      if (fileInput) {
        fileInput.addEventListener('change', () => {
          const preview = form.querySelector('[data-preview]');
          const file = fileInput.files[0];
          preview.innerHTML = file ? `<img src="${URL.createObjectURL(file)}" alt="">` : (values[image.column] ? `<img src="${esc(SLICNA_API.mediaUrl(values[image.column]))}" alt="">` : 'No photo');
        });
      }

      async function requestClose() {
        if (formState(form) !== initial) {
          const discard = await confirmDialog({ title: 'Discard changes?', message: 'You have unsaved changes. If you close this form, they will be lost.', confirmText: 'Discard changes', danger: true });
          if (!discard) return;
        }
        finish();
      }

      function finish() {
        closeDialog(dialog);
        resolve(saved);
      }

      dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) requestClose(); });
      // Escape asks first too, instead of closing straight away.
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); requestClose(); });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;
        const missing = [...form.querySelectorAll('[required]')].find((el) => (el.type === 'file' ? !el.files.length : !el.value.trim()));
        if (missing) {
          const label = form.querySelector(`label[for="${missing.id}"]`).childNodes[0].textContent.trim();
          errorEl.textContent = missing.type === 'file' ? `Please choose at least one photo for "${label}".` : `Please fill in "${label}".`;
          errorEl.hidden = false;
          missing.focus();
          return;
        }
        const message = typeof confirmMessage === 'function' ? confirmMessage(new FormData(form)) : confirmMessage;
        if (!(await confirmDialog({ title: confirmTitle, message, confirmText: saveLabel }))) return;

        const data = new FormData(form);
        if (fileInput && !fileInput.files.length) data.delete(fileInput.name);
        Object.entries(hidden).forEach(([k, v]) => data.set(k, v));

        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          await submit(data);
          saved = true;
          finish();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        } finally {
          button.disabled = false;
        }
      });

      dialog.showModal();
      const first = form.querySelector('input:not([type="hidden"]), textarea, select');
      if (first) first.focus();
    });
  }

  // ---------- Reusable list panel ----------
  // config: { title, intro, endpoint, singular, nameOf(row), columns: [{ label, html(row), main }],
  //           fields, addOnlyFields (shown only when adding), image, load(), defaults(rows), hidden,
  //           summary(rows), rowActions: [{ label, onClick(row) }], emptyText, addLabel }

  function resourcePanel(container, config) {
    const card = document.createElement('section');
    card.className = 'admin-card';
    container.appendChild(card);
    let rows = [];
    let selectedId = null;

    const load = config.load || (() => api('GET', config.endpoint));

    function render() {
      const hasImage = !!config.image;
      card.innerHTML = `
        <div class="admin-card-head">
          <div><h2>${esc(config.title)}</h2>${config.intro ? `<p>${esc(config.intro)}</p>` : ''}</div>
          <button type="button" class="btn btn-coral btn-sm" data-add>${esc(config.addLabel || 'Add ' + config.singular)}</button>
        </div>
        ${config.summary ? `<div class="admin-summary">${config.summary(rows)}</div>` : ''}
        ${rows.length ? `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr>${hasImage ? '<th></th>' : ''}${config.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
            <tbody>${rows.map((r) => `
              <tr data-id="${r.id}"${r.id === selectedId ? ' class="is-selected"' : ''}>
                ${hasImage ? `<td>${thumb(r[config.image.column])}</td>` : ''}
                ${config.columns.map((c) => `<td${c.main ? ' class="main-col"' : ''}>${c.html(r)}</td>`).join('')}
                <td><div class="row-actions">
                  ${(config.rowActions || []).map((a, i) => `<button type="button" class="btn btn-light btn-sm" data-extra="${i}">${esc(a.label)}</button>`).join('')}
                  <button type="button" class="btn btn-light btn-sm" data-edit>Edit</button>
                  <button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<p class="admin-empty">${esc(config.emptyText || 'Nothing here yet.')}</p>`}`;
    }

    async function reload() {
      try {
        rows = await load();
        render();
      } catch (err) {
        card.innerHTML = `<p class="admin-empty">Could not load ${esc(config.title.toLowerCase())}: ${esc(err.message)}</p>`;
      }
      if (config.onReload) config.onReload(rows);
    }

    const nameOf = (r) => (config.nameOf ? config.nameOf(r) : r.title || r.name || 'this item');

    card.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      const row = tr && rows.find((r) => String(r.id) === tr.dataset.id);

      if (e.target.closest('[data-add]')) {
        const ok = await openForm({
          title: 'Add ' + config.singular,
          fields: [...config.fields, ...(config.addOnlyFields || [])],
          image: config.image,
          values: config.defaults ? config.defaults(rows) : {},
          hidden: config.hidden || {},
          saveLabel: 'Add ' + config.singular,
          confirmTitle: 'Add this ' + config.singular + '?',
          confirmMessage: 'It will appear on the public website straight away.',
          submit: (data) => api('POST', config.endpoint, data),
        });
        if (ok) { toast(capital(config.singular) + ' added.'); reload(); }
      } else if (row && e.target.closest('[data-edit]')) {
        const ok = await openForm({
          title: 'Edit ' + config.singular,
          fields: config.fields,
          image: config.image,
          values: row,
          hidden: config.hidden || {},
          saveLabel: 'Save changes',
          confirmTitle: 'Save changes?',
          confirmMessage: `Your changes to "${nameOf(row)}" will appear on the public website straight away.`,
          submit: (data) => api('PUT', `${config.endpoint}/${row.id}`, data),
        });
        if (ok) { toast('Changes saved.'); reload(); }
      } else if (row && e.target.closest('[data-delete]')) {
        const ok = await confirmDialog({
          title: 'Delete ' + config.singular + '?',
          message: `"${nameOf(row)}" will be removed from the website${config.deleteNote ? '\n\n' + config.deleteNote : ''}.\n\nThis cannot be undone.`,
          confirmText: 'Delete',
          danger: true,
        });
        if (!ok) return;
        try {
          await api('DELETE', `${config.endpoint}/${row.id}`);
          toast(capital(config.singular) + ' deleted.');
          if (config.onDelete) config.onDelete(row);
          reload();
        } catch (err) {
          toast(err.message, true);
        }
      } else if (row && e.target.closest('[data-extra]')) {
        selectedId = row.id;
        render();
        config.rowActions[Number(e.target.closest('[data-extra]').dataset.extra)].onClick(row);
      }
    });

    reload();
    return { reload, rows: () => rows, select(id) { selectedId = id; render(); } };
  }

  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const orderField = { name: 'display_order', label: 'Display order', type: 'number', hint: 'Lower numbers appear first.', half: true };

  // ---------- Sections ----------

  const SECTIONS = {
    news: {
      label: 'News', sub: 'Articles and announcements',
      render(main) {
        resourcePanel(main, {
          title: 'News articles', intro: 'Shown on the News page, newest first; the latest four appear on the home page.',
          endpoint: '/news', singular: 'news article',
          columns: [
            { label: 'Date', html: (r) => esc(fmtDate(r.published_at)) },
            { label: 'Title', html: (r) => esc(r.title), main: true },
          ],
          image: { column: 'photo_url', field: 'photo', label: 'Cover photo' },
          defaults: () => ({ published_at: today() }),
          fields: [
            { name: 'title', label: 'Title', required: true, max: 300 },
            { name: 'published_at', label: 'Published date', type: 'date', required: true, half: true },
            { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, max: 1000, hint: 'One or two sentences shown on news cards.' },
            { name: 'body', label: 'Full article', type: 'textarea', rows: 10, max: 50000, hint: 'Leave a blank line between paragraphs.' },
          ],
        });
      },
    },

    events: {
      label: 'Events & CPD', sub: 'All events and CPD points',
      render(main) {
        resourcePanel(main, {
          title: 'Events', intro: 'Every event appears on the Events page. Events with CPD points also appear on the CPD page, where the totals are calculated automatically.',
          endpoint: '/events', singular: 'event',
          load: async () => (await api('GET', '/events')).sort((a, b) => b.event_date.localeCompare(a.event_date)),
          summary(rows) {
            const year = new Date().getFullYear();
            const cpd = rows.filter((r) => r.cpd_points != null && r.event_date.startsWith(String(year)));
            const total = cpd.reduce((s, r) => s + Number(r.cpd_points), 0);
            const upcoming = rows.filter((r) => (r.end_date || r.event_date) >= today()).length;
            return `<span>${year}: <b>${cpd.length}</b> CPD programmes, <b>${Number(total.toFixed(2))}</b> CPD points</span><span><b>${upcoming}</b> upcoming events</span>`;
          },
          columns: [
            { label: 'Date', html: (r) => esc(fmtDate(r.event_date)) + (r.end_date ? ' – ' + esc(fmtDate(r.end_date)) : '') },
            { label: 'Event', html: (r) => esc(r.title), main: true },
            { label: 'Type', html: (r) => `<span class="${r.category === 'cpd' ? 'tag-teal' : r.category === 'international' ? 'tag-gold' : 'tag'}">${esc(CATEGORY_LABELS[r.category])}</span>` },
            { label: 'CPD pts', html: (r) => (r.cpd_points != null ? esc(Number(r.cpd_points).toFixed(2)) : '—') },
          ],
          image: { column: 'photo_url', field: 'photo', label: 'Poster or photo' },
          defaults: () => ({ category: 'cpd' }),
          fields: [
            { name: 'title', label: 'Title', required: true, max: 300 },
            { name: 'category', label: 'Type', type: 'select', required: true, half: true, options: [['cpd', 'CPD programme'], ['international', 'International workshop'], ['community', 'Community event']] },
            { name: 'cpd_points', label: 'CPD points', type: 'number', step: '0.25', min: 0, half: true, hint: 'Leave empty if the event has no CPD points.' },
            { name: 'event_date', label: 'Date', type: 'date', required: true, half: true },
            { name: 'end_date', label: 'End date', type: 'date', half: true, hint: 'Only for events over several days.' },
            { name: 'time_text', label: 'Time', max: 100, half: true, hint: 'For example: 8.00 a.m. – 4.00 p.m.' },
            { name: 'location', label: 'Venue', max: 300, half: true },
            { name: 'summary', label: 'Summary', type: 'textarea', rows: 3, max: 1000 },
            { name: 'body', label: 'Details', type: 'textarea', rows: 6, max: 20000, hint: 'Shown on the event page. Leave a blank line between paragraphs.' },
          ],
        });
      },
    },

    leadership: {
      label: 'Leadership', sub: 'Executive committee',
      render(main) {
        const settingsCard = document.createElement('section');
        settingsCard.className = 'admin-card';
        main.appendChild(settingsCard);

        async function renderSettings() {
          let data = {};
          try { data = await api('GET', '/committee'); } catch (err) { toast(err.message, true); }
          settingsCard.innerHTML = `
            <div class="admin-card-head">
              <div><h2>Committee term</h2><p>Shown above the committee on the Leadership page.</p></div>
              <button type="button" class="btn btn-light btn-sm" data-edit-term>Edit term</button>
            </div>
            <p>${data.term_start_year ? `Executive Committee <b>${esc(data.term_start_year)} – ${esc(data.term_end_year)}</b>${data.elected_on ? `, elected on <b>${esc(fmtDate(data.elected_on))}</b>` : ''}.` : '<span class="admin-muted">No term set yet.</span>'}</p>`;
          settingsCard.querySelector('[data-edit-term]').onclick = async () => {
            const ok = await openForm({
              title: 'Edit committee term',
              values: data,
              fields: [
                { name: 'term_start_year', label: 'Term starts (year)', type: 'number', required: true, half: true },
                { name: 'term_end_year', label: 'Term ends (year)', type: 'number', required: true, half: true },
                { name: 'elected_on', label: 'Election date', type: 'date', half: true },
              ],
              saveLabel: 'Save term',
              confirmTitle: 'Save committee term?',
              confirmMessage: 'The new term will appear on the Leadership page straight away.',
              submit: (fd) => api('PUT', '/committee/settings', fd),
            });
            if (ok) { toast('Committee term saved.'); renderSettings(); }
          };
        }
        renderSettings();

        resourcePanel(main, {
          title: 'Committee members', intro: 'Shown in display order; the first three form the top row.',
          endpoint: '/committee/members', singular: 'committee member',
          load: async () => (await api('GET', '/committee')).members,
          nameOf: (r) => `${r.role_title}: ${r.name}`,
          columns: [
            { label: 'Order', html: (r) => esc(r.display_order) },
            { label: 'Position', html: (r) => esc(r.role_title) },
            { label: 'Name', html: (r) => esc(r.name), main: true },
          ],
          image: { column: 'photo_url', field: 'photo', label: 'Photo' },
          defaults: (rows) => ({ display_order: nextOrder(rows) }),
          fields: [
            { name: 'role_title', label: 'Position', required: true, max: 100, half: true, hint: 'For example: President' },
            { name: 'name', label: 'Name', required: true, max: 255, half: true },
            { name: 'designation', label: 'Designation', max: 150, half: true, hint: 'For example: Nursing Officer, NHSL' },
            orderField,
          ],
        });
      },
    },

    about: {
      label: 'About page', sub: 'Milestones and photo',
      render(main) {
        const photoCard = document.createElement('section');
        photoCard.className = 'admin-card';
        main.appendChild(photoCard);

        async function renderPhoto() {
          let settings = {};
          try { settings = await api('GET', '/settings'); } catch (err) { toast(err.message, true); }
          const url = settings.about_journey_photo;
          photoCard.innerHTML = `
            <div class="admin-card-head"><div><h2>"Our journey" photo</h2><p>Shown beside the milestones timeline on the About page.</p></div></div>
            <div class="image-field">
              <div class="image-preview">${url ? `<img src="${esc(SLICNA_API.mediaUrl(url))}" alt="">` : 'No photo'}</div>
              <div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file>
                <p class="hint admin-muted">Choose a new photo to replace the current one.</p>
                <button type="button" class="btn btn-teal btn-sm" data-upload disabled style="margin-top:10px">Replace photo</button>
              </div>
            </div>`;
          const input = photoCard.querySelector('[data-file]');
          const button = photoCard.querySelector('[data-upload]');
          input.onchange = () => {
            button.disabled = !input.files.length;
            if (input.files[0]) photoCard.querySelector('.image-preview').innerHTML = `<img src="${URL.createObjectURL(input.files[0])}" alt="">`;
          };
          button.onclick = async () => {
            if (!(await confirmDialog({ title: 'Replace photo?', message: 'The new photo will replace the current one on the About page straight away.', confirmText: 'Replace photo' }))) return;
            const fd = new FormData();
            fd.append('photo', input.files[0]);
            button.disabled = true;
            try {
              await api('PUT', '/settings/images/about_journey_photo', fd);
              toast('Photo replaced.');
              renderPhoto();
            } catch (err) {
              toast(err.message, true);
              button.disabled = false;
            }
          };
        }
        renderPhoto();

        resourcePanel(main, {
          title: 'Achievements and milestones', intro: 'The "Our journey" timeline on the About page, in display order.',
          endpoint: '/milestones', singular: 'milestone',
          columns: [
            { label: 'Order', html: (r) => esc(r.display_order) },
            { label: 'Year / label', html: (r) => esc(r.year_label) },
            { label: 'Milestone', html: (r) => esc(r.title), main: true },
          ],
          defaults: (rows) => ({ display_order: nextOrder(rows) }),
          fields: [
            { name: 'year_label', label: 'Year or label', required: true, max: 40, half: true, hint: 'A year (2022) or a word (Global, Award).' },
            orderField,
            { name: 'title', label: 'Title', required: true, max: 200 },
            { name: 'description', label: 'Description', type: 'textarea', rows: 3, max: 2000 },
          ],
        });
      },
    },

    community: {
      label: 'Community page', sub: 'Sections, photos and cards',
      render(main) {
        const STYLE_LABELS = { feature: 'Photo grid', highlight: 'Dark band', cards: 'Cards' };
        const itemsHost = document.createElement('div');
        let sectionsPanel;

        function showItems(section) {
          itemsHost.innerHTML = '';
          const isCards = section.style === 'cards';
          resourcePanel(itemsHost, {
            title: (isCards ? 'Cards in: ' : 'Photos in: ') + section.title,
            intro: isCards
              ? 'Each card shows a photo, a small label (such as a date), a title and a short text.'
              : section.style === 'highlight' ? 'The first photo is shown beside the text.' : 'The first photo is shown large; the next ones in a grid below it.',
            endpoint: '/community/items', singular: isCards ? 'card' : 'photo',
            load: async () => (await api('GET', '/community')).find((s) => s.id === section.id)?.items || [],
            nameOf: (r) => r.title || r.label || 'this ' + (isCards ? 'card' : 'photo'),
            hidden: { section_id: section.id },
            columns: [
              { label: 'Order', html: (r) => esc(r.display_order) },
              ...(isCards ? [{ label: 'Label', html: (r) => esc(r.label) }] : []),
              { label: isCards ? 'Title' : 'Description', html: (r) => esc(r.title), main: true },
            ],
            image: { column: 'image_url', field: 'image', label: 'Photo' },
            defaults: (rows) => ({ display_order: nextOrder(rows) }),
            fields: isCards ? [
              { name: 'label', label: 'Label', max: 100, half: true, hint: 'For example: a date, or "Radio programme".' },
              orderField,
              { name: 'title', label: 'Title', max: 200 },
              { name: 'text', label: 'Text', type: 'textarea', rows: 3, max: 2000 },
            ] : [
              { name: 'title', label: 'Description', max: 200, half: true, hint: 'Describes the photo for people using screen readers.' },
              orderField,
            ],
          });
          itemsHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        sectionsPanel = resourcePanel(main, {
          title: 'Page sections', intro: 'The sections of the Community page, in display order. Use "Photos / cards" to manage what each section shows.',
          endpoint: '/community/sections', singular: 'section',
          load: async () => (await api('GET', '/community')),
          deleteNote: 'along with all of its photos and cards',
          onDelete: () => { itemsHost.innerHTML = ''; },
          columns: [
            { label: 'Order', html: (r) => esc(r.display_order) },
            { label: 'Section', html: (r) => esc(r.title) + (r.eyebrow ? `<div class="admin-muted">${esc(r.eyebrow)}</div>` : ''), main: true },
            { label: 'Layout', html: (r) => esc(STYLE_LABELS[r.style]) },
            { label: 'Items', html: (r) => esc((r.items || []).length) },
          ],
          rowActions: [{ label: 'Photos / cards', onClick: showItems }],
          image: { column: 'logo_url', field: 'logo', label: 'Logo (photo grid layout only)' },
          defaults: (rows) => ({ style: 'feature', display_order: nextOrder(rows) }),
          fields: [
            { name: 'style', label: 'Layout', type: 'select', required: true, half: true, options: [['feature', 'Photo grid: text and bullets beside a grid of photos'], ['highlight', 'Dark band: one photo beside the text'], ['cards', 'Cards: a heading with a grid of cards']] },
            orderField,
            { name: 'eyebrow', label: 'Small heading', max: 100, half: true, hint: 'The short line above the title.' },
            { name: 'title', label: 'Title', required: true, max: 200 },
            { name: 'body', label: 'Text', type: 'textarea', rows: 4, max: 5000 },
            { name: 'bullet_points', label: 'Bullet points', type: 'textarea', rows: 3, max: 3000, hint: 'One per line.' },
            { name: 'link_text', label: 'Link text', max: 100, half: true, hint: 'Cards layout: a link shown beside the heading.' },
            { name: 'link_url', label: 'Link address', max: 300, half: true, hint: 'For example: /pages/events.html' },
          ],
        });
        main.appendChild(itemsHost);
      },
    },

    gallery: {
      label: 'Gallery', sub: 'Albums and photos',
      render(main) {
        const photosHost = document.createElement('div');
        let albumsPanel;

        async function showPhotos(album) {
          photosHost.innerHTML = '';
          const card = document.createElement('section');
          card.className = 'admin-card';
          photosHost.appendChild(card);

          async function render() {
            const current = (await api('GET', '/albums')).find((a) => a.id === album.id);
            if (!current) { photosHost.innerHTML = ''; return; }
            card.innerHTML = `
              <div class="admin-card-head"><div><h2>Photos in: ${esc(current.title)}</h2><p>The first photo is the album cover. Lower order numbers appear first.</p></div></div>
              <div class="upload-row">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" data-files>
                <button type="button" class="btn btn-coral btn-sm" data-upload disabled>Upload photos</button>
              </div>
              ${current.photos.length ? `<div class="photo-grid">${current.photos.map((p) => `
                <div class="photo-tile" data-photo="${p.id}">
                  <img src="${esc(SLICNA_API.mediaUrl(p.url))}" alt="" loading="lazy">
                  <div class="photo-tile-body">
                    <input type="text" data-caption value="${esc(p.caption)}" placeholder="Caption" maxlength="300" aria-label="Caption">
                    <input type="number" data-order value="${esc(p.display_order)}" aria-label="Display order" title="Display order">
                    <div class="row-actions">
                      <button type="button" class="btn btn-light btn-sm" data-save-photo>Save</button>
                      <button type="button" class="btn btn-danger btn-sm" data-delete-photo>Delete</button>
                    </div>
                  </div>
                </div>`).join('')}</div>` : '<p class="admin-empty">No photos yet. Upload some above.</p>'}`;

            const files = card.querySelector('[data-files]');
            const upload = card.querySelector('[data-upload]');
            files.onchange = () => {
              upload.disabled = !files.files.length;
              upload.textContent = files.files.length ? `Upload ${files.files.length} photo${files.files.length > 1 ? 's' : ''}` : 'Upload photos';
            };
            upload.onclick = async () => {
              const n = files.files.length;
              if (!(await confirmDialog({ title: `Upload ${n} photo${n > 1 ? 's' : ''}?`, message: `They will be added to "${current.title}" and appear in the gallery straight away.`, confirmText: 'Upload' }))) return;
              const fd = new FormData();
              [...files.files].forEach((f) => fd.append('photos', f));
              upload.disabled = true;
              upload.textContent = 'Uploading…';
              try {
                await api('POST', `/albums/${current.id}/photos`, fd);
                toast(`${n} photo${n > 1 ? 's' : ''} added.`);
                albumsPanel.reload();
                render();
              } catch (err) {
                toast(err.message, true);
                upload.disabled = false;
                upload.textContent = 'Upload photos';
              }
            };
          }

          card.addEventListener('click', async (e) => {
            const tile = e.target.closest('[data-photo]');
            if (!tile) return;
            const id = tile.dataset.photo;
            if (e.target.closest('[data-save-photo]')) {
              if (!(await confirmDialog({ title: 'Save photo details?', message: 'The caption and order will update in the gallery straight away.', confirmText: 'Save' }))) return;
              const fd = new FormData();
              fd.append('caption', tile.querySelector('[data-caption]').value);
              fd.append('display_order', tile.querySelector('[data-order]').value);
              try {
                await api('PUT', `/albums/photos/${id}`, fd);
                toast('Photo details saved.');
                render();
              } catch (err) {
                toast(err.message, true);
              }
            } else if (e.target.closest('[data-delete-photo]')) {
              if (!(await confirmDialog({ title: 'Delete photo?', message: 'This photo will be removed from the gallery.\n\nThis cannot be undone.', confirmText: 'Delete', danger: true }))) return;
              try {
                await api('DELETE', `/albums/photos/${id}`);
                toast('Photo deleted.');
                albumsPanel.reload();
                render();
              } catch (err) {
                toast(err.message, true);
              }
            }
          });

          await render();
          photosHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        albumsPanel = resourcePanel(main, {
          title: 'Albums', intro: 'Albums appear as filters on the Gallery page, in display order. Use "Photos" to add or remove an album\'s photos.',
          endpoint: '/albums', singular: 'album',
          deleteNote: 'along with all of its photos',
          onDelete: () => { photosHost.innerHTML = ''; },
          columns: [
            { label: 'Cover', html: (r) => thumb(r.cover_photo) },
            { label: 'Order', html: (r) => esc(r.display_order) },
            { label: 'Album', html: (r) => esc(r.title), main: true },
            { label: 'Photos', html: (r) => esc((r.photos || []).length) },
          ],
          rowActions: [{ label: 'Photos', onClick: showPhotos }],
          defaults: (rows) => ({ display_order: nextOrder(rows) }),
          fields: [
            { name: 'title', label: 'Title', required: true, max: 200 },
            { name: 'event_date', label: 'Date', type: 'date', half: true },
            orderField,
            { name: 'description', label: 'Description', type: 'textarea', rows: 3, max: 2000 },
          ],
          addOnlyFields: [
            { name: 'photos', label: 'Photos', type: 'files', required: true, hint: 'Choose up to 30 photos (JPEG, PNG, WEBP or GIF, under 15MB each). You can add more later with the Photos button.' },
          ],
        });
        main.appendChild(photosHost);
      },
    },
  };

  // ---------- Private files (photos, slips) ----------

  // Private membership files need the login token, so they're fetched as
  // blobs and shown through temporary object URLs instead of plain links.
  async function apiBlob(path) {
    const res = await fetch(SLICNA_CONFIG.API_BASE_URL.replace(/\/+$/, '') + path, { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 401) logout('expired=1');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load the file.');
    }
    return res.blob();
  }

  async function openPrivateFile(path) {
    const win = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await apiBlob(path));
      if (win) win.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.close();
      toast(err.message, true);
    }
  }

  async function downloadPrivateFile(path, filename) {
    try {
      const url = URL.createObjectURL(await apiBlob(path));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast(err.message, true);
    }
  }

  // A read-only dialog (details, previews). Returns { dialog, body, close }.
  function infoDialog({ title, wide = true, onClose }) {
    const dialog = makeDialog(wide ? 'admin-dialog-wide' : '');
    dialog.innerHTML = `
      <div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="dialog-close" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body"></div>`;
    const close = () => {
      closeDialog(dialog);
      if (onClose) onClose();
    };
    dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dialog.showModal();
    return { dialog, body: dialog.querySelector('.dialog-body'), close };
  }

  // ---------- Shell: navigation, user menu, password ----------

  const GROUPS = { membership: 'Membership', content: 'Website content' };
  Object.values(SECTIONS).forEach((s) => { s.group = s.group || 'content'; });

  // Lets js/admin-membership.js add its sections before the page starts.
  window.SLICNA_ADMIN = {
    api, apiBlob, openPrivateFile, downloadPrivateFile, esc, fmtDate, today, toast, confirmDialog, openForm, infoDialog,
    resourcePanel, thumb,
    registerSection(key, section) { SECTIONS[key] = { group: 'membership', ...section }; },
    refreshBadges: () => refreshBadges(),
  };

  function show(key) {
    const firstKey = Object.keys(SECTIONS).find((k) => SECTIONS[k].group === 'membership') || 'news';
    if (!SECTIONS[key]) key = firstKey;
    const section = SECTIONS[key];
    document.querySelectorAll('#admin-nav button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.key === key)));
    const main = document.getElementById('admin-main');
    main.innerHTML = `<h1>${esc(section.label)}</h1><p class="admin-intro">${esc(section.intro || 'Changes you save here appear on the public website straight away.')}</p>`;
    section.render(main);
    history.replaceState(null, '', '#' + key);
  }

  function renderNav() {
    const nav = document.getElementById('admin-nav');
    nav.innerHTML = Object.entries(GROUPS).map(([group, label]) => {
      const items = Object.entries(SECTIONS).filter(([, s]) => s.group === group);
      if (!items.length) return '';
      return `<p class="admin-nav-group">${esc(label)}</p>` + items.map(([key, s]) =>
        `<button type="button" data-key="${key}">${esc(s.label)}<span class="nav-badge" data-badge="${key}" hidden></span><small>${esc(s.sub)}</small></button>`).join('');
    }).join('');
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-key]');
      if (btn) show(btn.dataset.key);
    });
  }

  // Counts of work waiting (new applications, renewals to verify) beside the nav items.
  async function refreshBadges() {
    try {
      const o = await api('GET', '/membership/admin/overview');
      const set = (key, n) => {
        const el = document.querySelector(`[data-badge="${key}"]`);
        if (!el) return;
        el.textContent = n;
        el.hidden = !n;
      };
      set('applications', (o.applications.pending || 0) + (o.applications.under_review || 0));
      set('renewals', o.pending_renewals);
    } catch (err) { /* badges are optional */ }
  }

  try {
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
    if (user.username) document.getElementById('admin-user').textContent = `Signed in as ${user.username}`;
  } catch (err) { /* ignore */ }

  document.getElementById('logout-btn').onclick = async () => {
    if (await confirmDialog({ title: 'Log out?', message: 'You will need to log in again to make changes.', confirmText: 'Log out' })) logout();
  };

  document.getElementById('change-password-btn').onclick = () => {
    openForm({
      title: 'Change password',
      fields: [
        { name: 'currentPassword', label: 'Current password', required: true },
        { name: 'newPassword', label: 'New password', required: true, hint: 'At least 8 characters.' },
        { name: 'confirmPassword', label: 'Repeat new password', required: true },
      ],
      saveLabel: 'Change password',
      confirmTitle: 'Change your password?',
      confirmMessage: 'Use the new password next time you log in.',
      async submit(fd) {
        const data = Object.fromEntries(fd.entries());
        if (data.newPassword !== data.confirmPassword) throw new Error('The new passwords do not match.');
        await api('POST', '/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      },
    }).then((ok) => { if (ok) toast('Password changed.'); });
    // Password inputs: switch the generated text inputs to password type.
    document.querySelectorAll('dialog [name$="assword"]').forEach((el) => { el.type = 'password'; });
  };

  // Start once every admin script (including admin-membership.js) has registered its sections.
  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    show(window.location.hash.slice(1));
    refreshBadges();
  });
})();
