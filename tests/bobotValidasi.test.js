const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const ctx = { console, Number, parseFloat, String, Object, Array, Math, RegExp };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'SoalController.js'), 'utf8'), ctx, { filename: 'SoalController.js' });
  return ctx;
}

test('_validateBobot menerima 5 angka dipisah pipe', function () {
  const ctx = loadContext();
  assert.strictEqual(ctx._validateBobot('10|20|30|40|50'), '10|20|30|40|50');
});

test('_validateBobot merapikan spasi', function () {
  const ctx = loadContext();
  assert.strictEqual(ctx._validateBobot(' 10 | 20 | 30 | 40 | 50 '), '10|20|30|40|50');
});

test('_validateBobot menolak jumlah nilai bukan 5', function () {
  const ctx = loadContext();
  assert.throws(() => ctx._validateBobot('10|20|30'), /5 nilai/);
});

test('_validateBobot menolak nilai 0', function () {
  const ctx = loadContext();
  assert.throws(() => ctx._validateBobot('0|20|30|40|50'), /lebih dari 0/);
});

test('_validateBobot menolak bukan angka', function () {
  const ctx = loadContext();
  assert.throws(() => ctx._validateBobot('10|20|abc|40|50'), /angka/);
});
