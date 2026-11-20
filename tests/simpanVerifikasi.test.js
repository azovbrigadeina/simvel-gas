const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext(overrides) {
  const patches = [];
  const ctx = {
    console,
    Number,
    parseFloat,
    String,
    Object,
    Array,
    Math,
    RegExp,
    Set,
    Date,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => '' })
    },
    requireRole: () => ({ role: 'Admin' }),
    Firebase: Object.assign({
      escapeKey: (s) => s.toString().replace(/\./g, '%2E'),
      unescapeKey: (s) => s.toString().replace(/%2E/g, '.'),
      get: () => null,
      put: () => {},
      patch: (p, u) => { patches.push([p, u]); },
      remove: () => {},
      getCachedMasterPertanyaan: () => ({})
    }, overrides || {})
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'JawabanController.js'), 'utf8'), ctx, { filename: 'JawabanController.js' });
  ctx.__patches = patches;
  return ctx;
}

test('simpanVerifikasi menolak butir bernilai 0 tanpa catatan', function () {
  const ctx = loadContext();
  assert.throws(
    () => ctx.simpanVerifikasi('t', { items: [{ opd: 'A', id_soal: 'P1', skala_evaluator: 0, catatan: '   ' }] }),
    /Tidak Bisa Dinilai/
  );
});

test('simpanVerifikasi menerima butir bernilai 0 dengan catatan', function () {
  const ctx = loadContext();
  const res = ctx.simpanVerifikasi('t', { items: [{ opd: 'A', id_soal: 'P1', skala_evaluator: 0, catatan: 'Data tidak lengkap' }] });
  assert.strictEqual(res, 'Berhasil');
  assert.strictEqual(ctx.__patches.length, 1);
});

test('simpanVerifikasi tetap menerima butir bernilai > 0 tanpa catatan', function () {
  const ctx = loadContext();
  const res = ctx.simpanVerifikasi('t', { items: [{ opd: 'A', id_soal: 'P1', skala_evaluator: 20, catatan: '' }] });
  assert.strictEqual(res, 'Berhasil');
});
