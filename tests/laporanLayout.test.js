const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'JS.html'), 'utf8');
const cssModern = fs.readFileSync(path.join(root, 'CSS_Modern.html'), 'utf8');
const cssClassic = fs.readFileSync(path.join(root, 'CSS.html'), 'utf8');
const modern = fs.readFileSync(path.join(root, 'View_Evaluator_Modern.html'), 'utf8');
const classic = fs.readFileSync(path.join(root, 'View_Evaluator.html'), 'utf8');

test('tabel laporan memakai kolom No dan OPD serta kelas layout', function () {
  assert.match(js, /lap-col-urusan/);
  assert.match(js, /lap-col-opd/);
  assert.match(js, /lap-col-total/);
  assert.match(js, /lap-aksi/);
});

test('tabel laporan punya pesan saat data kosong', function () {
  assert.match(js, /Belum ada data penilaian/);
});

test('kolom OPD memakai jumlah OPD pengisi urusan', function () {
  assert.match(js, /daftarOpd\.length/);
  assert.match(js, /Array\.isArray\(d\.opds\)/);
});

test('CSS modern dan classic: angka center, total & bonus center, tanpa scroll internal', function () {
  [cssModern, cssClassic].forEach(function (css) {
    assert.match(css, /\.lap-table/);
    assert.match(css, /\.lap-col-urusan/);
    assert.match(css, /\.lap-col-num\s*\{[^}]*text-align:\s*center/);
    assert.match(css, /\.lap-col-total\s*\{[^}]*text-align:\s*center/);
    assert.match(css, /\.lap-total-cell\s*\{[^}]*flex-direction:\s*column[^}]*align-items:\s*center/);
    assert.doesNotMatch(css, /\.lap-scroll\s*\{[^}]*max-height/);
  });
});

test('sel total menumpuk angka dan badge bonus secara center', function () {
  assert.match(js, /lap-total-cell/);
  assert.match(js, /<span class="lap-total-value">[\s\S]{0,120}<\/span>\$\{bonusBadge\}/);
});

test('baris laporan diberi color scale 5 tingkat sesuai intensitas/tipe', function () {
  assert.match(js, /lap-tier-\$\{/);
  assert.match(js, /function lapTier\(/);
  assert.match(js, /<= 300/);
  assert.match(js, /<= 400/);
  assert.match(js, /<= 600/);
  assert.match(js, /<= 800/);
  [cssModern, cssClassic].forEach(function (css) {
    for (let i = 1; i <= 5; i++) {
      assert.match(css, new RegExp('\\.lap-tier-' + i + ' td\\s*\\{[^}]*background-color'));
      assert.match(css, new RegExp('\\.lap-tier-' + i + ' td:first-child'));
    }
  });
});

test('badge intensitas/tipe memakai warna tier dan ada legenda color scale', function () {
  assert.match(js, /lap-badge-\$\{/);
  [cssModern, cssClassic].forEach(function (css) {
    assert.match(css, /\.lap-badge-1/);
    assert.match(css, /\.lap-legend-bar/);
  });
  [modern, classic].forEach(function (html) {
    assert.match(html, /lap-legend/);
  });
});
