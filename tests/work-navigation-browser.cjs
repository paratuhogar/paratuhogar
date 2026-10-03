// Render the real navigation markup/CSS and run its existing section-switch function.
// No application bootstrap, login, network or production data is used.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=require('./read-storefront.cjs')();
const nav=html.match(/<nav id="admin-nav"[\s\S]*?<\/nav>/)[0];
const start=html.indexOf('function showSection(section)');
const showSection=html.slice(start,html.indexOf('// GESTORES',start));
const css=fs.readFileSync(path.join(root,'css/tailwind.min.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'css/work-navigation.css'),'utf8');
const output=process.env.PTH_NAV_SCREENSHOTS;
function luminance(color){const c=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const width of [360,390,1280])for(const dark of [false,true]){
   const page=await browser.newPage({viewport:{width,height:220}});
   await page.route('**/*',route=>route.abort());
   await page.setContent(`<!doctype html><html lang="es" class="${dark?'dark':'light'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="background:${dark?'#020617':'#f8fafc'}"><main style="max-width:1200px;margin:auto">${nav}<div id="sec-catalogo"></div><div id="sec-dashboard" class="hidden"></div></main><script>var myOrdersData=[];const offlineStorefront={usingCopy:()=>false};${showSection}</script></body></html>`);
   assert.equal(await page.locator('#admin-nav').isVisible(),false,'session-controlled hidden state retained');
   await page.evaluate(()=>document.getElementById('admin-nav').classList.remove('hidden'));
   assert.equal(await page.locator('#work-feedback-link').getAttribute('href'),'feedback.html');
   const check=async()=>{
    const controls=await page.locator('#admin-nav > *').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {text:n.textContent.trim(),width:r.width,height:r.height,right:r.right,left:r.left,scroll:n.scrollWidth,client:n.clientWidth,color:s.color,background:s.backgroundColor};}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const c of controls){assert.ok(c.height>=44&&c.width>=44);assert.ok(c.left>=0&&c.right<=width);assert.ok(c.scroll<=c.client);const l=[luminance(c.color),luminance(c.background)].sort((a,b)=>b-a);assert.ok((l[0]+.05)/(l[1]+.05)>=4.5,`contrast: ${c.text}`);}
   };
   await check();
   await page.click('#tab-dash');assert.equal(await page.locator('#tab-dash').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#tab-cat').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#sec-catalogo').evaluate(n=>n.style.display),'none');assert.equal(await page.locator('#sec-dashboard').evaluate(n=>n.classList.contains('hidden')),false);await check();
   await page.click('#tab-cat');assert.equal(await page.locator('#tab-cat').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#sec-catalogo').evaluate(n=>n.style.display),'block');
   await page.mouse.move(0,210);
   if(output)await page.screenshot({path:path.join(output,`navigation-${width}-${dark?'dark':'light'}.png`)});
   await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Tab');
   // Focus a known control through the keyboard and ensure a visible outline.
   await page.locator('#tab-cat').focus();await page.keyboard.press('Tab');
   const focus=await page.locator('#tab-dash').evaluate(n=>({active:n===document.activeElement,outline:getComputedStyle(n).outlineWidth,style:getComputedStyle(n).outlineStyle}));assert.equal(focus.active,true);assert.equal(focus.outline,'3px');assert.equal(focus.style,'solid');
   await page.addStyleTag({content:'#admin-nav > button,#admin-nav > a {font-size:26px}'});await check();
   await page.close();console.log(`PASS ${width}px ${dark?'dark':'light'}: hidden gate, destinations, switches, active state, >=44px targets, contrast >=4.5, keyboard focus, normal/enlarged text without overflow`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
