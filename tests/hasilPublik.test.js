const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'JS.html'), 'utf8');
const jsModern = fs.readFileSync(path.join(root, 'JS_Modern.html'), 'utf8');
const indexModern = fs.readFileSync(path.join(root, 'Index_Modern.html'), 'utf8');

test('landing modern memuat JS.html yang mendefinisikan lapTier', function () {
  assert.match(indexModern, /include\('JS'\)/);
  assert.match(js, /function lapTier\(/);
});

test('informasi hasil penilaian publik memakai color scale tier', function () {
  assert.match(jsModern, /lapTier\(d\)/);
  assert.match(jsModern, /lap-tier-' \+ tier/);
  assert.match(jsModern, /lap-badge-' \+ tier/);
});
