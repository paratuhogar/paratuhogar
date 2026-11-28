// Real local font bytes and CSS. No app scripts, accounts or network services.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const head = index.slice(index.indexOf('<head>') + 6, index.indexOf('</head>')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://fixture');
    if (u.pathname === '/') {res.setHeader('content-type', 'text/html'); return res.end(`<!doctype html><html lang="es"><head>${head}</head><body><h1 id="title" style="font:800 32px Manrope">Mejoramos tu hogar</h1><p style="font:700 24px Rajdhani">Gestión y energía</p><span id="icon" class="material-symbols-outlined">shopping_cart</span><span class="material-symbols-outlined font-fill">favorite</span></body></html>`);}
    const name = decodeURIComponent(u.pathname).slice(1), file = path.resolve(root, name);
    if (!file.startsWith(root + '/') || !/^(?:css\/[\w.-]+\.css|assets\/fonts\/[\w.-]+\.woff2|icons\/icon-192\.png)$/.test(name) || !fs.existsSync(file)) {res.writeHead(404); return res.end();}
    res.setHeader('content-type', name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.css') ? 'text/css' : 'image/png');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath: process.env.PTH_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 844}, serviceWorkers: 'block'});
      const requested = [], failures = [];
      await page.route('**/*', route => {
        const u = new URL(route.request().url()); requested.push(u.href);
        if (u.origin !== origin) return route.fulfill({body: '', contentType: 'text/css'});
        return route.continue();
      });
      page.on('response', response => {if (response.url().endsWith('.woff2') && !response.ok()) failures.push(response.status());});
      await page.goto(origin, {waitUntil: 'load'});
      const result = await page.evaluate(async () => {
        const faces = await Promise.all([document.fonts.load('800 32px Manrope'), document.fonts.load('700 24px Rajdhani'), document.fonts.load('400 24px "Material Symbols Outlined"')]);
        await document.fonts.ready;
        const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '24px "Material Symbols Outlined"';
        return {loaded: faces.map(group => group.length > 0 && group.every(face => face.status === 'loaded')), iconAdvance: ctx.measureText('shopping_cart').width, iconBox: document.querySelector('#icon').getBoundingClientRect().width};
      });
      assert.deepEqual(result.loaded, [true, true, true]);
      assert.ok(result.iconAdvance <= 25 && result.iconAdvance >= 20, 'real icon ligature, not fallback text');
      assert.equal(result.iconBox, 24);
      assert.deepEqual(failures, []);
      assert.equal(requested.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')), false);
      console.log(`PASS ${width}px: real Manrope/Rajdhani + complete Material icon ligatures, stable boxes, zero external font requests`);
      await page.close();
    }
  } finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error); process.exitCode = 1;});
