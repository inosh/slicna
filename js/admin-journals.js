// Admin: SLICNA journal issues (PDF). The newest issue opens as a flipbook on
// the public Journal page; older issues are listed below it.
(() => {
  const A = window.SLICNA_ADMIN;
  if (!A) return;
  const { esc, fmtDate, today, resourcePanel } = A;

  const sizeText = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '');

  // The PDF field (required when adding; optional when editing, where it replaces the current file).
  function pdfField(v) {
    return `
      <div class="field full" ${v.pdf_url ? 'data-has-pdf' : ''}>
        <label for="f-pdf">Journal PDF${v.pdf_url ? ' <span class="opt">(optional)</span>' : ''}</label>
        <input id="f-pdf" type="file" name="pdf" accept="application/pdf">
        <p class="hint">${v.pdf_url
          ? `Current file: ${esc(v.pdf_name || 'journal.pdf')} (${esc(sizeText(v.pdf_size))}). Choosing a new file replaces it.`
          : 'The whole issue as one PDF, up to 30MB. Readers flip through it page by page.'}</p>
      </div>`;
  }

  function validate(form) {
    const file = form.querySelector('#f-pdf').files[0];
    if (!file && !form.querySelector('[data-has-pdf]')) return 'Please choose the journal PDF.';
    if (file && file.type !== 'application/pdf') return 'The journal must be a PDF file.';
    if (file && file.size > 30 * 1024 * 1024) return 'The PDF is larger than 30MB. Please make it smaller (for example "Reduced size PDF" when saving).';
    return null;
  }

  A.registerSection('journals', {
    group: 'content', label: 'Journal', sub: 'Journal issues (PDF)',
    render(main) {
      resourcePanel(main, {
        title: 'Journal issues', intro: 'The newest issue opens as a flipbook on the Journal page; older issues are listed under it.',
        endpoint: '/journals', singular: 'journal issue',
        columns: [
          { label: 'Published', html: (r) => esc(fmtDate(r.published_on)) },
          { label: 'Issue', main: true, html: (r) => `${esc(r.title)}${r.issue_label ? `<div class="admin-muted">${esc(r.issue_label)}</div>` : ''}` },
          { label: 'PDF', html: (r) => `<a href="${esc(SLICNA_API.mediaUrl(r.pdf_url))}" target="_blank" rel="noopener">${esc(r.pdf_name || 'Open PDF')}</a><div class="admin-muted">${esc(sizeText(r.pdf_size))}</div>` },
        ],
        image: { column: 'cover_url', field: 'cover', label: 'Cover image (optional: the first page of the PDF is used when empty)' },
        defaults: () => ({ published_on: today() }),
        fields: [
          { name: 'title', label: 'Title', required: true, max: 300, hint: 'For example: SLICNA Journal of Critical Care Nursing' },
          { name: 'issue_label', label: 'Volume / issue', max: 100, half: true, hint: 'For example: Volume 3, Issue 1' },
          { name: 'published_on', label: 'Publication date', type: 'date', required: true, half: true },
          { name: 'description', label: 'Short description', type: 'textarea', rows: 3, max: 2000, hint: 'What is in this issue, in a sentence or two.' },
        ],
        form: { extra: pdfField, validate },
        confirmAdd: 'The issue appears on the Journal page straight away. If it is the newest, it opens as the flipbook.',
        deleteNote: 'Its PDF and cover image are deleted too',
      });
    },
  });
})();
