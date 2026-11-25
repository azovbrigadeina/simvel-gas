const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'JS.html'), 'utf8');
const modern = fs.readFileSync(path.join(root, 'View_Evaluator_Modern.html'), 'utf8');
const classic = fs.readFileSync(path.join(root, 'View_Evaluator.html'), 'utf8');
const cssModern = fs.readFileSync(path.join(root, 'CSS_Modern.html'), 'utf8');
const cssClassic = fs.readFileSync(path.join(root, 'CSS.html'), 'utf8');

test('kedua view evaluator punya tombol Cetak Rekap', function () {
  [modern, classic].forEach(function (html) {
    assert.match(html, /cetakRekapSemuaUrusan\(\)/);
    assert.match(html, /Cetak Rekap/);
    assert.match(html, /btn-cetak-rekap/);
  });
});

test('handler memanggil endpoint PDF dan membuka URL', function () {
  assert.match(js, /function cetakRekapSemuaUrusan\(/);
  assert.match(js, /\.buatRekapSemuaUrusanPDF\(/);
  assert.match(js, /window\.open\(url/);
});

test('tombol punya glow dan menghormati prefers-reduced-motion', function () {
  [cssModern, cssClassic].forEach(function (css) {
    assert.match(css, /\.btn-cetak-rekap/);
    assert.match(css, /@keyframes cetakRekapGlow/);
    assert.match(css, /prefers-reduced-motion[\s\S]{0,200}btn-cetak-rekap/);
  });
});
