# Quick Story and saved catalogue explanation

Baseline: bee40f524980f2e82d80b86ea78b7fd853406971. Target: existing
main/root GitHub Pages publication for paratuhogar.org, explicitly approved.

Story's actual product/list/dashboard buttons now open a separate single-product
interface. Opening a product verifies its available catalogue data and contact,
then prepares one 1080×1920 JPEG automatically. Four design buttons regenerate
the image; sharing is a second explicit click. The browser chooses the app and
recipient. Unsupported file sharing downloads one JPEG. Copying information is
optional. The full Magic Studio editor, formats and commercial rules remain.

The existing Studio renderer and secure-data catalogue/pricing resolution are
reused. No authorization, database, customer-data, order, price, commission or
payment changes. Story does not persist products, private data or generated
files. Account changes and closing cancel preparation and revoke image URLs.
Fresh product/contact changes require review and explicit regeneration. Files
expire after the existing five-minute limit. Failed photos never create partial
artwork. Story resources load only when opened; the full editor is not fetched.

The saved catalogue button now explains consultation of the latest saved copy
without internet, saving first while connected, reference prices/availability,
and that offline photos require a previously saved photo. This release does
not add pending offline orders or alter public search.

Assets use quickstory1. The worker's static cache advances to quickstory1;
push import, subscription code and registration URLs remain unchanged. Only
the existing public shell is precached, with no private data/generated images.

Validation: 274 Node regressions; actual storefront browser checks for four
roles including product/list Story entry and checkout guards; quick Story at
320/390/1280 pixels (actual JPEGs, four designs, keyboard/Escape/focus, sharing
activation/cancellation/duplicate invocation, download, scoped subaccount price,
late requests/session change, network/photo/auth failures and retry); full Magic
Studio browser suite; 12 data-saving/card profiles; lazy-loader dependency order
and retry; three public-reader sizes and actual worker upgrade. Traffic and
accounts are synthetic/intercepted, with no real messages/orders. JS and CSS
builds and reproducibility/diff checks pass. Local screenshots/downloads are in
/tmp/pth-quick-story-tested, not published.

Rollback: ordinary revert of this release commit followed by the same Pages
publication, preserving later work. No SQL rollback. Real-device WhatsApp
attachment reception remains a phone check, not proven by mocked native APIs.
