# Rapikan Tabel Laporan Penilaian + Tombol Cetak Rekap PDF

Tanggal: 2026-11-25
Status: disetujui

## Intent

Menu **Laporan Penilaian** di portal Evaluator tabelnya berantakan: kolom Urusan sempit
dan terpotong, tombol "Lihat OPD" dan "Cetak" bertumpuk selebar sel, header hilang saat
di-scroll, angka tidak sejajar. Belum ada cara mencetak rekap **semua** urusan sekaligus —
yang ada hanya cetak per urusan.

Yang diinginkan: tabel rekap yang enak dibaca, plus tombol **Cetak Rekap** yang menonjol
(highlight + glow) untuk menghasilkan satu PDF berisi daftar seluruh urusan.

## Goals

- Tabel Laporan Penilaian rapi di UI Modern dan Classic.
- Satu PDF berisi tabel rekap seluruh urusan: Urusan, Total Nilai, Intensitas & Tipe.
- Tombol Cetak Rekap terlihat menonjol: highlight + glow.

## Non-Goals

- Tidak mengubah laporan detail per urusan (`buatLaporanUrusan`) — tetap seperti sekarang.
- Tidak mengubah rumus penilaian.
- Tidak menambah dependency, API key, atau layanan pihak ketiga.
- Tidak mengubah landing publik.

## Approaches

| Opsi | Isi | Trade-off |
|------|-----|-----------|
| **A. Google Doc programatik** (dipilih) | `DocumentApp.create()`, tulis judul + tabel 3 kolom, export PDF, doc sementara di-trash | Tidak menyentuh template, tidak ada tag yang bisa bentrok, hasil bersih. Scope `documents` sudah ada. |
| B. Copy template laporan, buang bagian detail | Gaya otomatis sama dengan laporan per urusan | Rapuh: perubahan struktur template merusak kode |
| C. Sheet sementara, export PDF | Paling mudah | Hasil terlihat seperti spreadsheet, bukan dokumen laporan |

## Keputusan yang saya ambil

- Kertas A4 portrait, margin normal.
- Judul `REKAPITULASI HASIL PENILAIAN`, subjudul tanggal cetak + jumlah urusan.
- Tabel 3 kolom: Urusan, Total Nilai, Intensitas & Tipe. Header tebal berlatar abu-abu.
- Urutan urusan: Total Nilai tertinggi ke terendah.
- Nama file `Rekap Hasil Penilaian - dd-MM-yyyy HH:mm.pdf`, disimpan di folder `folder_id`.
- Doc sementara langsung di-trash setelah PDF dibuat.
- Tombol "Cetak Rekap" di header menu Laporan Penilaian, di samping "Perbarui Data".

## Bagian

- `LaporanController.js`: fungsi baru `buatRekapSemuaUrusanPDF(token)`.
- `JS.html`: render tabel baru di `loadLaporan()`, fungsi `cetakRekapSemuaUrusan()`.
- `View_Evaluator_Modern.html` + `View_Evaluator.html`: tombol Cetak Rekap.
- `CSS_Modern.html` + `CSS.html`: kelas `.btn-cetak-rekap` (highlight + glow) dan kelas tabel laporan.

## Constraints

- Google Apps Script, gaya ES5/ES6 seperti kode sekitarnya.
- Teks dinamis di frontend lewat `escHtml` / `escJsAttr`.
- `appsscript.json` tidak berubah.

## Verification

1. `npm test` lulus.
2. Buka Laporan Penilaian: Urusan tidak terpotong, tombol aksi sejajar, header sticky saat scroll.
3. Klik Cetak Rekap: loading muncul, PDF terbuka, isinya tabel 3 kolom seluruh urusan.
4. Urusan yang diisi 2 OPD tetap satu baris dengan nilai gabungan.
5. Data kosong: pesan ramah, bukan error mentah.
6. Doc sementara tidak tertinggal di Drive.
