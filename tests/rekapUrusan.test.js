const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const ctx = { console, Number, parseFloat, String, Object, Array, Math };
  vm.createContext(ctx);
  ['JawabanController.js', 'LaporanController.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

test('_aggregateRekapUrusan menggabungkan OPD menjadi satu urusan dengan menjumlahkan faktor teknis', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', faktor_umum: 100, faktor_teknis: 300, total_akhir: 400, bonus_applied: false, opd: 'A' },
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', faktor_umum: 100, faktor_teknis: 400, total_akhir: 500, bonus_applied: false, opd: 'B' },
    { urusan: 'Urusan Kesehatan', faktor_umum: 100, faktor_teknis: 400, total_akhir: 500, bonus_applied: false, opd: 'C' }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', total_nilai: 800, intensitas: 'Sedang', tipe: 'Tipe B' },
    { urusan: 'Urusan Kesehatan', total_nilai: 500, intensitas: 'Kecil', tipe: 'Tipe C' }
  ]);
});

test('_aggregateRekapUrusan menggabungkan variasi spasi/huruf dan mengabaikan Umum', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan Kesehatan', faktor_umum: 100, faktor_teknis: 100, total_akhir: 200, bonus_applied: false },
    { urusan: '  urusan   kesehatan ', faktor_umum: 100, faktor_teknis: 200, total_akhir: 300, bonus_applied: false },
    { urusan: 'Umum', faktor_umum: 0, faktor_teknis: 999, total_akhir: 999 },
    { urusan: '', faktor_umum: 0, faktor_teknis: 12, total_akhir: 12 }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Kesehatan', total_nilai: 400, intensitas: 'Sangat Kecil', tipe: 'Bidang' }
  ]);
});

test('_aggregateRekapUrusan menangani satu OPD dan lebih dari dua OPD', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan A', faktor_umum: 0, faktor_teknis: 400, total_akhir: 400, bonus_applied: false },
    { urusan: 'Urusan B', faktor_umum: 0, faktor_teknis: 100, total_akhir: 100, bonus_applied: false },
    { urusan: 'Urusan B', faktor_umum: 0, faktor_teknis: 200, total_akhir: 200, bonus_applied: false },
    { urusan: 'Urusan B', faktor_umum: 0, faktor_teknis: 300, total_akhir: 300, bonus_applied: false }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan B', total_nilai: 600, intensitas: 'Kecil', tipe: 'Tipe C' },
    { urusan: 'Urusan A', total_nilai: 400, intensitas: 'Sangat Kecil', tipe: 'Bidang' }
  ]);
});

test('getRekapUrusanPublik memakai data laporan dan hanya mengembalikan 3 kolom publik', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () {
    return [
      { urusan: 'Urusan Pendidikan', total_akhir: 300, faktor_umum: 0, faktor_teknis: 300, bonus_applied: false, opd: 'A' },
      { urusan: 'Urusan Pendidikan', total_akhir: 400, faktor_umum: 0, faktor_teknis: 400, bonus_applied: false, opd: 'B' }
    ];
  };
  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Pendidikan', total_nilai: 700, intensitas: 'Sedang', tipe: 'Tipe B' }
  ]);
});

test('getRekapUrusanPublik menghitung total gabungan per OPD saat nama urusan bervariasi', function () {
  const ctx = loadContext();
  const ds = [
    ['1', 'B. FAKTOR TEKNIS', 'Urusan X', 'Pertanyaan 1', '', '', '', '', '', ''],
    ['2', 'B. FAKTOR TEKNIS', 'urusan   x', 'Pertanyaan 2', '', '', '', '', '', ''],
    ['3', 'B. FAKTOR TEKNIS', 'Urusan X', 'Pertanyaan 3', '', '', '', '', '', '']
  ];
  const dv = [
    ['t', 'OPD A', '1', 0, 300, ''],
    ['t', 'OPD A', '2', 0, 50, ''],
    ['t', 'OPD B', '3', 0, 200, '']
  ];
  ctx._loadSharedData = function () { return { ds: ds, dj: [], dv: dv }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 100, excludedBonus: [] }; };

  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan X', total_nilai: 715, intensitas: 'Sedang', tipe: 'Tipe B' }
  ]);
});

test('getRekapUrusanPublik memakai cache bila tersedia', function () {
  const ctx = loadContext();
  let loadCount = 0;
  ctx._loadSharedData = function () { loadCount++; return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  ctx.CacheService = {
    getScriptCache: function () {
      return {
        get: function () { return JSON.stringify([{ urusan: 'Cache', total_nilai: 1, intensitas: 'X', tipe: 'Y' }]); },
        put: function () {}
      };
    }
  };
  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, [
    { urusan: 'Cache', total_nilai: 1, intensitas: 'X', tipe: 'Y' }
  ]);
  assert.strictEqual(loadCount, 0);
});

test('getRekapUrusanPublik mengembalikan array kosong saat belum ada data', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, []);
});
