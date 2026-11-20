const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'View_Landing_Modern.html'), 'utf8');
const modernJs = fs.readFileSync(path.join(root, 'JS_Modern.html'), 'utf8');

test('landing memiliki tombol Informasi Hasil Penilaian', function () {
  assert.match(landing, /onclick="showInformasiHasilPenilaian\(\)"/);
  assert.match(landing, /Informasi Hasil Penilaian/);
});

test('fungsi modal memanggil endpoint publik dan meng-escape urusan', function () {
  assert.match(modernJs, /window\.showInformasiHasilPenilaian\s*=\s*function/);
  assert.match(modernJs, /\.getRekapUrusanPublik\(\)/);
  assert.match(modernJs, /escHtml\(d\.urusan\)/);
});
