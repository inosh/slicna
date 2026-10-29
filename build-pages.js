const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const SITE_ORIGIN = 'https://slicna.lk';

// Placeholders each page carries; replaced with the shared partials at build time.
const HEADER_RE = /<div id="site-header"><\/div>/i;
const FOOTER_RE = /<div id="site-footer"><\/div>/i;
const HEAD_CLOSE_RE = /<\/head>/i;

// Plain asset folders and root files copied into dist/ as-is.
const COPY_DIRS = ['css', 'js', 'images'];
const COPY_FILES = ['robots.txt', 'favicon.ico'];

// Detail pages are templates; their canonical URL depends on ?id= and is set client-side.
const SKIP_CANONICAL = new Set(['pages/news-detail.html', 'pages/event-detail.html']);

function readPartial(name) {
  return fs.readFileSync(path.join(ROOT, 'partials', name), 'utf8').trim();
}

function canonicalUrlFor(relativePath) {
  const posixPath = relativePath.split(path.sep).join('/');
  if (posixPath === 'index.html') return SITE_ORIGIN + '/';
  return SITE_ORIGIN + '/' + posixPath.replace(/\.html$/i, '');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function buildPage(srcPath, relativePath, header, footer) {
  const destPath = path.join(DIST, relativePath);
  let html = fs.readFileSync(srcPath, 'utf8');

  if (HEADER_RE.test(html)) html = html.replace(HEADER_RE, () => header);
  if (FOOTER_RE.test(html)) html = html.replace(FOOTER_RE, () => footer);

  const posixPath = relativePath.split(path.sep).join('/');
  if (!SKIP_CANONICAL.has(posixPath)) {
    html = html.replace(HEAD_CLOSE_RE, () => `  <link rel="canonical" href="${canonicalUrlFor(relativePath)}">\n</head>`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, html, 'utf8');
}

// clean=false overwrites dist/ in place; the dev server uses it because Windows can lock the folder while it's being served.
function build({ clean = true } = {}) {
  const header = readPartial('header.html');
  const footer = readPartial('footer.html');

  if (clean) fs.rmSync(DIST, { recursive: true, force: true, maxRetries: 5 });
  fs.mkdirSync(DIST, { recursive: true });

  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) copyDir(src, path.join(DIST, dir));
  }
  for (const file of COPY_FILES) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, file));
  }

  buildPage(path.join(ROOT, 'index.html'), 'index.html', header, footer);

  const pages = fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.html'));
  for (const file of pages) {
    buildPage(path.join(ROOT, 'pages', file), path.join('pages', file), header, footer);
  }

  console.log(`Built ${pages.length + 1} page(s) into dist/.`);
}

module.exports = build;

if (require.main === module) build();
