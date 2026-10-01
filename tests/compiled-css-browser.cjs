// Exercises the delivered stylesheet without the Tailwind runtime or any network.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const palette = require('tailwindcss/colors');
const config = require('../tailwind.config.cjs');
const css = fs.readFileSync(path.join(__dirname, '../css/tailwind.min.css'), 'utf8');
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')})`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await page.route('**/*', route => route.abort());
    await page.setContent(`<!doctype html><style>${css}</style><div id="subject"></div><input id="form" type="text">`);
    const style = async (classes, property) => page.locator('#subject').evaluate((node, args) => {
      node.className = args.classes;
      return getComputedStyle(node).getPropertyValue(args.property);
    }, { classes, property });

    // Cover every assembled level-card and payout-summary class, not just literals.
    for (const utility of config.safelist) {
      const [, type, color, shade, alpha] = utility.match(/^(border|bg|text)-([a-z]+)-(\d+)(?:\/(\d+))?$/);
      const actual = await style(utility, { border: 'border-top-color', bg: 'background-color', text: 'color' }[type]);
      const base = rgb(palette[color][shade]);
      assert.equal(actual, alpha ? base.replace('rgb(', 'rgba(').replace(')', `, ${Number(alpha) / 100})`) : base, utility);
    }
    assert.equal(await style('bg-primary', 'background-color'), 'rgb(26, 71, 137)');
    assert.equal(await style('bg-[#25D366]', 'background-color'), 'rgb(37, 211, 102)', 'lazy squad module arbitrary color');
    assert.equal(await style('text-[9px]', 'font-size'), '9px');
    assert.equal(await style('h-[220px] sm:h-[300px] md:h-[420px]', 'height'), '220px');
    await page.setViewportSize({ width: 1280, height: 800 });
    assert.equal(await style('h-[220px] sm:h-[300px] md:h-[420px]', 'height'), '420px');
    assert.match(await style('bg-gradient-to-r from-purple-700 to-purple-600', 'background-image'), /^linear-gradient\(to right,/);
    assert.equal(await style('bg-background-light dark:bg-background-dark', 'background-color'), 'rgb(248, 250, 252)');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    assert.equal(await style('bg-background-light dark:bg-background-dark', 'background-color'), 'rgb(15, 23, 42)');
    assert.equal(await page.locator('#form').evaluate(node => getComputedStyle(node).appearance), 'none', 'forms plugin remains present');
    console.log(`PASS compiled CSS: ${config.safelist.length} dynamic utilities, theme, lazy module, arbitrary values, responsive sizing, gradients, dark mode and forms without network`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
