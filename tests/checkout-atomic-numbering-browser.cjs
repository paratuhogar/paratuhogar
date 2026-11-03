// Same real-page fixture, with reservation explicitly forbidden.
process.env.PTH_ATOMIC_NUMBERING='1';
require('./checkout-recovery-latest-browser.cjs');
