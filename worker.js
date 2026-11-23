// worker.js
// Serves the static site (dist/) as-is for everyone, EXCEPT the link-preview
// bots of Facebook, WhatsApp, LinkedIn and the like when they request a news
// or event page (as on the SLNA site). Those pages fill in their title and
// photo with JavaScript, which the bots don't run, so a shared link would only
// show the site's generic title. For those bots only, this fetches the item
// from the backend and answers with a small page carrying its real og:title,
// og:description and og:image (and a redirect to the real page).
//
// Real browsers are not affected: they always get env.ASSETS.fetch(request).

const API_BASE = 'https://slicna-backend-production.up.railway.app/api';
const BACKEND_ORIGIN = 'https://slicna-backend-production.up.railway.app';
const FALLBACK_IMAGE = '/images/slicna-logo.png';

const CRAWLER_UA_PATTERN =
  /facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|skypeuripreview|embedly|redditbot|google-inspectiontool/i;

const VIDEO_RE = /\.(mp4|m4v|mov|webm|ogg|ogv)(\?|$)/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const isCrawler = CRAWLER_UA_PATTERN.test(request.headers.get('user-agent') || '');

    // Cloudflare serves these pages at both ".html" and the clean path.
    const isNews = url.pathname === '/pages/news-detail.html' || url.pathname === '/pages/news-detail';
    const isEvent = url.pathname === '/pages/event-detail.html' || url.pathname === '/pages/event-detail';

    if (isCrawler && id && (isNews || isEvent)) {
      const response = isNews ? await newsPreview(url, id) : await eventPreview(url, id);
      if (response) return response;
    }
    return env.ASSETS.fetch(request);
  },
};

async function getJson(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) return null;
  return res.json();
}

async function newsPreview(pageUrl, id) {
  try {
    const item = await getJson('/news/' + encodeURIComponent(id));
    if (!item) return null;
    // A cover video can't be a link preview: use the first album photo instead.
    let image = item.photo_url && !VIDEO_RE.test(item.photo_url) ? item.photo_url : null;
    if (!image && Array.isArray(item.photos)) {
      const photo = item.photos.find((p) => (p.media_type || 'image') === 'image' && !VIDEO_RE.test(p.url));
      image = photo ? photo.url : null;
    }
    return previewResponse(pageUrl, id, {
      title: item.title || 'News',
      description: item.summary || stripHtml(item.body),
      image,
    });
  } catch (err) {
    return null;
  }
}

async function eventPreview(pageUrl, id) {
  try {
    const event = await getJson('/events/' + encodeURIComponent(id));
    if (!event) return null;
    return previewResponse(pageUrl, id, {
      title: event.title || 'Event',
      description: event.summary || stripHtml(event.body),
      image: event.photo_url,
    });
  } catch (err) {
    return null;
  }
}

// Uploaded files are "/uploads/<key>" on the backend, which redirects to the
// public R2 bucket. The preview gets the bucket address itself, so the bots
// don't have to follow a redirect.
async function imageUrlFor(pageUrl, path) {
  if (!path) return pageUrl.origin + FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(path)) return path;
  const backendUrl = BACKEND_ORIGIN + path;
  try {
    const res = await fetch(backendUrl, { method: 'HEAD', redirect: 'manual' });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) return new URL(location, backendUrl).href;
  } catch (err) { /* fall back to the backend address */ }
  return backendUrl;
}

async function previewResponse(pageUrl, id, { title, description, image }) {
  // The page with just its ?id=, so shares from links carrying ?fbclid= etc. are one page.
  const canonicalUrl = pageUrl.origin + pageUrl.pathname + '?id=' + encodeURIComponent(id);
  const imageUrl = await imageUrlFor(pageUrl, image);
  const text = truncate(description, 200);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} | SLICNA</title>
<meta name="description" content="${escapeHtml(text)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:site_name" content="Sri Lanka Intensive Care Nurses Association (SLICNA)">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(text)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}">
</head>
<body></body>
</html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'public, max-age=300' },
  });
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : value.slice(0, max - 1).trim() + '…';
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
