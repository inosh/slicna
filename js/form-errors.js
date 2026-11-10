// Shows form errors where they belong: under the field they are about (found
// by its label, e.g. "Mobile must be a valid Sri Lankan number" -> the
// "Mobile" field), with focus moved there. Messages that aren't about one
// field go into the form's message box, which gets focus instead.
// Used by the admin forms and the public application, renewal and event forms.
const SLICNA_FORM_ERRORS = (() => {
  const labelText = (label) => (label.childNodes[0] ? label.childNodes[0].textContent : '').trim();

  // The visible input whose label appears in the message (the longest label wins).
  function fieldFor(form, message) {
    const text = String(message || '').toLowerCase();
    let best = null;
    form.querySelectorAll('label[for]').forEach((label) => {
      const name = labelText(label).toLowerCase();
      const input = document.getElementById(label.htmlFor);
      if (name.length < 3 || !input || !form.contains(input) || input.closest('[hidden]') || input.disabled) return;
      if (text.includes(name) && (!best || name.length > best.name.length)) best = { name, input };
    });
    return best ? best.input : null;
  }

  function clearFieldError(field) {
    field.classList.remove('has-error');
    field.querySelectorAll('.field-error').forEach((m) => m.remove());
  }

  function clearAll(form) {
    form.querySelectorAll('.field.has-error').forEach(clearFieldError);
  }

  // Message under the input's field; it clears as soon as the input changes.
  function setFieldError(input, message) {
    const field = input.closest('.field');
    if (!field) return false;
    clearFieldError(field);
    field.classList.add('has-error');
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.textContent = message;
    field.appendChild(msg);
    const clear = () => clearFieldError(field);
    input.addEventListener('input', clear, { once: true });
    input.addEventListener('change', clear, { once: true });
    return true;
  }

  // Scrolls the element into the middle of the view (clear of the sticky menu) and focuses it.
  function focusOn(el) {
    if (!el) return;
    if (!el.matches('input, select, textarea, button, a[href]')) el.tabIndex = -1;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  // showError(form, box, message, { boxClass }): the field if one matches, else the box.
  function showError(form, box, message, { boxShow = (b, m) => { b.className = 'form-status is-error'; b.textContent = m; }, boxHide = (b) => { b.className = 'form-status'; b.textContent = ''; } } = {}) {
    const input = fieldFor(form, message);
    if (input && setFieldError(input, message)) {
      if (box) boxHide(box);
      focusOn(input);
      return input;
    }
    if (box) {
      boxShow(box, message);
      focusOn(box);
    }
    return box;
  }

  return { fieldFor, setFieldError, clearAll, focusOn, showError };
})();
