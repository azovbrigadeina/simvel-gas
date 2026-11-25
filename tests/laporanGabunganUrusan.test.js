const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const ctx = { console, Number, parseFloat, String, Object, Array, Math, RegExp };
  vm.createContext(ctx);
  ['JawabanController.js', 'LaporanController.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

function dataDuaOpdSatuUrusan() {
  const ds = [
    ['P1', 'B. FAKTOR TEKNIS', 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', 'Q1', '', '', '', '', '', ''],
    ['P2', 'B. FAKTOR TEKNIS', 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', 'Q2', '', '', '', '', '', ''],
    ['P3', 'B. FAKTOR TEKNIS', 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', 'Q3', '', '', '', '', '', '']
  ];
  const dv = [
    ['t', 'Dinas Tanaman Pangan dan Hortikultura', 'P1', 0, 300, ''],
    ['t', 'Dinas Perkebunan dan Peternakan', 'P2', 0, 200, ''],
    ['t', 'Dinas Perkebunan dan Peternakan', 'P3', 0, 100, '']
  ];
  return { ds: ds, dj: [], dv: dv };
}

test('getLaporanNilai menggabungkan dua OPD pada urusan yang sama menjadi satu baris', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return dataDuaOpdSatuUrusan(); };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 100, excludedBonus: [] }; };

  const res = JSON.parse(JSON.stringify(ctx.getLaporanNilai()));

  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].urusan, 'URUSAN PEMERINTAHAN BIDANG PERTANIAN');
  assert.strictEqual(res[0].faktor_umum, 100);
  assert.strictEqual(res[0].faktor_teknis, 600);
  assert.strictEqual(res[0].total_akhir, 770);
  assert.deepStrictEqual(res[0].opds, [
    'Dinas Tanaman Pangan dan Hortikultura',
    'Dinas Perkebunan dan Peternakan'
  ]);
});

test('getRekapUrusanPublik memakai total gabungan dua OPD, bukan rata-rata', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return dataDuaOpdSatuUrusan(); };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 100, excludedBonus: [] }; };

  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));

  assert.deepStrictEqual(res, [
    {
      urusan: 'URUSAN PEMERINTAHAN BIDANG PERTANIAN',
      total_nilai: 770,
      intensitas: 'Sedang',
      tipe: 'Tipe B'
    }
  ]);
});

test('_cariLaporanUrusan mengembalikan satu baris gabungan untuk nama urusan yang sama', function () {
  const ctx = loadContext();
  const data = dataDuaOpdSatuUrusan();
  const laporan = ctx._computeLaporanNilai(data.ds, data.dv, 100, []);

  const res = JSON.parse(JSON.stringify(
    ctx._cariLaporanUrusan(laporan, '  urusan pemerintahan   bidang pertanian ')
  ));

  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].urusan, 'URUSAN PEMERINTAHAN BIDANG PERTANIAN');
  assert.strictEqual(res[0].faktor_teknis, 600);
  assert.strictEqual(res[0].total_akhir, 770);
  assert.strictEqual(res[0].opds.length, 2);
});

test('_computeJawabanBySubKategori mencocokkan nama urusan setelah spasi dinormalkan', function () {
  const ctx = loadContext();
  const data = dataDuaOpdSatuUrusan();

  const res = ctx._computeJawabanBySubKategori(
    '  urusan pemerintahan   bidang pertanian ',
    data.ds,
    data.dj,
    data.dv
  );

  assert.strictEqual(res.length, 3);
});

test('modal Lihat OPD menampilkan seluruh OPD pengisi urusan', function () {
  const js = fs.readFileSync(path.join(__dirname, '..', 'JS.html'), 'utf8');
  assert.match(js, /data\.opds/);
});

test('getStats menghitung tipe per urusan gabungan, bukan per OPD', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return dataDuaOpdSatuUrusan(); };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 100, excludedBonus: [] }; };
  ctx.Firebase = { get: function () { return {}; } };

  const res = JSON.parse(JSON.stringify(ctx.getStats()));

  assert.strictEqual(res.tipeB, 1);
  assert.strictEqual(res.tipeA, 0);
  assert.strictEqual(res.tipeC, 0);
});
