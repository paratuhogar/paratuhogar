import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

const source=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
function loadFunction(name, context) {
  const start=source.indexOf('function '+name+'(');
  if(start<0)return;
  const end=source.indexOf('\n}',start)+2;
  vm.runInNewContext(source.slice(start,end),context);
}
function fixture(name='\u200e\u200eSmartTV65samsung2026.png') {
  const classes=()=>{const values=new Set();return {add:c=>values.add(c),remove:c=>values.delete(c),has:c=>values.has(c)};};
  const input={value:name},img={src:'',classList:classes()},icon={innerText:'image',classList:classes()};
  const context={document:{getElementById:id=>({'img-path-0':input,'prev-github-0':img,'icon-github-0':icon})[id]}};
  for(const fn of ['cleanGithubImageName','fixDriveUrl','previewGithubImage'])loadFunction(fn,context);
  return {context,input,img,icon};
}
const expected='https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/SmartTV65samsung2026.png';
test('stored WhatsApp direction marks cannot turn an existing product photo into a different URL',()=>{
  const f=fixture();assert.equal(f.context.fixDriveUrl(f.input.value),expected);
});
test('encoded direction marks in a full GitHub URL are removed after decoding',()=>{
  const f=fixture();assert.equal(f.context.fixDriveUrl('https://github.com/paratuhogar/paratuhogar-fotos/blob/main/img_productos/%E2%80%8E%E2%80%8ESmartTV65samsung2026.png?raw=1'),expected);
});
test('preview cleans the visible input and requests exactly the image used in the catalogue',()=>{
  const f=fixture();f.context.previewGithubImage(0);assert.equal(f.input.value,'SmartTV65samsung2026.png');assert.equal(f.img.src,expected);
  assert.equal(f.icon.classList.has('hidden'),true);
});
test('common invisible paste marks are removed without changing accented names, case or punctuation',()=>{
  const f=fixture('\ufeff\u200b\u202aCafeteraÉKO-1_2.png\u202c\u2060\u2066\u2069');
  f.context.previewGithubImage(0);assert.equal(f.input.value,'CafeteraÉKO-1_2.png');
  assert.equal(f.img.src,'https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/CafeteraÉKO-1_2.png');
});
test('a filename containing only paste marks is treated as empty rather than a broken photo',()=>{
  const f=fixture('\u200e\u200f\ufeff');f.context.previewGithubImage(0);
  assert.equal(f.input.value,'');assert.equal(f.img.src,'');assert.equal(f.img.classList.has('hidden'),true);assert.equal(f.icon.innerText,'image');
  assert.match(f.context.fixDriveUrl('\u200e\ufeff'),/Sin\+Foto/);
});
test('valid existing filename URLs keep their current repository, extension and case',()=>{
  const f=fixture();
  for(const name of ['Samsung55pulgadas2026.png','Lavadoraautomática9KgSamsung.jpeg','foto_2.WEBP']) {
    assert.equal(f.context.fixDriveUrl(name),'https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/'+name);
  }
});
test('Chrome cleans a pasted name on change and displays the successfully decoded preview',async()=>{
  const executablePath=process.env.PTH_CHROMIUM||(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    const page=await browser.newPage(),requests=[];
    await page.route('https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/**',route=>{
      requests.push(route.request().url());
      return route.request().url()===expected ? route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}) : route.fulfill({status:404,body:'Not found'});
    });
    await page.setContent('<!doctype html><input id="img-path-0" onchange="previewGithubImage(0)"><img id="prev-github-0" class="hidden"><span id="icon-github-0">image</span><button>Otro campo</button>');
    const functions=['cleanGithubImageName','fixDriveUrl','previewGithubImage'].map(name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}).join('\n');
    await page.addScriptTag({content:functions});
    await page.locator('#img-path-0').fill('\u200e\u200eSmartTV65samsung2026.png');await page.getByRole('button').click();
    await page.waitForFunction(()=>document.getElementById('prev-github-0').naturalWidth>0);
    assert.equal(await page.locator('#img-path-0').inputValue(),'SmartTV65samsung2026.png');
    assert.deepEqual(requests,[expected]);assert.equal(await page.locator('#icon-github-0').evaluate(n=>n.classList.contains('hidden')),true);
    assert.equal(await page.locator('#prev-github-0').evaluate(n=>n.complete&&n.naturalWidth===1),true);
  } finally {await browser.close();}
});
