// Shared form handling: required-field check, submit to the API, and a status message.
const SLICNA_FORMS = (() => {
  function showStatus(el, kind, message) {
    el.className = 'form-status ' + (kind === 'ok' ? 'is-ok' : 'is-error');
    el.textContent = message;
  }

  // submitFn receives a plain object, or FormData when asFormData is true (for file uploads).
  function bind(formId, statusId, submitFn, successMessage, asFormData = false) {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const missing = [...form.querySelectorAll('[required]')].find((f) => (f.type === 'checkbox' ? !f.checked : !f.value.trim()));
      if (missing) {
        showStatus(status, 'error', 'Please complete all required fields.');
        missing.focus();
        return;
      }

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      const formData = new FormData(form);
      const payload = asFormData ? formData : Object.fromEntries(formData.entries());

      try {
        await submitFn(payload);
        showStatus(status, 'ok', successMessage);
        form.reset();
      } catch (err) {
        const message = SLICNA_CONFIG.DATA_SOURCE === 'demo' || SLICNA_CONFIG.USE_DEMO_FALLBACK
          ? 'Preview mode: the website backend is not connected yet, so this form was not sent.'
          : 'Sorry, something went wrong. Please try again, or contact us by phone.';
        showStatus(status, 'error', message);
      } finally {
        button.disabled = false;
      }
    });
  }

  return { bind };
})();
