const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/storefront.js'), 'utf8');
const hydration = source.slice(source.indexOf('// Description hydration'), source.indexOf('async function loadProducts()'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => route.abort());
    await page.setContent('<div id="detail-desc"></div>');
    await page.addScriptTag({ path: path.join(root, 'js/product-description-loader.js') });
    await page.addScriptTag({ content: `
      let selectedProduct, token='account-a', attempts=0, waiting=[];
      window.PTHSecureData={token:()=>token};
      const supabaseClient={from(){return {select(){return this},in(){attempts++;return new Promise(resolve=>waiting.push(resolve))}}}};
      function renderDetailDescription(value){document.getElementById('detail-desc').textContent=value||'Sin descripción';}
      ${hydration}
    ` });
    await page.evaluate(() => { selectedProduct = { id: 'a', precio: 150 }; loadDetailDescription(selectedProduct); });
    await page.getByText('Cargando descripción…', { exact: true }).waitFor();
    await page.evaluate(() => waiting.shift()({ data: null, error: Error('Offline') }));
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.evaluate(() => waiting.shift()({ data: [{ id: 'a', descripcion: 'Recovered details', precio: 1 }], error: null }));
    await page.getByText('Recovered details', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => selectedProduct.precio), 150);
    await page.evaluate(() => {
      selectedProduct = { id: 'b' }; loadDetailDescription(selectedProduct);
      selectedProduct = { id: 'c', descripcion: 'New selection' }; loadDetailDescription(selectedProduct);
    });
    await page.evaluate(() => waiting.shift()({ data: [{ id: 'b', descripcion: 'Late old selection' }], error: null }));
    assert.equal(await page.locator('#detail-desc').innerText(), 'New selection');
    await page.evaluate(() => { selectedProduct = { id: 'd' }; loadDetailDescription(selectedProduct); token = 'account-b'; });
    await page.evaluate(() => waiting.shift()({ data: [{ id: 'd', descripcion: 'Other account details' }], error: null }));
    await page.getByRole('button', { name: 'Reintentar' }).waitFor();
    assert.equal(await page.evaluate(() => Object.hasOwn(selectedProduct, 'descripcion')), false);
    assert.equal(await page.locator('#detail-desc').innerText().then(text => text.includes('Other account details')), false);
    console.log('PASS description UI: loading, offline/retry, prices preserved, late navigation, account interruption; no external network');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
