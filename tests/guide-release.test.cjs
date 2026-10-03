const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkGuideRelease } = require('../scripts/check-guide-release.cjs');
test('guide release refuses missing, draft, mismatched and oversized files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pth-guide-release-'));
    const dir = path.join(root, 'guias'); fs.mkdirSync(dir);
    const file = path.join(dir, 'guia-gestores.pdf');
    const metadata = path.join(dir, 'gestores.json');
    const save = value => fs.writeFileSync(metadata, JSON.stringify(value));
    try {
        save({ published: false, status: 'pending' });
        assert.deepEqual(checkGuideRelease(root), { published: false });
        fs.writeFileSync(file, '%PDF-1.7\nlocal test fixture\n%%EOF\n');
        assert.throws(() => checkGuideRelease(root), /draft/);
        const bytes = fs.readFileSync(file);
        const release = { published: true, status: 'final', path: '/guias/guia-gestores.pdf', updatedAt: '2026-10-03', revision: '2026-10-03.1', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
        save({ ...release, status: 'draft' }); assert.throws(() => checkGuideRelease(root), /reviewed final/);
        save({ ...release, bytes: bytes.length + 1 }); assert.throws(() => checkGuideRelease(root), /exact released file size/);
        save({ ...release, sha256: '0'.repeat(64) }); assert.throws(() => checkGuideRelease(root), /actual released bytes/);
        save({ ...release, updatedAt: '2026-02-30' }); assert.throws(() => checkGuideRelease(root), /valid/);
        save(release); assert.equal(checkGuideRelease(root).published, true);
        fs.writeFileSync(file, Buffer.alloc(5000001)); save({ ...release, bytes: 5000001 });
        assert.throws(() => checkGuideRelease(root));
        fs.rmSync(file); assert.throws(() => checkGuideRelease(root));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
