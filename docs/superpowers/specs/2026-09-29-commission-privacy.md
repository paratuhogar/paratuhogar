# Confidential commissions

Approved outcome: a subgestor receives only the commission assigned by their principal. The principal's commission and the order's full commission must not appear in their browser, vouchers, history, exports, catalogue cache, or public Data API responses.

Use the existing account records and passwords to authenticate on the server. Replace client-side master password shortcuts with the existing named administrator accounts. Issue opaque, expiring sessions, stored hashed, and resolve the account and hierarchy from the database on every sensitive request. Parent-linked accounts never gain administrator privileges, regardless of their stored or supplied role.

A server data gateway supplies catalogue and account public profiles without finance/password fields. Authenticated principal reads retain their own commission and their team's recorded distribution. Subgestor reads project only their own share and are scoped to their own orders. Administrator access is checked on the server. Existing page queries use a compatibility adapter; mutations apply server ownership checks. New sales calculate the original commission and assigned share from product IDs, quantities and stored price configuration on the server. Approval preserves the stored snapshot.

Revoke public direct access to protected tables and privileged finance RPCs after the frontend and gateway are verified. Existing trigger/service jobs retain service-role access. Clear old shared catalogue caches and partition future caches by verified account. Already sent WhatsApp messages cannot be withdrawn by this change.

Release is coordinated: provision private sessions, deploy and exercise gateway, publish compatible frontend, then apply transactional access restrictions. Verify public denial, principal access, subgestor redaction, preserved commissions and approvals. Do not activate restrictions against a frontend that still needs direct finance reads.
