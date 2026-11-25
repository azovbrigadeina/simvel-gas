const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'JS.html'), 'utf8');
const cssModern = fs.readFileSync(path.join(root, 'CSS_Modern.html'), 'utf8');
const cssClassic = fs.readFileSync(path.join(root, 'CSS.html'), 'utf8');

test('tabel laporan memakai kolom No dan OPD serta kelas layout', function () {
  assert.match(js, /lap-col-urusan/);
  assert.match(js, /lap-col-opd/);
  assert.match(js, /lap-col-total/);
  assert.match(js, /lap-aksi/);
});

test('tabel laporan punya pesan saat data kosong', function () {
  assert.match(js, /Belum ada data penilaian/);
});

test('CSS modern dan classic memuat layout tabel laporan dengan header sticky', function () {
  [cssModern, cssClassic].forEach(function (css) {
    assert.match(css, /\.lap-table/);
    assert.match(css, /\.lap-col-urusan/);
    assert.match(css, /position:\s*sticky/);
  });
});
