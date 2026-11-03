// Real storefront, browser clock +1h/-1h; server fixture keeps correct time.
process.env.PTH_PHONE_CLOCK_TEST='1';
require('./checkout-atomic-numbering-browser.cjs');
