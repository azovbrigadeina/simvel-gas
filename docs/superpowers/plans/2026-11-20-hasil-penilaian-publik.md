# Informasi Hasil Penilaian Publik Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol "Informasi Hasil Penilaian" di landing Modern yang menampilkan rekap per Urusan (Urusan, Total Nilai, Intensitas & Tipe) tanpa login.

**Architecture:** Fungsi server publik baru mengambil laporan mentah dari `_computeLaporanNilai()`, mengelompokkan per Urusan, merata-ratakan `total_akhir` (logika yang sama dengan `buatLaporanUrusan`), lalu mengembalikan tiga field publik. Landing Modern memanggilnya saat tombol diklik dan merender tabel di modal SweetAlert.

**Tech Stack:** Google Apps Script (HtmlService), JavaScript ES5/ES6, Bootstrap 5, SweetAlert2, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-20-hasil-penilaian-publik-design.md`

## Global Constraints

- Tidak memerlukan login/token; fungsi publik tidak boleh memanggil `requireRole`.
- Output publik hanya `{ urusan, total_nilai, intensitas, tipe }` — tanpa OPD, Faktor Umum, Faktor Teknis.
- Total Nilai per Urusan = rata-rata `total_akhir` seluruh OPD pada Urusan tersebut (sama dengan `buatLaporanUrusan`), dibulatkan 2 desimal.
- Intensitas & Tipe dihitung ulang dengan `determineRating(rata-rata)`.
- Baris "Umum"/Faktor Umum tidak boleh muncul.
- Gunakan `escHtml()` yang sudah ada di `JS.html` untuk semua teks dinamis di frontend.
- Jangan menambah dependency baru.

## Review Focus

- **Data kosong:** bila belum ada jawaban/verifikasi, endpoint mengembalikan `[]` dan modal menampilkan pesan ramah, bukan tabel kosong atau error.
- **Nama Urusan bervariasi:** spasi ganda atau perbedaan huruf besar/kecil pada urusan yang sama harus tetap menjadi satu baris.
- **Satu OPD saja:** urusan dengan satu OPD mengembalikan nilai OPD itu tanpa pembagian yang salah.
- **Lebih dari dua OPD:** rata-rata tetap benar untuk 3+ OPD, bukan hanya dua.
- **Nama Urusan berisi karakter HTML:** teks harus di-escape agar tidak menjadi HTML/script di modal.

---

### Task 1: Endpoint Publik Rekap per Urusan

**Files:**
- Create: `tests/rekapUrusan.test.js`
- Modify: `package.json` (bagian `scripts.test`)
- Modify: `LaporanController.js` (tambahkan fungsi di akhir file)

**Interfaces:**
- Consumes: `_loadSharedData()` → `{ ds, dj, dv }`, `_loadFaktorUmumGlobal()` → `{ faktorUmumGlobal, excludedBonus }`, `_computeLaporanNilai(ds, dv, faktorUmumGlobal, excludedBonus)` → array baris `{ urusan, total_akhir, ... }`, dan `determineRating(score)` → `{ intensitas, tipe }` (semua sudah ada).
- Produces: `getRekapUrusanPublik()` → `Array<{ urusan: string, total_nilai: number, intensitas: string, tipe: string }>` dan helper `_aggregateRekapUrusan(laporan)` dengan tipe yang sama.

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/rekapUrusan.test.js`:

```js
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

test('_aggregateRekapUrusan menggabungkan OPD menjadi satu urusan dengan rata-rata', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', total_akhir: 700, opd: 'A' },
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', total_akhir: 800, opd: 'B' },
    { urusan: 'Urusan Kesehatan', total_akhir: 500, opd: 'C' }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Pemerintahan Bidang Pendidikan', total_nilai: 750, intensitas: 'Sedang', tipe: 'Tipe B' },
    { urusan: 'Urusan Kesehatan', total_nilai: 500, intensitas: 'Kecil', tipe: 'Tipe C' }
  ]);
});

test('_aggregateRekapUrusan menggabungkan variasi spasi/huruf dan mengabaikan Umum', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan Kesehatan', total_akhir: 200 },
    { urusan: '  urusan   kesehatan ', total_akhir: 400 },
    { urusan: 'Umum', total_akhir: 999 },
    { urusan: '', total_akhir: 12 }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Kesehatan', total_nilai: 300, intensitas: 'Sangat Kecil', tipe: 'Seksi/Subbidang' }
  ]);
});

test('_aggregateRekapUrusan menangani satu OPD dan lebih dari dua OPD', function () {
  const ctx = loadContext();
  const res = JSON.parse(JSON.stringify(ctx._aggregateRekapUrusan([
    { urusan: 'Urusan A', total_akhir: 400 },
    { urusan: 'Urusan B', total_akhir: 100 },
    { urusan: 'Urusan B', total_akhir: 200 },
    { urusan: 'Urusan B', total_akhir: 300 }
  ])));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan A', total_nilai: 400, intensitas: 'Sangat Kecil', tipe: 'Bidang' },
    { urusan: 'Urusan B', total_nilai: 200, intensitas: 'Sangat Kecil', tipe: 'Seksi/Subbidang' }
  ]);
});

test('getRekapUrusanPublik memakai data laporan dan hanya mengembalikan 3 kolom publik', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () {
    return [
      { urusan: 'Urusan Pendidikan', total_akhir: 700, faktor_umum: 0, faktor_teknis: 700, opd: 'A' },
      { urusan: 'Urusan Pendidikan', total_akhir: 800, faktor_umum: 0, faktor_teknis: 800, opd: 'B' }
    ];
  };
  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, [
    { urusan: 'Urusan Pendidikan', total_nilai: 750, intensitas: 'Sedang', tipe: 'Tipe B' }
  ]);
});

test('getRekapUrusanPublik mengembalikan array kosong saat belum ada data', function () {
  const ctx = loadContext();
  ctx._loadSharedData = function () { return { ds: [], dj: [], dv: [] }; };
  ctx._loadFaktorUmumGlobal = function () { return { faktorUmumGlobal: 0, excludedBonus: [] }; };
  ctx._computeLaporanNilai = function () { return []; };
  const res = JSON.parse(JSON.stringify(ctx.getRekapUrusanPublik()));
  assert.deepStrictEqual(res, []);
});
```

- [ ] **Step 2: Ubah skrip test di `package.json`**

Ganti `"test": "echo \"Error: no test specified\" && exit 1"` menjadi:

```json
"test": "node --test tests/"
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `_aggregateRekapUrusan is not a function`.

- [ ] **Step 4: Implementasi fungsi di akhir `LaporanController.js`**

```js
/**
 * Agregasi laporan per urusan.
 * Satu urusan = satu baris, Total Nilai = rata-rata total_akhir seluruh OPD
 * pada urusan tersebut, lalu Intensitas & Tipe dihitung dari rata-rata itu.
 * Logika ini sama dengan perhitungan header pada buatLaporanUrusan.
 */
function _aggregateRekapUrusan(laporan) {
  var groups = {};

  (laporan || []).forEach(function (row) {
    if (!row || !row.urusan) return;
    var display = row.urusan.toString().replace(/\s+/g, " ").trim();
    if (!display || display.toLowerCase() === "umum") return;

    var key = display.toLowerCase();
    if (!groups[key]) {
      groups[key] = { urusan: display, total: 0, count: 0 };
    }
    groups[key].total += parseFloat(row.total_akhir) || 0;
    groups[key].count++;
  });

  var result = [];
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var avg = g.count > 0 ? Number((g.total / g.count).toFixed(2)) : 0;
    var rating = determineRating(avg);
    result.push({
      urusan: g.urusan,
      total_nilai: avg,
      intensitas: rating.intensitas,
      tipe: rating.tipe
    });
  });

  result.sort(function (a, b) { return b.total_nilai - a.total_nilai; });
  return result;
}

/**
 * Endpoint publik (tanpa login) untuk tombol Informasi Hasil Penilaian di landing.
 */
function getRekapUrusanPublik() {
  const data = _loadSharedData();
  const settings = _loadFaktorUmumGlobal();
  const laporan = _computeLaporanNilai(data.ds, data.dv, settings.faktorUmumGlobal, settings.excludedBonus);
  return _aggregateRekapUrusan(laporan);
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npm test`
Expected: PASS — 5 test lulus.

- [ ] **Step 6: Commit**

```bash
git add LaporanController.js tests/rekapUrusan.test.js package.json
git commit -m "feat: add public per-urusan assessment recap endpoint"
```

---

### Task 2: Tombol dan Modal Informasi di Landing Modern

**Files:**
- Create: `tests/landingInformasi.test.js`
- Modify: `View_Landing_Modern.html` (setelah baris kartu peran, sebelum `</div>` penutup `#role-selection`)
- Modify: `JS_Modern.html` (tambahkan fungsi sebelum akhir `<script>`)

**Interfaces:**
- Consumes: `google.script.run.getRekapUrusanPublik()` dari Task 1; `escHtml()` dan `Swal` yang sudah tersedia.
- Produces: `window.showInformasiHasilPenilaian()` yang dipanggil tombol landing.

- [ ] **Step 1: Tulis test statis yang gagal**

Buat `tests/landingInformasi.test.js`:

```js
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
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — pola tombol/fungsi belum ada.

- [ ] **Step 3: Tambahkan tombol di `View_Landing_Modern.html`**

Sisipkan tepat setelah `</div>` penutup baris kartu peran (setelah blok Portal Evaluator) dan sebelum `</div>` penutup `id="role-selection"`:

```html
      <!-- Public Info: Hasil Penilaian -->
      <div class="text-center mt-3 mb-2">
        <button type="button" class="btn px-4 py-2 fw-semibold"
          style="background: rgba(255, 255, 255, 0.14); border: 1.5px solid rgba(255, 255, 255, 0.55); color: #fff; border-radius: 999px; backdrop-filter: blur(10px); transition: all 0.25s ease;"
          onmouseover="this.style.background='rgba(255,255,255,0.26)'"
          onmouseout="this.style.background='rgba(255,255,255,0.14)'"
          onclick="showInformasiHasilPenilaian()">
          <i class="bi bi-info-circle me-2"></i> Informasi Hasil Penilaian
        </button>
      </div>
```

- [ ] **Step 4: Tambahkan fungsi modal di `JS_Modern.html`**

Tambahkan sebelum tag `</script>` terakhir:

```js
  // Informasi Hasil Penilaian (publik, dari landing)
  window.showInformasiHasilPenilaian = function () {
    Swal.fire({
      title: 'Memuat Hasil Penilaian...',
      allowOutsideClick: false,
      didOpen: function () { Swal.showLoading(); }
    });

    google.script.run
      .withSuccessHandler(function (rows) {
        if (!rows || rows.length === 0) {
          Swal.fire({
            icon: 'info',
            title: 'Hasil Penilaian',
            text: 'Belum ada data penilaian yang dapat ditampilkan.'
          });
          return;
        }

        var body = '';
        rows.forEach(function (d) {
          var typeColor = d.tipe.indexOf('Tipe A') !== -1 ? 'bg-danger' :
                          d.tipe.indexOf('Tipe B') !== -1 ? 'bg-primary' :
                          d.tipe.indexOf('Tipe C') !== -1 ? 'bg-info text-dark' : 'bg-secondary';
          body += '<tr>' +
            '<td class="text-start fw-semibold">' + escHtml(d.urusan) + '</td>' +
            '<td class="fw-bold text-primary">' + Number(d.total_nilai).toFixed(2) + '</td>' +
            '<td><div class="fw-bold">' + escHtml(d.intensitas) + '</div>' +
            '<span class="badge ' + typeColor + '">' + escHtml(d.tipe) + '</span></td>' +
            '</tr>';
        });

        Swal.fire({
          title: 'Hasil Penilaian',
          width: '760px',
          html: '<div class="table-responsive" style="max-height: 60vh; overflow: auto;">' +
            '<table class="table table-sm table-bordered table-hover align-middle text-center mb-0" style="font-size: 0.9rem;">' +
            '<thead><tr><th>Urusan</th><th>Total Nilai</th><th>Intensitas &amp; Tipe</th></tr></thead>' +
            '<tbody>' + body + '</tbody>' +
            '</table></div>',
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#0057B7'
        });
      })
      .withFailureHandler(function (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memuat',
          text: (err && err.message) || err || 'Terjadi kesalahan saat memuat data.'
        });
      })
      .getRekapUrusanPublik();
  };
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npm test`
Expected: PASS — seluruh test (7 total) lulus.

- [ ] **Step 6: Verifikasi manual di web app**

Run: `clasp push` lalu buka URL web app dengan `?ui=modern` (mis. `.../exec?ui=modern`).
Expected:
- Tombol "Informasi Hasil Penilaian" tampil terpusat di bawah dua kartu portal.
- Klik tombol → modal menampilkan tabel 3 kolom.
- Nama urusan tidak berulang; angka Total Nilai sama dengan rata-rata pada laporan per urusan.
- Baris "Umum" tidak ada.
- Jika data kosong, muncul pesan "Belum ada data penilaian yang dapat ditampilkan."

- [ ] **Step 7: Commit**

```bash
git add View_Landing_Modern.html JS_Modern.html tests/landingInformasi.test.js
git commit -m "feat: add public assessment recap button to modern landing"
```
