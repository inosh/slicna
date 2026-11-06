// Journal page: the newest issue (or ?issue=<id>) opens as a flipbook.
// PDF.js renders each page of the PDF to an image in the browser, then
// StPageFlip turns real <img> pages (HTML mode, so text stays sharp on any
// screen): the cover on its own, then two-page spreads (one page at a time on
// narrow screens), with page-curl turning and stiff front and back covers.
// Past issues are listed below; choosing one opens it in the same reader.
// "Zoom in to read" (or double-clicking a page) shows one page large, drawn
// again from the PDF at the chosen size so small text stays sharp.
document.addEventListener('DOMContentLoaded', async () => {
  const esc = SLICNA.escapeHtml;
  const $ = (id) => document.getElementById(id);
  const reader = $('reader');
  const stage = $('book-stage');
  const slider = $('book-slider');
  const counter = $('book-counter');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let journals = [];
  let current = null;
  let flip = null;
  let pages = []; // object URLs of the rendered pages of the current issue
  let pdfDoc = null; // the open PDF, kept for sharp zoomed pages
  let ratio = 1.414; // page height / width
  let loadToken = 0;

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdfUrl = (j) => SLICNA.media(j.pdf_url);
  const issueLine = (j) => [j.issue_label, SLICNA.formatDate(j.published_on)].filter(Boolean).join(' · ');

  function setLoading(text, fraction) {
    $('book-loading').hidden = false;
    $('book-loading-text').textContent = text;
    $('book-progress').style.width = `${Math.round((fraction || 0) * 100)}%`;
  }

  function showFallback(j, message) {
    $('book-loading').hidden = false;
    $('book-progress').style.width = '0';
    $('book-loading-text').innerHTML = `${esc(message)} <a href="${esc(pdfUrl(j))}" target="_blank" rel="noopener">Open the PDF instead</a>.`;
  }

  // "Page 1 of 14", or "Pages 2–3 of 14" when a spread is showing.
  function updateCounter() {
    if (!flip) return;
    const i = flip.getCurrentPageIndex();
    const landscape = flip.getOrientation() === 'landscape';
    const spread = landscape && i > 0 && i < pages.length - 1;
    counter.textContent = spread ? `Pages ${i + 1}–${i + 2} of ${pages.length}` : `Page ${i + 1} of ${pages.length}`;
    slider.value = i + 1;
    $('book-prev').disabled = i === 0;
    $('book-next').disabled = i >= pages.length - (spread ? 2 : 1);
  }

  // Each page as a JPEG, wide enough for sharp text when the book fills the screen.
  async function renderPages(pdf, token) {
    const urls = [];
    const targetWidth = Math.min(1600, Math.round(800 * Math.max(1, window.devicePixelRatio || 1)));
    for (let n = 1; n <= pdf.numPages; n += 1) {
      if (token !== loadToken) return null;
      setLoading(`Preparing page ${n} of ${pdf.numPages}…`, (n - 1) / pdf.numPages);
      const page = await pdf.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      if (n === 1) ratio = natural.height / natural.width;
      const viewport = page.getViewport({ scale: targetWidth / natural.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // "print" renders straight through instead of once per animation frame,
      // so pages keep preparing even if the visitor switches to another tab.
      await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      urls.push(URL.createObjectURL(blob));
      page.cleanup();
    }
    return urls;
  }

  // (Re)builds the book in the stage at the given page, sized to fit the
  // window (full screen gets a bigger book).
  function buildBook(startPage = 0) {
    if (flip) { flip.destroy(); flip = null; }
    const old = $('book');
    if (old) old.remove();
    const book = document.createElement('div');
    book.className = 'book';
    book.id = 'book';
    pages.forEach((src, i) => {
      const page = document.createElement('div');
      page.className = 'journal-page';
      page.dataset.index = i;
      // The front and back covers turn stiffly, like card.
      if (i === 0 || i === pages.length - 1) page.dataset.density = 'hard';
      page.innerHTML = `<img src="${src}" alt="Page ${i + 1}" draggable="false">`;
      book.appendChild(page);
    });
    stage.insertBefore(book, $('book-next'));

    // Height that fits: the visible window minus the reader's header and footer.
    const fullscreen = Boolean(document.fullscreenElement);
    const maxHeight = Math.max(320, window.innerHeight - (fullscreen ? 200 : 260));
    const maxWidth = Math.min(900, Math.round(maxHeight / ratio));
    flip = new St.PageFlip(book, {
      width: 500, height: Math.round(500 * ratio), size: 'stretch',
      minWidth: 240, maxWidth, minHeight: Math.round(240 * ratio), maxHeight,
      showCover: true, usePortrait: true, mobileScrollSupport: false, autoSize: true,
      // A click only turns the page at its corners, so a double-click can zoom.
      disableFlipByClick: true,
      maxShadowOpacity: 0.4, flippingTime: reducedMotion ? 250 : 800, startPage,
    });
    flip.loadFromHTML(book.querySelectorAll('.journal-page'));
    flip.on('flip', updateCounter);
    flip.on('changeOrientation', updateCounter);
    slider.max = pages.length;
    slider.disabled = false;
    $('reader-zoom').disabled = false;
    updateCounter();
  }

  async function openIssue(j, { scroll = false } = {}) {
    current = j;
    const token = ++loadToken;
    reader.hidden = false;
    $('reader-title').textContent = j.title;
    $('reader-issue').textContent = issueLine(j);
    $('reader-desc').textContent = j.description || '';
    $('reader-desc').hidden = !j.description;
    $('reader-pdf').href = pdfUrl(j);
    document.querySelectorAll('[data-issue]').forEach((c) => c.setAttribute('aria-current', String(Number(c.dataset.issue) === j.id)));
    if (scroll) reader.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });

    if (flip) { flip.destroy(); flip = null; }
    if ($('book')) $('book').innerHTML = '';
    pages.forEach((u) => URL.revokeObjectURL(u));
    pages = [];
    slider.disabled = true;
    $('reader-zoom').disabled = true;
    closeZoom();
    if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null; }
    counter.textContent = '';
    $('book-prev').disabled = true;
    $('book-next').disabled = true;

    if (!window.pdfjsLib || !window.St) return showFallback(j, 'The page-turning reader could not load.');
    try {
      setLoading('Opening the journal…', 0);
      const pdf = await pdfjsLib.getDocument({ url: pdfUrl(j) }).promise;
      const urls = await renderPages(pdf, token);
      if (!urls || token !== loadToken) { pdf.destroy(); return; }
      pdfDoc = pdf;
      pages = urls;
      $('book-loading').hidden = true;
      buildBook(0);
    } catch (err) {
      if (token === loadToken) showFallback(j, 'This issue could not be shown here.');
    }
  }

  // ---------- Controls ----------

  $('book-prev').addEventListener('click', () => flip && flip.flipPrev());
  $('book-next').addEventListener('click', () => flip && flip.flipNext());
  slider.addEventListener('input', () => { if (flip) flip.turnToPage(Number(slider.value) - 1); updateCounter(); });
  document.addEventListener('keydown', (e) => {
    if (!zoomView.hidden) {
      // Arrows turn pages unless the zoomed page is wider than the window (then they scroll).
      const wide = zoomScroll.scrollWidth > zoomScroll.clientWidth;
      if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
      if (e.key === 'ArrowLeft' && !wide) { e.preventDefault(); zoomTurn(-1); }
      if (e.key === 'ArrowRight' && !wide) { e.preventDefault(); zoomTurn(1); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoomIndex + 1); }
      if (e.key === '-') { e.preventDefault(); setZoom(zoomIndex - 1); }
      return;
    }
    if (!flip || reader.hidden || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); flip.flipPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); flip.flipNext(); }
  });

  const fullButton = $('reader-full');
  if (!document.fullscreenEnabled) fullButton.hidden = true;
  fullButton.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else reader.requestFullscreen().catch(() => {});
  });
  // The book is sized when it's built, so rebuild it (same page) for the new screen size.
  document.addEventListener('fullscreenchange', () => {
    fullButton.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    if (flip && pages.length) setTimeout(() => buildBook(flip.getCurrentPageIndex()), 120);
  });

  // ---------- Zoom ----------

  const zoomView = $('zoom-view');
  const zoomScroll = $('zoom-scroll');
  const zoomCanvas = $('zoom-canvas');
  const ZOOMS = [1, 1.5, 2, 2.5, 3]; // times the "fit width" size
  let zoomIndex = 0;
  let zoomPage = 0;
  let zoomToken = 0;
  let zoomOpener = null;

  // Page width at 100%: the window's width, but no wider than is comfortable to read.
  const fitWidth = () => Math.max(260, Math.min(zoomScroll.clientWidth - (window.innerWidth <= 640 ? 16 : 112), 1000));

  async function drawZoom(keepCentre) {
    if (!pdfDoc) return;
    const token = ++zoomToken;
    const zoom = ZOOMS[zoomIndex];
    $('zoom-page').textContent = `Page ${zoomPage + 1} of ${pages.length}`;
    $('zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    $('zoom-out').disabled = zoomIndex === 0;
    $('zoom-in').disabled = zoomIndex === ZOOMS.length - 1;
    $('zoom-prev').disabled = zoomPage === 0;
    $('zoom-next').disabled = zoomPage >= pages.length - 1;

    // Remember which part of the page was in the middle, to keep it there.
    const fx = keepCentre && zoomScroll.scrollWidth ? (zoomScroll.scrollLeft + zoomScroll.clientWidth / 2) / zoomScroll.scrollWidth : 0.5;
    const fy = keepCentre && zoomScroll.scrollHeight ? (zoomScroll.scrollTop + zoomScroll.clientHeight / 2) / zoomScroll.scrollHeight : 0;

    const page = await pdfDoc.getPage(zoomPage + 1);
    if (token !== zoomToken) return;
    const natural = page.getViewport({ scale: 1 });
    const cssWidth = Math.round(fitWidth() * zoom);
    const cssHeight = Math.round(cssWidth * natural.height / natural.width);
    // Sharp on high-density screens, but capped so very large zooms stay light.
    const density = Math.min(window.devicePixelRatio || 1, Math.sqrt(16e6 / (cssWidth * cssHeight)));
    const viewport = page.getViewport({ scale: (cssWidth * density) / natural.width });
    // Drawn off screen first, so the old page stays until the new one is ready.
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    page.cleanup();
    if (token !== zoomToken) return;

    zoomCanvas.width = canvas.width;
    zoomCanvas.height = canvas.height;
    zoomCanvas.getContext('2d').drawImage(canvas, 0, 0);
    zoomCanvas.style.width = `${cssWidth}px`;
    zoomCanvas.style.height = `${cssHeight}px`;
    zoomCanvas.setAttribute('aria-label', `Page ${zoomPage + 1}`);
    if (keepCentre) {
      zoomScroll.scrollLeft = fx * zoomScroll.scrollWidth - zoomScroll.clientWidth / 2;
      zoomScroll.scrollTop = fy * zoomScroll.scrollHeight - zoomScroll.clientHeight / 2;
    } else {
      zoomScroll.scrollTop = 0;
      zoomScroll.scrollLeft = (zoomScroll.scrollWidth - zoomScroll.clientWidth) / 2;
    }
  }

  function openZoom(index) {
    if (!pdfDoc || !pages.length) return;
    zoomOpener = document.activeElement;
    zoomPage = Math.max(0, Math.min(index, pages.length - 1));
    zoomView.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    zoomScroll.focus();
    drawZoom(false);
  }

  function closeZoom() {
    if (zoomView.hidden) return;
    zoomView.hidden = true;
    zoomToken += 1;
    document.documentElement.style.overflow = '';
    // Back in the book, show the page that was being read.
    if (flip && flip.getCurrentPageIndex() !== zoomPage) flip.turnToPage(zoomPage);
    updateCounter();
    if (zoomOpener && zoomOpener.focus) zoomOpener.focus();
  }

  function setZoom(next) {
    const i = Math.max(0, Math.min(next, ZOOMS.length - 1));
    if (i === zoomIndex) return;
    zoomIndex = i;
    drawZoom(true);
  }

  function zoomTurn(step) {
    const next = zoomPage + step;
    if (next < 0 || next >= pages.length) return;
    zoomPage = next;
    drawZoom(false);
  }

  $('reader-zoom').addEventListener('click', () => flip && openZoom(flip.getCurrentPageIndex()));
  stage.addEventListener('dblclick', (e) => {
    const page = e.target.closest('.journal-page');
    if (page) openZoom(Number(page.dataset.index));
  });
  $('zoom-close').addEventListener('click', closeZoom);
  $('zoom-in').addEventListener('click', () => setZoom(zoomIndex + 1));
  $('zoom-out').addEventListener('click', () => setZoom(zoomIndex - 1));
  $('zoom-fit').addEventListener('click', () => { zoomIndex = 0; drawZoom(false); });
  $('zoom-prev').addEventListener('click', () => zoomTurn(-1));
  $('zoom-next').addEventListener('click', () => zoomTurn(1));

  // Ctrl + mouse wheel (or a trackpad pinch) zooms the page, not the website.
  zoomScroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoomIndex + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  // Drag with the mouse to move around a zoomed page.
  let drag = null;
  zoomScroll.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: zoomScroll.scrollLeft, top: zoomScroll.scrollTop };
    zoomScroll.classList.add('dragging');
    zoomScroll.setPointerCapture(e.pointerId);
  });
  zoomScroll.addEventListener('pointermove', (e) => {
    if (!drag) return;
    zoomScroll.scrollLeft = drag.left - (e.clientX - drag.x);
    zoomScroll.scrollTop = drag.top - (e.clientY - drag.y);
  });
  const endDrag = () => { drag = null; zoomScroll.classList.remove('dragging'); };
  zoomScroll.addEventListener('pointerup', endDrag);
  zoomScroll.addEventListener('pointercancel', endDrag);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (zoomView.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawZoom(true), 200);
  });

  // ---------- Past issues ----------

  // Every issue (when there is more than one); the one in the reader is marked.
  function renderIssues() {
    if (journals.length < 2) return;
    $('past-issues').hidden = false;
    $('issue-grid').innerHTML = journals.map((j) => `
      <button type="button" class="issue-card" data-issue="${j.id}" aria-current="${current && current.id === j.id}">
        <span class="issue-cover">${j.cover_url
          ? `<img src="${esc(SLICNA.media(j.cover_url))}" alt="" loading="lazy">`
          : `<span class="issue-cover-text"><small>SLICNA Journal</small><b>${esc(j.issue_label || SLICNA.formatDate(j.published_on))}</b></span>`}</span>
        <span class="issue-meta"><b>${esc(j.title)}</b><span>${esc(issueLine(j))}</span><em class="issue-now">Reading now</em></span>
      </button>`).join('');
  }

  $('issue-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-issue]');
    if (!card) return;
    const j = journals.find((x) => x.id === Number(card.dataset.issue));
    if (!j || j === current) return;
    history.replaceState(null, '', `?issue=${j.id}`);
    openIssue(j, { scroll: true });
  });

  // ---------- Start ----------

  try {
    journals = await SLICNA_API.journals();
  } catch (err) {
    $('journal-empty').textContent = 'The journal could not be loaded right now. Please try again later.';
    $('journal-empty').hidden = false;
    return;
  }
  if (!journals.length) {
    $('journal-empty').hidden = false;
    return;
  }
  const wanted = Number(new URLSearchParams(window.location.search).get('issue'));
  current = journals.find((j) => j.id === wanted) || journals[0];
  renderIssues();
  openIssue(current);
});
