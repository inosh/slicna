// Application status lookup: reference number + NIC.
document.addEventListener('DOMContentLoaded', () => {
  const esc = SLICNA.escapeHtml;
  const form = document.getElementById('status-form');
  const errorEl = document.getElementById('status-error');
  const resultEl = document.getElementById('status-result');

  const LABELS = {
    pending: 'Received', more_info_required: 'More information needed',
    approved: 'Approved', rejected: 'Not approved',
  };

  // Received -> Approved / Not approved; "More info needed" appears in between only when it applies.
  function trackSteps(status) {
    const last = status === 'rejected' ? 'Not approved' : 'Approved';
    if (status === 'more_info_required') return { labels: ['Received', 'More info needed', last], done: 2 };
    return { labels: ['Received', last], done: status === 'pending' ? 1 : 2 };
  }

  function render(s) {
    const { labels, done } = trackSteps(s.status);
    const track = labels.map((label, i) => `<li class="${i < done ? 'is-done' : ''}">${label}</li>`).join('');

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
    // Same sentence as in the email; the secretary's email and phone become links.
    if (s.follow_up) {
      const f = s.follow_up;
      let html = esc(f.message)
        .replace(esc(f.email), `<a href="mailto:${esc(f.email)}?subject=${encodeURIComponent('Application ' + s.reference_number)}">${esc(f.email)}</a>`)
        .replace(esc(s.reference_number), `<strong>${esc(s.reference_number)}</strong>`);
      if (f.phone_display) html = html.replace(esc(f.phone_display), `<a href="tel:${esc(f.phone)}">${esc(f.phone_display)}</a>`);
      body += `<p class="muted" style="margin-top:16px">${html}</p>`;
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
