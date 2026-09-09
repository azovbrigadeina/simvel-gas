# Design Spec: Snapshot Google Drive Rekursif, Dual Link Verifikasi, & Audit Timestamp Bukti Dukung SIMvel

## Overview
Spesifikasi desain ini merinci implementasi **Fase 1** untuk proyek SIMvel, yaitu:
1. Penyalinan otomatis bukti dukung Google Drive milik responden secara rekursif (termasuk folder & subfolder) ke Drive Admin SIMvel (`link_arsip`).
2. Sakelar toggle switch **"Cek Link Evd. Asli"** pada antarmuka verifikasi evaluator untuk beralih antara link Snapshot Admin terkunci dan Link Live Asli Responden.
3. Tombol **"Refresh Snapshot"** untuk memicu pembaruan snapshot ulang seluruh bukti dukung satu OPD.
4. Tampilan **Audit Timestamp Pengiriman Per-Item Bukti Dukung** untuk memverifikasi waktu unggah berkas secara pasti.

Semua perubahan antarmuka pengguna (UI) dirancang untuk menyatu secara konsisten (*seamless*) tanpa merubah tata letak (*layout*) SIMvel secara radikal.

---

## Problem Statement
- **Keamanan & Audit Berkas**: Bukti dukung yang disubmit responden berupa folder/file Google Drive berisiko diubah atau dihapus setelah masa pengisian berakhir.
- **Klarifikasi Data**: Evaluator memerlukan arsip snapshot resmi yang terkunci, sekaligus opsi akses cepat ke link asli responden jika terdapat kendala akses pada snapshot.
- **Kepastian Waktu Pengiriman**: Evaluator membutuhkan informasi timestamp yang jelas untuk setiap item bukti dukung guna mengecek apakah berkas diunggah sebelum atau sesudah batas waktu pengisian (*deadline*).

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
- **Fungsi `resnapshotAllByOPD(namaOPD)`**:
  - Diakses oleh Evaluator/Admin untuk menyalin ulang seluruh item bukti dukung OPD tertentu secara otomatis.
  - Meng-update `link_arsip` pada node `jawaban` di Firebase/Sheets.
  - Mengembalikan status keberhasilan dan jumlah item yang di-snapshot ulang.

---

### 2. Frontend Interface (`View_Evaluator.html`, `JS.html`, `CSS.html`)

#### A. Header Form Validasi (`#val-form-view`)
Tanpa mengubah komponen sidebar dan tombol navigasi utama, pada sub-header halaman validasi disisipkan:
1. **Form Switch Bootstrap (`#switch-link-asli`)**:
   - Label: `Cek Link Evd. Asli`.
   - Event `onchange`: Memicu render ulang daftar bukti dukung (toggle antara mode Snapshot Admin & Link Asli Responden).
2. **Tombol Action Refresh Snapshot (`#btn-refresh-snapshot`)**:
   - Tombol outline info dengan ikon `bi-arrow-repeat`.
   - Menampilkan konfirmasi & SweetAlert2 loading state saat proses snapshot ulang berjalan.

#### B. Rendering Item Bukti Dukung per Soal (`muatValidasi`)
Setiap item bukti dukung yang disubmit oleh OPD akan menampilkan:
1. **Status Link Bukti Dukung**:
   - **Switch OFF (Default)**: Menampilkan tombol `🔒 Snapshot Admin` yang mengarah ke `ans.link_arsip` (jika belum ada, fallback ke `ans.link`).
   - **Switch ON**: Menampilkan 2 tombol berdampingan: `🔒 Snapshot Admin` (`ans.link_arsip`) dan `🔗 Link Evd. Asli` (`ans.link`).
2. **Audit Timestamp Per Bukti Dukung**:
   - Menambahkan elemen badge/info waktu di bawah detail dokumen:
     `<span class="badge bg-light text-dark border mt-1"><i class="bi bi-clock-history text-primary me-1"></i> Waktu Submit: ${formattedTimestamp}</span>`

---

## User Experience (UX) Flow
1. Evaluator memilih Sub Kategori di menu **Validasi Nilai** dan mengeklik **BUKA VALIDASI**.
2. Sistem memuat daftar soal dan jawaban OPD. Setiap jawaban menampilkan tombol **🔒 Snapshot Admin** dan **Timestamp Waktu Submit** berkas tersebut.
3. Jika Evaluator perlu mengecek berkas live asli responden, Evaluator mengaktifkan switch **"Cek Link Evd. Asli"**.
4. Tombol **🔗 Link Evd. Asli** langsung muncul di samping tombol Snapshot Admin.
5. Jika Evaluator melihat berkas responden di snapshot belum lengkap karena baru diperbarui responden, Evaluator mengeklik **"Refresh Snapshot"** untuk memicu snapshot ulang secara instan.

---

## Verification Plan

### Automated / Manual Verification
1. **Uji Penyalinan Drive**: Simpan jawaban responden dengan link folder Drive berisi subfolder & file. Verifikasi bahwa folder arsip `[SIMVEL] Arsip Bukti Dukung` terisi struktur folder & file yang persis sama.
2. **Uji Toggle Switch Link Asli**: Buka tampilan validasi evaluator, ubah switch OFF <-> ON. Verifikasi bahwa tombol `🔗 Link Evd. Asli` tampil dan tersembunyi secara responsif.
3. **Uji Refresh Snapshot OPD**: Klik tombol *Refresh Snapshot*, pastikan SweetAlert loading berjalan dan URL `link_arsip` berhasil diperbarui.
4. **Uji Audit Timestamp**: Pastikan timestamp pada item bukti dukung menunjukkan waktu submit pengisian responden yang akurat (format readable lokal).
