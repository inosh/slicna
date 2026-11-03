// Shared by the membership pages: category descriptions, fee and bank
// rendering, copy buttons and file previews.
const SLICNA_MEMBERSHIP = (() => {
  const esc = (v) => SLICNA.escapeHtml(v);

  const CATEGORIES = {
    LT: {
      name: 'Lifetime Membership', short: 'Lifetime',
      who: 'Nurses with a Post Basic College of Nursing (PBCN) ICU diploma or certificate, or more than 10 years continuously in intensive care.',
      needs: 'Your PBCN details or ICU experience. No recommendation needed.',
      endorsement: null,
    },
    GM: {
      name: 'General Membership', short: 'General',
      who: 'Nurses working in a government hospital intensive care unit.',
      needs: 'A recommendation signed by a SLICNA Lifetime member.',
      endorsement: 'lt',
    },
    OM: {
      name: 'Ordinary Membership', short: 'Ordinary',
      who: 'Nurses employed at any government hospital.',
      needs: 'A recommendation signed by a SLICNA Lifetime member.',
      endorsement: 'lt',
    },
    PM: {
      name: 'Partial Membership', short: 'Partial',
      who: 'Nursing students at a nursing school or university.',
      needs: 'A letter certified by your nursing school or university.',
      endorsement: 'institution',
    },
  };
  const ORDER = ['LT', 'GM', 'OM', 'PM'];

  const money = (amount) => 'LKR ' + Number(amount).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const period = (fee) => (fee.is_annual ? 'per year' : 'one-time');

  function bankBox(bank, reference) {
    const row = (label, value) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd><button type="button" class="copy-btn" data-copy="${esc(value)}">Copy</button>`;
    return `
      <div class="bank-box">
        <dl>
          ${row('Bank', bank.bank_name)}
          ${row('Account number', bank.account_number)}
          ${row('Branch', bank.branch)}
          ${row('Account name', bank.account_name)}
          ${reference ? row('Payment reference', reference) : ''}
        </dl>
      </div>`;
  }

  // Any element with data-copy="..." copies its value to the clipboard.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch (err) { /* clipboard blocked; the value is visible to copy by hand */ }
  });

  // Shows a thumbnail (images) or the file name (PDFs) next to a file input.
  function bindFilePreview(input) {
    const preview = input.closest('.file-field').querySelector('.file-preview');
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) preview.textContent = 'No file';
      else if (file.type.startsWith('image/')) preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
      else preview.textContent = file.name;
    });
  }

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  function fileProblem(input, { images = true, pdf = false } = {}) {
    const file = input.files[0];
    if (!file) return null;
    const okTypes = [...(images ? ['image/jpeg', 'image/png', 'image/webp'] : []), ...(pdf ? ['application/pdf'] : [])];
    if (!okTypes.includes(file.type)) return pdf ? 'Please choose a JPG, PNG or WEBP photo, or a PDF.' : 'Please choose a JPG, PNG or WEBP photo.';
    if (file.size > MAX_FILE_BYTES) return 'This file is larger than 10MB. Please choose a smaller one.';
    return null;
  }

  return { CATEGORIES, ORDER, money, period, bankBox, bindFilePreview, fileProblem };
})();
