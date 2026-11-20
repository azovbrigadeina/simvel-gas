const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const ctx = { console, Number, parseFloat, String, Object, Array, Math, RegExp, Date };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'LaporanController.js'), 'utf8'), ctx, { filename: 'LaporanController.js' });
  return ctx;
}

test('_formatSkorEval menampilkan 0 sebagai 0, bukan strip', function () {
  const ctx = loadContext();
  assert.strictEqual(ctx._formatSkorEval({ skala_evaluator: 0 }), '0');
});

test('_formatSkorEval menampilkan nilai normal', function () {
  const ctx = loadContext();
  assert.strictEqual(ctx._formatSkorEval({ skala_evaluator: 80 }), '80');
});

test('_formatSkorEval menampilkan strip untuk kosong/null/undefined', function () {
  const ctx = loadContext();
  assert.strictEqual(ctx._formatSkorEval({ skala_evaluator: "" }), '-');
  assert.strictEqual(ctx._formatSkorEval({ skala_evaluator: null }), '-');
  assert.strictEqual(ctx._formatSkorEval({}), '-');
});
