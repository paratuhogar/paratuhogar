const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('hero is local, responsive, high priority and reserves its original display box', () => {
  const picture = html.match(/<picture class="pth-home-hero">[\s\S]*?<\/picture>/)?.[0];
  assert.ok(picture, 'responsive hero exists');
  assert.match(picture, /type="image\/avif"/);
  assert.match(picture, /type="image\/webp"/);
  assert.match(picture, /fetchpriority="high"/);
  assert.match(picture, /loading="eager"/);
  assert.match(picture, /width="1000" height="667"/);
  assert.doesNotMatch(picture, /https?:/);
  for (const name of new Set([...picture.matchAll(/assets\/(home-hero-[\w.-]+)/g)].map(m => m[1]))) {
    const file = path.join(root, 'assets', name);
    assert.ok(fs.statSync(file).size < 65000, name + ' stays small');
  }
  assert.match(html, /\.pth-home-hero\s*\{[^}]*height:\s*220px/);
  assert.match(html, /min-width:\s*640px[^}]*\.pth-home-hero\s*\{\s*height:\s*300px/);
  assert.match(html, /min-width:\s*768px[^}]*\.pth-home-hero\s*\{\s*height:\s*420px/);
});

test('optional private styles do not block the public head; icon fallback cannot stretch layout', () => {
  const head = html.split('</head>')[0];
  assert.doesNotMatch(head, /<link[^>]+(?:points-wallet|points-cash|personal-qr)\.css/);
  assert.match(head, /<link[^>]+coupons\.css/);
  assert.match(head, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(head, /font-awesome[^>]+media="print"[^>]+onload=/);
  assert.match(head, /\.material-symbols-outlined\s*\{[^}]*width:\s*1em[^}]*overflow:\s*hidden/);
});

test('public product h3 headings have a persistent h2 and low contrast labels are corrected', () => {
  assert.match(html, /<h2 id="catalog-products-title" class="sr-only">[\s\S]*?<\/h2>\s*<section id="productos-container"[^>]+aria-labelledby="catalog-products-title"/);
  assert.doesNotMatch(html.slice(html.indexOf('<header'), html.indexOf('</header>')), /<h1[^>]*>para<span/);
  assert.match(html, /id="social-proof-delivered-count"[^>]+text-slate-600/);
  const css = fs.readFileSync(path.join(root, 'css/public-home.css'), 'utf8');
  assert.match(css, /#category-list[^}]+#64748b/);
  assert.match(css, /\.pth-verified-review[^}]+#475569/);
});

test('review reference photos use responsive thumbnails, while authorized real photos keep their source', () => {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/image-variants.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/product-images.js'), 'utf8'), context);
  const api = context.window.PTHProductImages;
  const name = Object.keys(context.window.PTH_IMAGE_VARIANTS)[0];
  const small = api.render('/original/' + name, 'Product', 'object-contain', 'compact');
  assert.match(small, /<picture/);
  assert.match(small, /sizes="96px"/);
  assert.doesNotMatch(small, /class="block h-full w-full"/);
  const source = fs.readFileSync(path.join(root, 'js/storefront.js'), 'utf8');
  const start = source.indexOf('function renderVerifiedOpinionCard(');
  const end = source.indexOf('\nfunction ', start + 1);
  const render = source.slice(start, end);
  assert.match(render, /PTHProductImages\.render\([\s\S]+?'compact'/);
  assert.match(render, /<img src="\$\{gestorSafeText\(authorizedPhoto\)\}"/);
});
