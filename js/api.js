// Thin wrapper around the SLICNA backend. Endpoints mirror the SLNA backend's shape so
// slicna-backend can be built from it later. Falls back to SLICNA_DEMO when the API is unreachable.
const SLICNA_API = (() => {
  const base = SLICNA_CONFIG.API_BASE_URL.replace(/\/+$/, '');
  const TIMEOUT_MS = 4000;
  const DEMO_ONLY = SLICNA_CONFIG.DATA_SOURCE === 'demo';

  async function request(path, options = {}) {
    if (DEMO_ONLY) throw new Error('Demo mode: API calls are switched off');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(base + path, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(path, demoValue) {
    try {
      return await request(path);
    } catch (err) {
      if ((DEMO_ONLY || SLICNA_CONFIG.USE_DEMO_FALLBACK) && demoValue !== undefined) {
        if (!DEMO_ONLY) console.info('[SLICNA] API unavailable for ' + path + ', showing demo content.');
        return typeof demoValue === 'function' ? demoValue() : demoValue;
      }
      throw err;
    }
  }

  async function post(path, body) {
    const isForm = body instanceof FormData;
    return request(path, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body)
    });
  }

  const byDateAsc = (a, b) => new Date(a.event_date) - new Date(b.event_date);
  const byDateDesc = (a, b) => new Date(b.event_date || b.published_at) - new Date(a.event_date || a.published_at);

  return {
    news: () => get('/news', () => SLICNA_DEMO.news).then((list) => [...list].sort(byDateDesc)),
    newsItem: (id) => get('/news/' + encodeURIComponent(id), () => SLICNA_DEMO.news.find((n) => String(n.id) === String(id))),
    events: () => get('/events', () => SLICNA_DEMO.events).then((list) => [...list].sort(byDateAsc)),
    event: (id) => get('/events/' + encodeURIComponent(id), () => SLICNA_DEMO.events.find((e) => String(e.id) === String(id))),
    committee: () => get('/executive-committee', () => SLICNA_DEMO.committee),
    albums: () => get('/albums', () => SLICNA_DEMO.albums),
    fees: () => get('/membership-fees', () => SLICNA_DEMO.fees),
    applyMembership: (formData) => post('/membership/apply', formData),
    sendContact: (data) => post('/contact-queries', data),
    registerEvent: (id, data) => post('/event-registrations', { event_id: id, ...data })
  };
})();
