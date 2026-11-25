const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeDocApp(state) {
  return {
    HorizontalAlignment: { CENTER: 'center' },
    create: function (name) {
      state.docName = name;
      const body = {
        clear: function () {},
        setPageWidth: function (w) { state.pageWidth = w; },
        setPageHeight: function (h) { state.pageHeight = h; },
        appendParagraph: function (text) {
          state.paragraphs.push(text);
          return {
            setAlignment: function () { return this; },
            editAsText: function () {
              return {
                setBold: function () { return this; },
                setFontSize: function () { return this; }
              };
            }
          };
        },
        appendTable: function () {
          state.tableCreated = true;
          const table = {
            rows: [],
            appendTableRow: function () {
              const row = {
                cells: [],
                appendTableCell: function (content) {
                  const cell = {
                    text: content,
                    setText: function (t) { this.text = t; return this; },
                    setBackgroundColor: function (c) { this.bg = c; return this; },
                    editAsText: function () {
                      const self = this;
                      return { setBold: function (b) { self.bold = b; return this; } };
                    }
                  };
                  row.cells.push(cell);
                  return cell;
                },
                // Baris baru dari appendTableRow() tidak punya sel; getCell
                // harus mengembalikan null seperti DocumentApp asli.
                getCell: function (i) { return row.cells[i] || null; }
              };
              table.rows.push(row);
              state.rows.push(row);
              return row;
            }
          };
          state.table = table;
          return table;
        }
      };
      return {
        getId: function () { return 'DOC123'; },
        getBody: function () { return body; },
        saveAndClose: function () { state.saved = true; }
      };
    }
  };
}

function loadContext(state) {
  const ctx = {
    console, Number, parseFloat, String, Object, Array, Math, RegExp, Date,
    requireRole: function (token, roles) {
      state.requireRoleArgs = { token: token, roles: roles };
    }
  };
  ctx.PropertiesService = {
    getScriptProperties: function () {
      return { getProperty: function (key) { return key === 'folder_id' ? 'FOLDER1' : null; } };
    }
  };
  ctx.Session = { getScriptTimeZone: function () { return 'Asia/Jakarta'; } };
  ctx.Utilities = { formatDate: function () { return '25-11-2026 10:00'; } };
  ctx.DocumentApp = fakeDocApp(state);
  ctx.DriveApp = {
    getFolderById: function (folderId) {
      state.folderId = folderId;
      return {
        createFile: function (blob) {
          if (blob && blob.name) state.blobName = blob.name;
          return { getUrl: function () { return 'https://drive.google.com/file/d/PDF123/view'; } };
        }
      };
    },
    getFileById: function () {
      return {
        getAs: function () {
          return { setName: function (n) { state.blobName = n; return this; } };
        },
        setTrashed: function (v) { state.trashed = v; }
      };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'LaporanController.js'), 'utf8'), ctx, { filename: 'LaporanController.js' });
  return ctx;
}

function stubRekap(ctx) {
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  ctx._aggregateRekapUrusan = function () {
    return [
      { urusan: 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', total_nilai: 600.6, intensitas: 'Kecil', tipe: 'Tipe C' },
      { urusan: 'Urusan Kesehatan', total_nilai: 450, intensitas: 'Sangat Kecil', tipe: 'Bidang' }
    ];
  };
}

function cellTexts(row) {
  return row.cells.map(function (c) { return c.text; });
}

test('buatRekapSemuaUrusanPDF menulis header dan isi tabel 3 kolom yang benar', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  stubRekap(ctx);

  const url = ctx.buatRekapSemuaUrusanPDF('tok');

  assert.strictEqual(url, 'https://drive.google.com/file/d/PDF123/view');
  assert.strictEqual(JSON.stringify(state.requireRoleArgs.roles), JSON.stringify(['Admin', 'Evaluator']));
  assert.strictEqual(state.docName, 'Rekap Hasil Penilaian - 25-11-2026 10:00');
  assert.strictEqual(state.blobName, 'Rekap Hasil Penilaian - 25-11-2026 10:00.pdf');
  assert.strictEqual(state.folderId, 'FOLDER1');
  assert.strictEqual(state.tableCreated, true);
  assert.strictEqual(state.rows.length, 3);
  assert.strictEqual(
    JSON.stringify(cellTexts(state.rows[0])),
    JSON.stringify(['Urusan', 'Total Nilai', 'Intensitas & Tipe'])
  );
  assert.strictEqual(
    JSON.stringify(cellTexts(state.rows[1])),
    JSON.stringify(['URUSAN PEMERINTAHAN BIDANG PERTANIAN', '600.60', 'Kecil / Tipe C'])
  );
  assert.strictEqual(
    JSON.stringify(cellTexts(state.rows[2])),
    JSON.stringify(['Urusan Kesehatan', '450.00', 'Sangat Kecil / Bidang'])
  );
  assert.ok(state.paragraphs.indexOf('REKAPITULASI HASIL PENILAIAN') !== -1);
  assert.strictEqual(state.saved, true);
  assert.strictEqual(state.trashed, true);
});

test('buatRekapSemuaUrusanPDF memakai ukuran kertas A4', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  stubRekap(ctx);

  ctx.buatRekapSemuaUrusanPDF('tok');

  assert.strictEqual(state.pageWidth, 595);
  assert.strictEqual(state.pageHeight, 842);
});

test('buatRekapSemuaUrusanPDF menolak saat tidak ada data', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  ctx._aggregateRekapUrusan = function () { return []; };

  assert.throws(function () { ctx.buatRekapSemuaUrusanPDF('tok'); }, /Tidak ada data untuk direkap/);
  assert.strictEqual(state.tableCreated, undefined);
});

test('buatRekapSemuaUrusanPDF menolak saat folder_id belum diatur', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  ctx.PropertiesService = {
    getScriptProperties: function () { return { getProperty: function () { return null; } }; }
  };

  assert.throws(function () { ctx.buatRekapSemuaUrusanPDF('tok'); }, /ID Folder belum diatur/);
});

test('buatRekapSemuaUrusanPDF tetap mengembalikan URL saat gagal menghapus doc sementara', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  stubRekap(ctx);
  ctx.DriveApp.getFileById = function () {
    return {
      getAs: function () { return { setName: function () { return this; } }; },
      setTrashed: function () { throw new Error('trash gagal'); }
    };
  };

  const url = ctx.buatRekapSemuaUrusanPDF('tok');
  assert.strictEqual(url, 'https://drive.google.com/file/d/PDF123/view');
});

test('buatRekapSemuaUrusanPDF tetap menghapus doc sementara saat pembuatan PDF gagal', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  stubRekap(ctx);
  ctx.DriveApp.getFolderById = function () {
    return {
      createFile: function () { throw new Error('folder hilang'); }
    };
  };

  assert.throws(function () { ctx.buatRekapSemuaUrusanPDF('tok'); }, /folder hilang/);
  assert.strictEqual(state.trashed, true);
});
