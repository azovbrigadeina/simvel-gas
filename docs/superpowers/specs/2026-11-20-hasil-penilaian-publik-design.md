# Design Spec: Tombol Informasi Hasil Penilaian Publik di Landing Modern

## Overview
Menambahkan tombol **"Informasi Hasil Penilaian"** di tengah laman depan `View_Landing_Modern.html`
(di bawah kartu Portal Responden & Portal Evaluator, sebelum footer). Tombol membuka modal
berisi rekapitulasi hasil penilaian per **Urusan** dengan **3 kolom saja**: Urusan, Total Nilai,
serta Intensitas & Tipe.

## Latar Belakang & Logika Data
- Sumber utama: `getLaporanNilai()` / `_computeLaporanNilai()` di `JawabanController.js`, yang
  menghasilkan satu baris per pasangan OPD–Urusan.
- Pada laporan per urusan (`buatLaporanUrusan` di `LaporanController.js`), nilai akhir sebuah
  urusan dihitung dengan **merata-ratakan `total_akhir` seluruh OPD** dalam urusan tersebut,
  lalu `determineRating(rata-rata)` menentukan Intensitas & Tipe. Logika ini yang akan ditiru.
- Kategori "Umum"/Faktor Umum sudah dikecualikan oleh `_computeLaporanNilai()` (filter
  sub-kategori `A. FAKTOR` / `B. FAKTOR` / `umum`), sehingga tidak muncul di hasil.

## Goals
- Satu baris per urusan, meskipun urusan tersebut diisi lebih dari satu OPD.
- Angka konsisten dengan laporan penilaian evaluator.
- Dapat diakses publik dari landing tanpa login, tanpa membocorkan data per-OPD.
- Tampilan menyatu dengan gaya Modern UI yang ada.

## Non-Goals
- Tidak menampilkan kolom Faktor Umum, Faktor Teknis, OPD, maupun tombol Aksi/Cetak.
- Tidak mengubah tampilan/behavior Rekapitulasi Laporan Penilaian di portal evaluator.
- Tidak menambah halaman/routing baru.

## Approach
### Backend
- Tambah fungsi publik `getRekapUrusanPublik()` di `LaporanController.js`.
- Fungsi memakai `_loadSharedData()` + `_loadFaktorUmumGlobal()` + `_computeLaporanNilai()`.
- Kelompokkan hasil per `urusan`; hitung rata-rata `total_akhir` (dibulatkan 2 desimal).
- `determineRating(rata-rata)` menghasilkan `intensitas` & `tipe`.
- Kembalikan array `{ urusan, total_nilai, intensitas, tipe }`, diurutkan menurun berdasarkan
  `total_nilai`. Tidak memerlukan token/role.

### Frontend
- `View_Landing_Modern.html`: tombol terpusat `Informasi Hasil Penilaian` dengan ikon
  `bi-info-circle`, ditempatkan setelah baris kartu peran dan sebelum footer, hanya terlihat
  di tampilan pemilihan peran.
- `JS_Modern.html`: fungsi `showInformasiHasilPenilaian()` memanggil `getRekapUrusanPublik()`
  via `google.script.run`, menampilkan loading, lalu merender tabel 3 kolom di dalam
  `Swal.fire` (SweetAlert2 sudah dipakai). Badge warna Tipe mengikuti pola `loadLaporan`.
- Tangani kondisi kosong dan error dengan pesan yang ramah.

## Constraints
- Google Apps Script HTML Service; data dibaca dari Firebase melalui helper yang ada.
- Gunakan `escHtml` yang sudah tersedia di `JS.html` untuk mencegah XSS.
- Pertahankan gaya, spacing, dan komponen Modern UI.

## Verification
1. Panggil `getRekapUrusanPublik()`: pastikan setiap urusan muncul tepat satu kali.
2. Bandingkan Total Nilai sebuah urusan yang diisi 2 OPD dengan hasil `buatLaporanUrusan`
   (rata-rata) — harus sama.
3. Pastikan baris "Umum"/Faktor Umum tidak muncul.
4. Klik tombol di landing: modal terbuka, tabel 3 kolom tampil, badge Intensitas & Tipe benar.
5. Uji kondisi data kosong dan kegagalan server.
