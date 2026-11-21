# Opsi "Tidak Bisa Dinilai" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluator bisa menandai jawaban OPD sebagai "Tidak Bisa Dinilai" (bobot 0) dengan catatan wajib, dan daftar urusan menampilkan jumlah butir tak bisa dinilai.

**Architecture:** Nilai 0 pada `skala_evaluator` menjadi penanda tunggal (tanpa perubahan skema). Penghitungan `total_tak_dinilai` di server (`_computeSubKatStats`), pelaporan badge di dua UI validasi. Tombol khusus di samping pill A–E dengan style glowing, validasi catatan di klien + server.

**Tech Stack:** Google Apps Script (V8), Firebase REST, Bootstrap 5, vanilla JS inline di template HTML Apps Script, `node --test` untuk unit test.

**Spec:** `docs/superpowers/specs/2026-11-20-tidak-bisa-dinilai-design.md`

## Global Constraints

- Skema Firebase TIDAK berubah. Penanda = `skala_evaluator === 0`.
- Catatan evaluator wajib bila `skala_evaluator === 0` — diblok di klien dan ditolak di server.
- `total_divalidasi` tidak berubah: butir bernilai 0 tetap dihitung sudah divalidasi.
- Bobot A–E tidak boleh mengandung 0 (dijaga sanitizer di `SoalController.js`); ini yang membuat 0 tak ambigu.
- Dua UI harus diubah: `JS.html` (classic) dan `JS_Modern.html` (modern). Style: `CSS.html` dan `CSS_Modern.html`.
- Jangan mengubah logika default "isi otomatis dari responden" (cek `=== ""`), jangan pakai cek truthy.
- Nama fungsi/field persis: `total_tak_dinilai`, `_validateBobot`, `renderKriteriaBobotBox` (sudah ada).

## Review Focus

- Item bernilai 0 tanpa catatan: simpan harus gagal dengan pesan jelas, bukan tersimpan diam-diam.
- Item bernilai 0 dengan catatan: tetap tersimpan dan urusan tetap berstatus "Selesai".
- Render ulang lembar validasi untuk item 0: tombol "Tidak Bisa Dinilai" harus tampil aktif, bukan pill A–E.
- "Samakan Skor" pada item yang sedang 0: harus menimpa 0 dengan skor responden (bukan sebaliknya).
- Bobot soal berisi 0 atau format salah: ditolak server dengan pesan, data lama tidak rusak.

---

### Task 1: Sanitizer bobot di server

**Files:**
- Modify: `SoalController.js` (tambah `_validateBobot`, pakai di `updateSoal` dan `tambahSoal`)
- Test: `tests/bobotValidasi.test.js`

**Interfaces:**
- Produces: `_validateBobot(bobot) -> string` (mengembalikan string bobot ternormalisasi `a|b|c|d|e`, atau melempar `Error`).

- [ ] **Step 1: Write the failing test**

```js
// tests/bobotValidasi.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bobotValidasi.test.js`
Expected: FAIL — `_validateBobot is not a function`

- [ ] **Step 3: Implement `_validateBobot` in `SoalController.js`**

Letakkan di atas `updateSoal`. Signature: `function _validateBobot(bobot)`. Aturan: split `|`, trim tiap bagian, wajib tepat 5, tiap bagian wajib angka bulat (`/^\d+$/`), tiap nilai harus > 0. Kembalikan `parts.join("|")`. Pesan error harus memuat substring `5 nilai`, `angka`, dan `lebih dari 0` sesuai kasus.

- [ ] **Step 4: Pakai di `updateSoal` dan `tambahSoal`**

Di `updateSoal`, bila `propName === "bobot"` → `nilaiBaru = _validateBobot(nilaiBaru)` sebelum disimpan (biarkan `Error` naik ke client).
Di `tambahSoal`, `bobot: _validateBobot(payload.bobot || "100|80|60|40|20")`.

- [ ] **Step 5: Run tests**

Run: `node --test tests/`
Expected: semua PASS (termasuk test lama `rekapUrusan`).

- [ ] **Step 6: Commit**

```bash
git add SoalController.js tests/bobotValidasi.test.js
git commit -m "feat: validasi format bobot soal (5 nilai, tanpa 0)"
```

---

### Task 2: Hitung `total_tak_dinilai` di statistik server

**Files:**
- Modify: `JawabanController.js` (`_computeSubKatStats`)
- Test: `tests/takBisaDinilai.test.js`

**Interfaces:**
- Produces: setiap entri hasil `_computeSubKatStats` mendapat field tambahan `total_tak_dinilai: Number`.
- Consumes: array `ds` (master soal), `dj` (jawaban), `dv` (verifikasi) seperti sekarang.

- [ ] **Step 1: Write the failing test**

```js
// tests/takBisaDinilai.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/takBisaDinilai.test.js`
Expected: FAIL — `total_tak_dinilai` undefined

- [ ] **Step 3: Implement di `_computeSubKatStats`**

Inisialisasi `stats[sub] = { nama, total_jawaban: 0, total_divalidasi: 0, total_tak_dinilai: 0 }`.
Di loop `dv` yang sekarang membuat `verifSet`, sekaligus bangun map `v[1] + "||" + v[2]` → nilai (`v[4]`). Setelah loop `dj` menaikkan `total_divalidasi`, tambahkan: bila map verifikasi untuk `opd||qId` ada dan `Number(...) === 0` → `stats[sub].total_tak_dinilai++`.
Sertakan `total_tak_dinilai` di objek hasil `result.push(...)`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add JawabanController.js tests/takBisaDinilai.test.js
git commit -m "feat: hitung total butir tak bisa dinilai per urusan"
```

---

### Task 3: Validasi catatan wajib di server

**Files:**
- Modify: `JawabanController.js` (`simpanVerifikasi`)

**Interfaces:**
- Consumes: `payload.items[]` dengan `{opd, id_soal, skala_evaluator, catatan}`.
- Produces: `simpanVerifikasi` melempar `Error` bila ada item bernilai 0 tanpa catatan; pesan memuat `"Tidak Bisa Dinilai"`.

- [ ] **Step 1: Implement validasi sebelum loop penyimpanan**

Di `simpanVerifikasi`, setelah cek `payload.items` kosong, tambahkan pemeriksaan: hitung item dengan `Number(item.skala_evaluator) === 0` dan `String(item.catatan || "").trim() === ""`. Bila ada, `throw new Error("Catatan wajib diisi untuk butir yang ditandai 'Tidak Bisa Dinilai'. Jumlah butir bermasalah: " + n + ".")`.

- [ ] **Step 2: Verifikasi manual dengan node REPL-style check**

Run:
```bash
node -e "
const fs=require('fs'),vm=require('vm');const ctx={console,Number,String,Object,Array,Date,PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},Firebase:{escapeKey:s=>s,patch:()=>{}},requireRole:()=>{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('JawabanController.js','utf8'),ctx,{filename:'JawabanController.js'});
try{ctx.simpanVerifikasi('t',{items:[{opd:'A',id_soal:'P1',skala_evaluator:0,catatan:'  '}]});console.log('FAIL: tidak melempar');}catch(e){console.log('OK:',e.message.includes('Tidak Bisa Dinilai'));}
"
```
Expected: `OK: true`

- [ ] **Step 3: Commit**

```bash
git add JawabanController.js
git commit -m "feat: tolak simpan verifikasi nilai 0 tanpa catatan"
```

---

### Task 4: Fix bug skor 0 di laporan

**Files:**
- Modify: `LaporanController.js:128`

- [ ] **Step 1: Ganti cek truthy**

Ubah baris `newRow.replaceText("{{FT_SKOR}}", ans.skala_evaluator ? ans.skala_evaluator.toString() : "-");` menjadi cek eksplisit:
```js
const skorEval = (ans.skala_evaluator === "" || ans.skala_evaluator === null || ans.skala_evaluator === undefined) ? "-" : ans.skala_evaluator.toString();
newRow.replaceText("{{FT_SKOR}}", skorEval);
```

- [ ] **Step 2: Run tests**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add LaporanController.js
git commit -m "fix: cetak skor evaluator 0 sebagai 0 di laporan"
```

---

### Task 5: Style tombol "Tidak Bisa Dinilai" (CSS)

**Files:**
- Modify: `CSS.html` (classic), `CSS_Modern.html` (modern)

**Interfaces:**
- Produces: class `.score-pill-btn.btn-tak-dinilai` dan state `.btn-tak-dinilai.active` (modern), serta `.btn-tak-dinilai` setara untuk classic.

- [ ] **Step 1: Tambah style classic di `CSS.html`**

Append di akhir `<style>`: `.btn-tak-dinilai { border: 1.5px solid #DC2626; color: #B91C1C; background: #FEF2F2; font-weight: 700; ... }` dengan `animation: takDinilaiGlow 1.8s ease-in-out infinite;` dan `@keyframes takDinilaiGlow` memakai `box-shadow: 0 0 0 rgba(...)` → `0 0 12px rgba(220,38,38,0.55)`. State `.btn-tak-dinilai.active` = background `#DC2626`, color white, glow lebih kuat.
Penting: sertakan `@media (prefers-reduced-motion: reduce) { .btn-tak-dinilai { animation: none; } }`.

- [ ] **Step 2: Tambah style modern di `CSS_Modern.html`**

Sisipkan setelah blok `.score-pill-btn.active` dengan pola sama, memakai variabel yang ada (`--danger` bila tersedia) dan warna solid `#DC2626`.

- [ ] **Step 3: Cek tidak ada selector bentrok**

Run: `grep -n "btn-tak-dinilai" CSS.html CSS_Modern.html`
Expected: keduanya menampilkan blok baru.

- [ ] **Step 4: Commit**

```bash
git add CSS.html CSS_Modern.html
git commit -m "style: tombol glowing Tidak Bisa Dinilai"
```

---

### Task 6: UI validasi classic (`JS.html`)

**Files:**
- Modify: `JS.html` (`renderValList`, `simpanVal`, tambah `pilihTakBisaDinilai` dan `samakanSkor` guard)

**Interfaces:**
- Produces: `window.pilihTakBisaDinilai(i, j)` (classic pakai fungsi global non-window juga boleh, karena `Index.html` memuat `JS` langsung) yang set `vData[i].jawaban_opd[j].skala_evaluator = 0` dan perbarui visual.
- Consumes: `vData`, `document.getElementById('sel-eval-'+i+'-'+j)`.

- [ ] **Step 1: Tambah tombol di `renderValList`**

Dalam loop `soal.jawaban_opd.forEach((ans, j) => {...})`, setelah `selectOptions` dibangun (atau di blok tombol header bersama "Samakan Skor"), tambah tombol:
`<button class="btn btn-sm btn-tak-dinilai ${isTakDinilai ? 'active' : ''}" id="btn-taknilai-${i}-${j}" onclick="pilihTakBisaDinilai(${i},${j})" title="Tandai data tidak lengkap sehingga tidak bisa dinilai"><i class="bi bi-slash-circle me-1"></i> Tidak Bisa Dinilai</button>`
dengan `const isTakDinilai = ans.skala_evaluator !== "" && Number(ans.skala_evaluator) === 0;`

- [ ] **Step 2: Jaga agar 0 tidak tertimpa saat render**

Baris `if (ans.skala_evaluator === undefined || ans.skala_evaluator === null || ans.skala_evaluator === "") { ans.skala_evaluator = ans.skala_responden; }` sudah benar (`0` tidak kena). Jangan diubah. Pastikan `select` tidak menampilkan pilihan aktif saat nilai 0 (tidak ada opsi bernilai "0", jadi otomatis `-- Pilih Skor --`).

- [ ] **Step 3: Implement `pilihTakBisaDinilai(i, j)`**

Signature: `function pilihTakBisaDinilai(i, j)`. Set `ans.skala_evaluator = 0`; set `sel.value = ""`; hapus class `active` dari tombol lain bila ada; tambah `active` ke `btn-taknilai-i-j`; fokuskan input catatan pada kartu itu (`document.querySelectorAll('.q-card input[type=text]')` atau beri id `catatan-eval-${i}-${j}` pada input catatan dan fokus ke sana) sambil menampilkan `Swal` singkat berisi pengingat "Catatan wajib diisi untuk butir ini."

- [ ] **Step 4: Guard `samakanSkor`**

Setelah `ans.skala_evaluator = skorStr;` tambahkan: hapus `active` dari `btn-taknilai-${i}-${j}`.

- [ ] **Step 5: Validasi di `simpanVal`**

Sebelum `Swal.showLoading()`, kumpulkan `let bermasalah = []` dari semua item dengan `Number(ans.skala_evaluator) === 0 && String(ans.catatan||"").trim() === ""`. Bila tidak kosong: `Swal.fire('Catatan Wajib', 'Ada ' + bermasalah.length + ' butir "Tidak Bisa Dinilai" yang belum diberi catatan. Lengkapi catatan terlebih dahulu.', 'warning')` dan `return` tanpa memanggil server.

- [ ] **Step 6: Cek sintaks**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' JS.html) 2>&1 | head` — bila tidak praktis, minimal jalankan `npx clasp push --dry-run` di Task 8 dan pastikan tidak ada error parsing.

- [ ] **Step 7: Commit**

```bash
git add JS.html
git commit -m "feat: tombol Tidak Bisa Dinilai di UI validasi classic"
```

---

### Task 7: UI validasi modern (`JS_Modern.html`)

**Files:**
- Modify: `JS_Modern.html` (`renderValList`, `pilihSkorPill`, `samakanSkor`, `simpanVal`)

**Interfaces:**
- Produces: `window.pilihTakBisaDinilai(i, j)`.
- Consumes: `vData`, `score-pill-group-${i}-${j}`.

- [ ] **Step 1: Tambah tombol pill khusus**

Dalam loop yang membangun `pillButtonsHtml`, setelah loop label A–E, tambahkan variabel `takDinilaiHtml`:
`<button type="button" class="score-pill-btn btn-tak-dinilai ${isTakDinilai ? 'active' : ''}" id="pill-taknilai-${i}-${j}" onclick="pilihTakBisaDinilai(${i},${j})" title="Data tidak lengkap — tidak bisa dinilai"><i class="bi bi-slash-circle me-1"></i> Tidak Bisa Dinilai</button>`
Render di `score-pill-group-${i}-${j}` setelah `${pillButtonsHtml}`.

- [ ] **Step 2: Implement `window.pilihTakBisaDinilai`**

Set `skala_evaluator = 0`, `sel.value = ""`, hapus `active` semua `.score-pill-btn` di group, tambah `active` ke `pill-taknilai-${i}-${j}`, fokus input catatan kartu tersebut, tampilkan pengingat catatan wajib (Swal/toast singkat).

- [ ] **Step 3: `pilihSkorPill` menghapus state 0**

Saat user memilih pill A–E, hapus `active` dari `#pill-taknilai-${i}-${j}`.

- [ ] **Step 4: `samakanSkor` menghapus state 0**

Setelah `ans.skala_evaluator = skorStr;` hapus `active` dari `#pill-taknilai-${i}-${j}`.

- [ ] **Step 5: Validasi di `simpanVal`**

Cari fungsi `simpanVal` yang aktif (bisa di `JS.html` dan/atau `JS_Modern.html`). Pastikan yang dipakai halaman modern punya blok validasi catatan yang sama dengan Task 6 Step 5. Bila `JS_Modern.html` tidak mendefinisikan `simpanVal`, cukup pastikan versi `JS.html` dipakai (tidak ada override) dan tidak ada duplikasi yang menimpa.

- [ ] **Step 6: Commit**

```bash
git add JS_Modern.html
git commit -m "feat: tombol glowing Tidak Bisa Dinilai di UI validasi modern"
```

---

### Task 8: Badge "N tak bisa dinilai" di daftar urusan

**Files:**
- Modify: `JS.html` (`loadSubKat`), `JS_Modern.html` (`loadSubKat`)

- [ ] **Step 1: Classic badge**

Di `JS.html` `loadSubKat`, setelah `statusBadge` ditentukan, tambahkan:
```js
const takDinilaiBadge = (s.total_tak_dinilai > 0)
  ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 ms-1"><i class="bi bi-exclamation-triangle me-1"></i> ${s.total_tak_dinilai} tak bisa dinilai</span>`
  : '';
```
Lalu render `${statusBadge}${takDinilaiBadge}` di kolom status. Status "Selesai" tetap seperti sekarang.

- [ ] **Step 2: Modern badge**

Sama di `JS_Modern.html`, pakai class `badge badge-soft-danger` bila ada; kalau tidak ada, pakai inline style `background: var(--danger-light); color: #DC2626;`.

- [ ] **Step 3: Cek data kosong**

Pastikan `s.total_tak_dinilai` undefined (data lama/render lama) tidak mencetak "undefined": guard dengan `Number(s.total_tak_dinilai || 0) > 0`.

- [ ] **Step 4: Commit**

```bash
git add JS.html JS_Modern.html
git commit -m "feat: badge butir tak bisa dinilai di daftar urusan"
```

---

### Task 9: Verifikasi menyeluruh + deploy

- [ ] **Step 1: Jalankan seluruh test**

Run: `node --test tests/`
Expected: semua PASS.

- [ ] **Step 2: Cek sintaks semua file JS server**

Run: `for f in *.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: tidak ada `FAIL`.

- [ ] **Step 3: Deploy ke Apps Script**

Run: `npx clasp push -f`
Expected: output menyebut file terunggah, tanpa error auth.

- [ ] **Step 4: Buat versi deployment**

Run: `npx clasp version "feat: opsi tidak bisa dinilai (bobot 0)"`
Expected: mencetak nomor versi baru. (Deploy ke Web App existing mengikuti deployment ID yang dipakai; `clasp version` cukup untuk membuat snapshot versi.)

- [ ] **Step 5: Laporkan**

Sampaikan nomor versi + daftar file yang berubah ke user, dan ingatkan uji manual: buka lembar validasi, pilih "Tidak Bisa Dinilai", coba simpan tanpa catatan (harus diblok), lalu isi catatan dan simpan.
