document.addEventListener('DOMContentLoaded', async () => {
  // Picking a tier pre-selects it in the application form.
  document.querySelectorAll('[data-choose]').forEach((link) => {
    link.addEventListener('click', () => { document.getElementById('a-category').value = link.dataset.choose; });
  });

  SLICNA_FORMS.bind('apply-form', 'apply-status', (data) => SLICNA_API.applyMembership(data),
    'Thank you. Your application has been received, and we will email you once the committee has reviewed it.', true);

  try {
    const fees = await SLICNA_API.fees();
    fees.forEach((fee) => {
      const el = document.querySelector(`[data-fee="${fee.key}"]`);
      if (!el || fee.amount == null) return;
      el.innerHTML = `LKR ${Number(fee.amount).toLocaleString('en-LK')}<small>${el.dataset.period}</small>`;
    });
  } catch (err) { /* prices stay as "Fee to be confirmed" */ }
});
