const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Preserve the original stylesheet order and relative asset paths.
const sources = [
  'client-followup',
  'work-navigation',
  'gestor-guide',
  'gestor-ranking',
  'work-welcome',
  'low-connectivity',
  'offline-storefront',
  'admin-panel',
  'feedback-announcement'
];
const output = sources.map(name => {
  const css = fs.readFileSync(path.join(root, 'css', name + '.css'), 'utf8');
  if (/@(?:import|charset)\b/i.test(css)) {
    throw new Error('Cannot concatenate top-level CSS directives in ' + name);
  }
  return '/* ' + name + '.css */\n' + css.trim() + '\n';
}).join('\n');
const target = path.join(root, 'css/storefront-support.css');

if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
    throw new Error('Rebuild css/storefront-support.css with npm run build:css.');
  }
} else {
  fs.writeFileSync(target, output);
}
