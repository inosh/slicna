// Thin wrapper around slicna-backend. Public pages only read; the admin panel
// (js/admin.js) uses SLICNA_API.request with a token for writes.
const SLICNA_API = (() => {
  const base = SLICNA_CONFIG.API_BASE_URL.replace(/\/+$/, '');
  const origin = base.replace(/\/api$/, '');
  // Long enough for an application with three photo or PDF uploads on a slow connection.
  const TIMEOUT_MS = 60000;

  // Errors carry the API's own message (e.g. "Title is required.") and HTTP status.
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(base + path, { ...options, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || 'Request failed (' + res.status + ')');
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
      if (err instanceof TypeError) throw new Error('Could not reach the server. Check your connection and try again.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Uploaded images are stored as "/uploads/..." paths on the backend.
  function mediaUrl(url) {
    if (!url) return '';
    return url.startsWith('/uploads/') ? origin + url : url;
  }

  // The contact form isn't connected yet.
  const notYetOpen = () => Promise.reject(Object.assign(new Error('Not open yet'), { notOpen: true }));
  const postJson = (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  return {
    request,
    mediaUrl,
    news: () => request('/news'),
    newsItem: (id) => request('/news/' + encodeURIComponent(id)),
    events: () => request('/events'),
    event: (id) => request('/events/' + encodeURIComponent(id)),
    committee: () => request('/committee'),
    milestones: () => request('/milestones'),
    settings: () => request('/settings'),
    community: () => request('/community'),
    albums: () => request('/albums'),
    membershipInfo: () => request('/membership/info'),
    applyMembership: (formData) => request('/membership/applications', { method: 'POST', body: formData }),
    membershipStatus: (reference, nic) => postJson('/membership/status', { reference_number: reference, nic_number: nic }),
    renewalLookup: (number, nic) => postJson('/membership/renew/lookup', { membership_number: number, nic_number: nic }),
    renewalView: (token) => request('/membership/renew/' + encodeURIComponent(token)),
    submitRenewal: (token, formData) => request('/membership/renew/' + encodeURIComponent(token), { method: 'POST', body: formData }),
    sendContact: notYetOpen
  };
})();
