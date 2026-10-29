// Local preview: builds the site into dist/, serves it, and rebuilds when a source file changes.
// Usage: npm run dev  (then open http://localhost:5173)
const fs = require('fs');
const http = require('http');
const path = require('path');
const build = require('./build-pages');

const PORT = Number(process.env.PORT) || 5173;
const DIST = path.join(__dirname, 'dist');
const WATCH = ['index.html', 'pages', 'partials', 'css', 'js', 'images'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const rebuild = () => build({ clean: false });
try { build(); } catch (err) { rebuild(); }

let timer = null;
for (const target of WATCH) {
  const full = path.join(__dirname, target);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { rebuild(); } catch (err) { console.error('[build failed]', err.message); }
    }, 150);
  });
}

// Resolves "/", "/pages/about" and "/pages/about.html" the same way Cloudflare's asset handling does.
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '') || '/';
  const candidates = clean === '/'
    ? ['index.html']
    : [clean, clean + '.html', path.join(clean, 'index.html')];

  for (const candidate of candidates) {
    const file = path.join(DIST, candidate);
    if (!file.startsWith(DIST)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`SLICNA preview running at http://localhost:${PORT}`);
});
