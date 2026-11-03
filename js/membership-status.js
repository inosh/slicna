// Application status lookup: reference number + NIC.
document.addEventListener('DOMContentLoaded', () => {
  const esc = SLICNA.escapeHtml;
  const form = document.getElementById('status-form');
  const errorEl = document.getElementById('status-error');
  const resultEl = document.getElementById('status-result');

  const LABELS = {
    pending: 'Received', under_review: 'Under review', more_info_required: 'More information needed',
    approved: 'Approved', rejected: 'Not approved',
  };
  const STAGE = { pending: 1, under_review: 2, more_info_required: 2, approved: 3, rejected: 3 };

  function render(s) {
    const stage = STAGE[s.status];
    const track = ['Received', 'Under review', s.status === 'rejected' ? 'Decision' : 'Approved']
      .map((label, i) => `<li class="${i < stage ? 'is-done' : ''}">${label}</li>`).join('');

    let body = '';
    if (s.status === 'approved') {
      body = `
        <div style="margin-top:24px">
          <p class="muted" style="margin-bottom:4px">Your membership number</p>
          <div class="member-number">${esc(s.membership_number)}</div>
          <p class="muted">${esc(s.category_label)} · ${s.valid_until ? 'valid until ' + esc(SLICNA.formatDate(s.valid_until)) : 'valid for life'}</p>
          ${s.valid_until ? '<p><a class="link-arrow" href="/pages/membership-renew.html">Renew later from the Renew membership page</a></p>' : ''}
        </div>`;
    }
    if (s.status_note) {
      const cls = s.status === 'more_info_required' || s.status === 'rejected' ? 'callout callout-warn' : 'callout';
      body += `<div class="${cls}" style="margin-top:20px"><strong>Message from SLICNA</strong><p style="margin:6px 0 0">${esc(s.status_note).replace(/\n/g, '<br>')}</p></div>`;
    }
    if (s.status === 'more_info_required') {
      body += `<p class="muted" style="margin-top:16px">Please reply by email to <a href="mailto:slicna2022@gmail.com?subject=${encodeURIComponent('Application ' + s.reference_number)}">slicna2022@gmail.com</a> quoting your reference number <strong>${esc(s.reference_number)}</strong>, or call 077 353 6178.</p>`;
    }

    resultEl.innerHTML = `
      <div class="status-card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <p class="muted" style="margin:0">${esc(s.reference_number)} · ${esc(s.category_label)}</p>
            <h2 style="font-size:26px;margin:4px 0 0">${esc(s.name_with_initials)}</h2>
          </div>
          <span class="status-chip status-${esc(s.status)}">${esc(LABELS[s.status])}</span>
        </div>
        <p style="margin:16px 0 0">${esc(s.status_message)}</p>
        <ol class="status-track">${track}</ol>
        ${body}
        <p class="muted" style="font-size:13.5px;margin-top:20px">Submitted on ${esc(SLICNA.formatDate(s.submitted_at))}</p>
      </div>`;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = form.reference.value.trim();
    const nic = form.nic.value.trim();
    errorEl.className = 'form-status';
    resultEl.innerHTML = '';
    if (!ref || !nic) {
      errorEl.className = 'form-status is-error';
      errorEl.textContent = 'Please enter both your reference number and NIC.';
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      render(await SLICNA_API.membershipStatus(ref, nic));
    } catch (err) {
      errorEl.className = 'form-status is-error';
      errorEl.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });

  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) {
    form.reference.value = ref;
    form.nic.focus();
  }
});
