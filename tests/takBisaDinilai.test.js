const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadContext() {
  const ctx = { console, Number, parseFloat, String, Object, Array, Math, RegExp, Set, Date };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'JawabanController.js'), 'utf8'), ctx, { filename: 'JawabanController.js' });
  return ctx;
}

// ds = [id, kategori_utama, sub, pertanyaan, indikator, data_dukung, penjelasan, referensi, bobot, target]
const DS = [
  ['P10', 'B. FAKTOR TEKNIS', 'Urusan Kesehatan', 'q1', '', '', '', '', '10|20|30|40|50', ''],
  ['P11', 'B. FAKTOR TEKNIS', 'Urusan Kesehatan', 'q2', '', '', '', '', '10|20|30|40|50', ''],
  ['P12', 'B. FAKTOR TEKNIS', 'Urusan Pendidikan', 'q3', '', '', '', '', '10|20|30|40|50', '']
];
// dj = [timestamp, opd, id, skala_responden, link, pilihan, nama_dokumen, sistem_nilai, sumber, penjelasan, link_arsip]
const DJ = [
  ['t', 'OPD A', 'P10', 30, '', '', '', '', '', '', ''],
  ['t', 'OPD A', 'P11', 20, '', '', '', '', '', '', ''],
  ['t', 'OPD A', 'P12', 20, '', '', '', '', '', '', '']
];
// dv = [timestamp, opd, id, skala_responden, skala_evaluator, catatan]
const DV = [
  ['t', 'OPD A', 'P10', 30, 0, 'Data tidak lengkap'],
  ['t', 'OPD A', 'P11', 20, 20, ''],
  ['t', 'OPD A', 'P12', 20, 0, 'Belum ada bukti']
];

test('total_tak_dinilai menghitung verifikasi bernilai 0 per sub-kategori', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._computeSubKatStats(DS, DJ, DV)));
  const kes = res.find(r => r.nama === 'Urusan Kesehatan');
  const pend = res.find(r => r.nama === 'Urusan Pendidikan');
  assert.strictEqual(kes.total_tak_dinilai, 1);
  assert.strictEqual(pend.total_tak_dinilai, 1);
});

test('total_divalidasi tetap menghitung butir bernilai 0 sebagai tervalidasi', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._computeSubKatStats(DS, DJ, DV)));
  const kes = res.find(r => r.nama === 'Urusan Kesehatan');
  assert.strictEqual(kes.total_divalidasi, 2);
  assert.strictEqual(kes.total_jawaban, 2);
});

test('total_tak_dinilai 0 bila tidak ada nilai 0', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._computeSubKatStats(DS, DJ, [['t','OPD A','P10',30,30,'']])));
  const kes = res.find(r => r.nama === 'Urusan Kesehatan');
  assert.strictEqual(kes.total_tak_dinilai, 0);
});
