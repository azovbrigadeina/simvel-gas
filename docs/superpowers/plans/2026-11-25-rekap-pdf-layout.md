# Rapikan Tabel Laporan Penilaian + Cetak Rekap PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merapikan tabel Laporan Penilaian dan menambah tombol Cetak Rekap yang menghasilkan satu PDF berisi daftar seluruh urusan (Urusan, Total Nilai, Intensitas & Tipe).

**Architecture:** Backend baru `buatRekapSemuaUrusanPDF(token)` memakai agregasi urusan yang sudah ada, membuat Google Doc programatik berisi judul + tabel 3 kolom, mengekspornya ke PDF di folder `folder_id`, lalu menghapus doc sementara. Frontend merender tabel dengan kelas layout baru dan memanggil endpoint lewat tombol highlight+glow.

**Tech Stack:** Google Apps Script (V8), HtmlService, Bootstrap 5, SweetAlert2, Node.js `node:test` + `vm`.

**Spec:** `docs/superpowers/specs/2026-11-25-rekap-pdf-layout-design.md`

## Global Constraints

- Gaya ES5/ES6 mengikuti kode sekitarnya; jangan menambah dependency.
- Teks dinamis di frontend wajib lewat `escHtml` / `escAttr` / `escJsAttr`.
- `appsscript.json` tidak berubah.
- PDF: A4 portrait, margin normal, judul `REKAPITULASI HASIL PENILAIAN`, nama file `Rekap Hasil Penilaian - dd-MM-yyyy HH:mm.pdf`, disimpan di folder `folder_id`.
- Doc sementara wajib di-trash setelah PDF dibuat.
- Tombol Cetak Rekap wajib highlight + glow, dan animasi dimatikan pada `prefers-reduced-motion: reduce`.
- `buatLaporanUrusan` (cetak per urusan) tidak diubah perilakunya.

## Review Focus

- **Data kosong:** belum ada jawaban/verifikasi → endpoint melempar `Tidak ada data untuk direkap.` dan UI menampilkan pesan ramah, bukan error mentah.
- **Folder belum diatur:** `folder_id` kosong → pesan `ID Folder belum diatur di Pengaturan.`
- **Nama urusan berisi karakter HTML:** tampil sebagai teks di tabel UI, bukan HTML/script.
- **Doc sementara gagal di-trash:** kegagalan tidak boleh menggagalkan pengembalian URL PDF.
- **Urusan diisi 2 OPD:** tetap satu baris dengan nilai gabungan, kolom OPD menampilkan jumlah 2.

---

### Task 1: Backend Cetak Rekap PDF

**Files:**
- Modify: `LaporanController.js` (tambahkan fungsi setelah `_aggregateRekapUrusan`)
- Test: `tests/rekapPdf.test.js`

**Interfaces:**
- Consumes: `_loadSharedData()` → `{ ds, dj, dv }`; `_loadFaktorUmumGlobal()` → `{ faktorUmumGlobal, excludedBonus }`; `_computeLaporanNilai(ds, dv, faktorUmumGlobal, excludedBonus)`; `_aggregateRekapUrusan(laporan)` → `Array<{ urusan, total_nilai, intensitas, tipe }>`.
- Produces: `buatRekapSemuaUrusanPDF(token: string) -> string` (URL file PDF).

- [ ] **Step 1: Write the failing tests**

Buat `tests/rekapPdf.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeDocApp(state) {
  function fakeCell() {
    return {
      setBackgroundColor: function () { return this; },
      editAsText: function () { return { setBold: function () { return this; } }; },
      setText: function () { return this; }
    };
  }
  function fakeRow() {
    return {
      getCell: function () { return fakeCell(); }
    };
  }
  return {
    HorizontalAlignment: { CENTER: 'center' },
    create: function (name) {
      state.docName = name;
      const body = {
        clear: function () {},
        appendParagraph: function (text) {
          state.paragraphs.push(text);
          return {
            setAlignment: function () { return this; },
            editAsText: function () { return { setBold: function () { return this; }, setFontSize: function () { return this; } }; }
          };
        },
        appendTable: function () {
          state.tableCreated = true;
          return {
            appendTableRow: function () {
              const row = fakeRow();
              state.rows.push(row);
              return row;
            }
          };
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
    getFolderById: function () {
      return {
        createFile: function (blob) {
          state.blobName = blob.name;
          return { getUrl: function () { return 'https://drive.google.com/file/d/PDF123/view'; } };
        }
      };
    },
    getFileById: function () {
      return {
        getAs: function () { return { setName: function (n) { state.blobName = n; return this; } }; },
        setTrashed: function (v) { state.trashed = v; }
      };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'LaporanController.js'), 'utf8'), ctx, { filename: 'LaporanController.js' });
  return ctx;
}

test('buatRekapSemuaUrusanPDF membuat PDF berisi tabel 3 kolom dan menghapus doc sementara', function () {
  const state = { paragraphs: [], rows: [] };
  const ctx = loadContext(state);
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  ctx._aggregateRekapUrusan = function () {
    return [
      { urusan: 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', total_nilai: 600.6, intensitas: 'Kecil', tipe: 'Tipe C' },
      { urusan: 'Urusan Kesehatan', total_nilai: 450, intensitas: 'Sangat Kecil', tipe: 'Bidang' }
    ];
  };

  const url = ctx.buatRekapSemuaUrusanPDF('tok');

  assert.strictEqual(url, 'https://drive.google.com/file/d/PDF123/view');
  assert.deepStrictEqual(state.requireRoleArgs.roles, ['Admin', 'Evaluator']);
  assert.strictEqual(state.docName, 'Rekap Hasil Penilaian - 25-11-2026 10:00');
  assert.strictEqual(state.blobName, 'Rekap Hasil Penilaian - 25-11-2026 10:00.pdf');
  assert.strictEqual(state.tableCreated, true);
  // 1 baris header + 2 baris urusan
  assert.strictEqual(state.rows.length, 3);
  assert.ok(state.paragraphs.indexOf('REKAPITULASI HASIL PENILAIAN') !== -1);
  assert.strictEqual(state.saved, true);
  assert.strictEqual(state.trashed, true);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rekapPdf.test.js`
Expected: FAIL — `ctx.buatRekapSemuaUrusanPDF is not a function`.

- [ ] **Step 3: Implement `buatRekapSemuaUrusanPDF(token)` in `LaporanController.js`**

Sisipkan tepat setelah `_aggregateRekapUrusan`. Urutan operasi: validasi role → cek `folder_id` → agregasi → buat doc → tulis judul & subjudul → tabel header 3 kolom (bold, latar `#E2E8F0`) → baris per urusan (`total_nilai.toFixed(2)`, `intensitas + " / " + tipe`) → `saveAndClose` → export PDF ke folder → `setTrashed(true)` di blok `try/catch` terpisah agar kegagalan trash tidak menggagalkan return → kembalikan `pdfFile.getUrl()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/rekapPdf.test.js`
Expected: PASS, 3 test lulus.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS semua test.

- [ ] **Step 6: Commit**

```bash
git add LaporanController.js tests/rekapPdf.test.js
git commit -m "feat: endpoint PDF rekap semua urusan"
```

---

### Task 2: Layout Tabel Laporan Penilaian

**Files:**
- Modify: `JS.html:967-1011` (`loadLaporan`)
- Modify: `CSS_Modern.html` (setelah blok `MODERN DATA TABLES`)
- Modify: `CSS.html` (setelah aturan `.table` yang ada)
- Test: `tests/laporanLayout.test.js`

**Interfaces:**
- Consumes: `getLaporanNilai()` → `Array<{ urusan, faktor_umum, faktor_teknis, total_akhir, bonus_applied, intensitas, tipe, opds }>`.
- Produces: markup tabel berkelas `lap-table`, `lap-col-*`, `lap-aksi`; fungsi JS `cetakRekapSemuaUrusan()` dikonsumsi Task 3.

- [ ] **Step 1: Write the failing static test**

Buat `tests/laporanLayout.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/laporanLayout.test.js`
Expected: FAIL — pola `lap-col-urusan` belum ada.

- [ ] **Step 3: Update `loadLaporan()` markup in `JS.html`**

Ganti isi `headHtml` dan `bodyHtml` dengan struktur:

- Header 8 kolom: `No`, `Urusan`, `OPD`, `Faktor Umum`, `Faktor Teknis`, `Total Nilai`, `Intensitas & Tipe`, `Aksi`, masing-masing dengan kelas `lap-col-no`, `lap-col-urusan`, `lap-col-opd`, `lap-col-num`, `lap-col-num`, `lap-col-total`, `lap-col-tipe`, `lap-col-aksi`.
- Baris: nomor urut; `escHtml(d.urusan)`; badge jumlah OPD dengan `title="${escAttr(daftarOpd.join(', '))}"`; angka `d.faktor_umum` dan `d.faktor_teknis`; `Number(d.total_akhir).toFixed(2)` + badge bonus; dua badge (intensitas `bg-secondary`, tipe warna sesuai pola yang ada); aksi dua tombol ikon sejajar dalam `<div class="lap-aksi">` memakai `onclick="lihatOpdLaporan(${index})"` dan `onclick="pilihFormatCetak('${escJsAttr(d.urusan)}')"` dengan `title` masing-masing.
- Bila `res` kosong: `<tr><td colspan="8" class="lap-empty">Belum ada data penilaian.</td></tr>`.

- [ ] **Step 4: Tambah CSS di `CSS_Modern.html` dan `CSS.html`**

Aturan yang sama di kedua file: `.lap-table thead th { position: sticky; top: 0; z-index: 2; }`, `.lap-col-urusan { min-width: 320px; white-space: normal; text-align: left; }`, `.lap-col-num, .lap-col-total { text-align: right; white-space: nowrap; }`, `.lap-col-total { font-weight: 700; }`, `.lap-aksi { display: flex; gap: .35rem; justify-content: center; }`, `.lap-empty { padding: 2rem; text-align: center; color: var(--text-muted); }` (Classic memakai warna literal `#64748B` karena tidak punya variabel).

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/laporanLayout.test.js`
Expected: PASS, 3 test lulus.

- [ ] **Step 6: Commit**

```bash
git add JS.html CSS_Modern.html CSS.html tests/laporanLayout.test.js
git commit -m "style: rapikan tabel laporan penilaian"
```

---

### Task 3: Tombol Cetak Rekap Highlight + Glow

**Files:**
- Modify: `View_Evaluator_Modern.html:391-396`
- Modify: `View_Evaluator.html:121-128`
- Modify: `JS.html` (setelah `prosesCetak`)
- Modify: `CSS_Modern.html`, `CSS.html`
- Test: `tests/cetakRekap.test.js`

**Interfaces:**
- Consumes: `buatRekapSemuaUrusanPDF(token)` dari Task 1; `serverCall()`, `sess.token`, `Swal` dari `JS.html`.
- Produces: `window.cetakRekapSemuaUrusan()`.

- [ ] **Step 1: Write the failing static test**

Buat `tests/cetakRekap.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cetakRekap.test.js`
Expected: FAIL — tombol belum ada.

- [ ] **Step 3: Tambah tombol di kedua view**

`View_Evaluator_Modern.html`: di dalam `<div class="d-flex gap-2">` pada header `v-laporan`, sebelum tombol Perbarui Data, tambahkan tombol `class="btn btn-modern btn-cetak-rekap btn-sm"` dengan `onclick="cetakRekapSemuaUrusan()"`, ikon `bi-file-earmark-pdf-fill`, teks `Cetak Rekap`.

`View_Evaluator.html`: di `#v-laporan`, bungkus judul dengan baris flex dan tambahkan tombol `class="btn btn-danger fw-bold btn-cetak-rekap"` dengan ikon dan handler yang sama.

- [ ] **Step 4: Implement `cetakRekapSemuaUrusan()` in `JS.html`**

Sisipkan setelah `prosesCetak`. Perilaku: tampilkan Swal loading (`title: 'Menyiapkan PDF...'`, `allowOutsideClick: false`, `didOpen: () => Swal.showLoading()`), panggil `serverCall().withSuccessHandler(url => { Swal.close(); window.open(url, '_blank'); }).buatRekapSemuaUrusanPDF(sess.token)`. Failure handler sudah ditangani `serverCall()`.

- [ ] **Step 5: Tambah CSS glow di `CSS_Modern.html` dan `CSS.html`**

`.btn-cetak-rekap` memakai gradient primer (`linear-gradient(135deg, #0057B7, #0069DB)`), teks putih, border terang, `animation: cetakRekapGlow 2s ease-in-out infinite`. `@keyframes cetakRekapGlow` 0%/100% `box-shadow: 0 0 0 rgba(0,87,183,0)`, 50% `box-shadow: 0 0 16px rgba(0,87,183,.65)`. Tambahkan blok `@media (prefers-reduced-motion: reduce)` yang mematikan `animation` untuk `.btn-cetak-rekap` dan memberi `box-shadow` statis.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/cetakRekap.test.js`
Expected: PASS, 3 test lulus.

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: PASS semua test.

- [ ] **Step 8: Commit**

```bash
git add View_Evaluator_Modern.html View_Evaluator.html JS.html CSS_Modern.html CSS.html tests/cetakRekap.test.js
git commit -m "feat: tombol cetak rekap PDF dengan glow"
```
