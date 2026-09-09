# Design Spec: Snapshot Google Drive Rekursif, Dual Link Verifikasi, & Audit Timestamp Bukti Dukung SIMvel

## Overview
Spesifikasi desain ini merinci implementasi **Fase 1** untuk proyek SIMvel, yaitu:
1. Penyalinan otomatis bukti dukung Google Drive milik responden secara rekursif (termasuk folder & subfolder) ke Drive Admin SIMvel (`link_arsip`).
2. Sakelar toggle switch **"Cek Link Evd. Asli"** pada antarmuka verifikasi evaluator untuk beralih antara link Snapshot Admin terkunci dan Link Live Asli Responden.
3. Tombol **"Refresh Snapshot"** untuk memicu pembaruan snapshot bukti dukung (baik per-OPD maupun seluruh OPD dalam Urusan/Sub Kategori aktif).
4. Tampilan **Audit Timestamp Pengiriman Per-Item Bukti Dukung** untuk memverifikasi waktu unggah berkas setiap OPD pada Urusan terkait.

Semua perubahan antarmuka pengguna (UI) dirancang untuk menyatu secara konsisten (*seamless*) tanpa merubah tata letak (*layout*) SIMvel secara radikal.

---

## Architecture & Data Context SIMvel
Di SIMvel, penilaian dilakukan **berdasarkan Urusan (Sub Kategori)**. 
- Satu **Urusan** (misalnya *Kesehatan*, *Pendidikan*, *Pekerjaan Umum*) dapat mencakup jawaban dari **beberapa OPD sekaligus**.
- Pada halaman validasi nilai evaluator (`muatValidasi`), soal-soal ditampilkan berurut berdasarkan Urusan, dan di dalam setiap soal terdapat kartu jawaban dari masing-masing OPD yang mengampu/mengisi Urusan tersebut.
- Oleh karena itu, fitur dual link, audit timestamp, dan pemicu refresh snapshot dirancang untuk bekerja secara akurat per-OPD di dalam konteks Urusan.

---

## Detailed Design & Requirements

### 1. Backend Service (`JawabanController.js` & `FirebaseClient.js`)

#### A. Google Drive Snapshot Engine
- **Fungsi `parseDriveUrl(url)`**: Mengidentifikasi apakah URL merupakan Google Drive `FOLDER` atau `FILE` serta mengekstrak ID resourcenya.
- **Fungsi `copyFolderRecursive(sourceFolder, targetFolder)`**: Membaca seluruh berkas dan subfolder di dalam `sourceFolder` lalu menyalinnya secara berantai ke `targetFolder`.
- **Fungsi `snapshotDriveFolder(opdName, originalDriveUrl)`**:
  - Mengambil/membuat induk folder arsip: `[SIMVEL] Arsip Bukti Dukung`.
  - Jika berupa folder: Membuat sub-folder `[Nama OPD] - [Nama Folder Asli]` dan menjalankan `copyFolderRecursive`.
  - Jika berupa file: Membuat folder `[Nama OPD] - File Bukti Dukung` dan menyalin file tersebut.
  - Mengembalikan URL Google Drive dari hasil penyalinan (`link_arsip`).

#### B. Data Structure & Firebase Persistence
- Setiap node `jawaban/${opdEscaped}/${escapedIdSoal}` akan menyimpan properti:
  - `link`: URL asli responden.
  - `link_arsip`: URL snapshot terkunci di Drive Admin.
  - `timestamp`: Tanggal & waktu pasti saat responden menyimpan/memperbarui item jawaban tersebut.

#### C. Evaluator Endpoints
- **Fungsi `resnapshotAllByOPD(namaOPD)`**: Memproses ulang snapshot seluruh item bukti dukung OPD tertentu.
- **Fungsi `resnapshotBySubKategori(subKategori)`**: Memproses ulang snapshot seluruh bukti dukung dari semua OPD yang ada di dalam Urusan/Sub Kategori tersebut.

---

### 2. Frontend Interface (`View_Evaluator.html`, `JS.html`, `CSS.html`)

#### A. Header Form Validasi Urusan (`#val-form-view`)
Tanpa mengubah komponen sidebar dan tombol navigasi utama, pada sub-header halaman validasi Urusan disisipkan:
1. **Form Switch Bootstrap (`#switch-link-asli`)**:
   - Label: `Cek Link Evd. Asli`.
   - Event `onchange`: Memicu render ulang daftar bukti dukung (toggle antara mode Snapshot Admin & Link Asli Responden).
2. **Tombol Action Refresh Snapshot Urusan (`#btn-refresh-snapshot`)**:
   - Tombol outline info dengan ikon `bi-arrow-repeat`.
   - Memicu penyalinan ulang snapshot untuk seluruh OPD yang ada pada Urusan/Sub Kategori aktif.

#### B. Rendering Item Bukti Dukung per OPD dalam Urusan (`muatValidasi`)
Pada setiap blok jawaban OPD di bawah pertanyaan suatu Urusan:
1. **Status Link Bukti Dukung**:
   - **Switch OFF (Default)**: Menampilkan tombol `🔒 Snapshot Admin` yang mengarah ke `ans.link_arsip` (jika belum ada, fallback ke `ans.link`).
   - **Switch ON**: Menampilkan 2 tombol berdampingan: `🔒 Snapshot Admin` (`ans.link_arsip`) dan `🔗 Link Evd. Asli` (`ans.link`).
2. **Audit Timestamp Per-Item OPD**:
   - Menambahkan elemen waktu submit:
     `<span class="badge bg-light text-dark border mt-1 ms-2"><i class="bi bi-clock-history text-primary me-1"></i> Submit OPD: ${formattedTimestamp}</span>`
3. **Aksi Quick Refresh Per-OPD**:
   - Menyediakan opsi refresh snapshot individual untuk OPD spesifik pada baris jawaban tersebut jika diperlukan.

---

## Verification Plan

### Automated / Manual Verification
1. **Uji Pengelompokan Urusan**: Pastikan 2 atau lebih OPD yang menjawab dalam 1 Urusan (Sub Kategori) tampil dengan timestamp pengiriman masing-masing secara benar.
2. **Uji Penyalinan Drive**: Simpan jawaban responden dengan link folder Drive berisi subfolder & file. Verifikasi bahwa folder arsip `[SIMVEL] Arsip Bukti Dukung` terisi struktur folder & file yang persis sama.
3. **Uji Toggle Switch Link Asli**: Ubah switch OFF <-> ON pada validasi Urusan. Verifikasi bahwa tombol `🔗 Link Evd. Asli` untuk semua OPD dalam Urusan tersebut tampil dan tersembunyi secara responsif.
4. **Uji Refresh Snapshot**: Uji refresh per-OPD dan refresh per-Urusan, pastikan SweetAlert loading berjalan dan URL `link_arsip` berhasil diperbarui di database.
