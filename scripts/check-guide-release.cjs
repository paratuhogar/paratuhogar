const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
function checkGuideRelease(root = path.resolve(__dirname, '..')) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'guias/gestores.json'), 'utf8'));
    const pdfPath = path.join(root, 'guias/guia-gestores.pdf');
    if (manifest.published === false) {
        assert.equal(manifest.status, 'pending', 'Unpublished guide must remain pending.');
        assert.equal(fs.existsSync(pdfPath), false, 'Do not stage a draft at the public final PDF path.');
        return { published: false };
    }
    assert.equal(manifest.published, true);
    assert.equal(manifest.status, 'final', 'Only a reviewed final guide can activate the card.');
    assert.equal(manifest.path, '/guias/guia-gestores.pdf');
    assert.match(manifest.revision, /^\d{4}-\d{2}-\d{2}\.\d+$/);
    assert.match(manifest.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    const date = new Date(manifest.updatedAt + 'T12:00:00Z');
    assert.equal(date.toISOString().slice(0, 10), manifest.updatedAt, 'Date must be valid.');
    assert.equal(fs.lstatSync(pdfPath).isSymbolicLink(), false);
    const bytes = fs.readFileSync(pdfPath);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.subarray(-8192).includes(Buffer.from('%%EOF')), 'PDF must have an end marker.');
    assert.ok(bytes.length >= 10 && bytes.length <= 5000000, 'Guide must be at most 5,000,000 bytes.');
    assert.equal(manifest.bytes, bytes.length, 'Display the exact released file size.');
    assert.equal(manifest.sha256, crypto.createHash('sha256').update(bytes).digest('hex'), 'Revision must identify the actual released bytes.');
    return { published: true, bytes: bytes.length, revision: manifest.revision };
}
if (require.main === module) { try { console.log(JSON.stringify(checkGuideRelease())); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { checkGuideRelease };
