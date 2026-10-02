// Whitespace/comment reduction only: preserve names and disable optimizations.
const fs = require('node:fs');
const path = require('node:path');
const { minify } = require('terser');
const root = path.resolve(__dirname, '..');
const entries = ['storefront', 'storefront-extras', 'sales-tools'];
const options = { compress: false, mangle: false, format: { comments: false } };
async function build(check = false) {
  for (const entry of entries) {
    const source = fs.readFileSync(path.join(root, `js/${entry}.js`), 'utf8');
    const output = (await minify(source, options)).code + '\n';
    const target = path.join(root, `js/${entry}.min.js`);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
        throw Error(`Rebuild js/${entry}.min.js with npm run build:js.`);
      }
    } else fs.writeFileSync(target, output);
  }
}
if (require.main === module) build(process.argv.includes('--check')).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { build };
