# Desain: Opsi "Tidak Bisa Dinilai" (Bobot 0) di Validasi Evaluator

Tanggal: 2026-11-20
Status: menunggu persetujuan

## Intent & alasan

Saat ini evaluator wajib memilih salah satu bobot A–E untuk setiap jawaban OPD. Tidak ada cara menandai jawaban yang datanya tidak lengkap sehingga tidak bisa diberi nilai. Evaluator butuh opsi resmi "tidak bisa dinilai" yang menyimpan skor 0 plus catatan wajib, dan bukti visual di daftar urusan.

## Goal

- Tombol "Tidak Bisa Dinilai" terpisah dari pill A–E, style glowing (oranye/merah), di UI classic (`JS.html`) dan Modern (`JS_Modern.html`).
- Memilih tombol itu menyimpan `skala_evaluator = 0`.
- Catatan evaluator wajib saat opsi dipilih: diblok saat simpan di klien, divalidasi ulang di server.
- Urusan tetap dihitung "selesai/tervalidasi" walau ada butir 0, tapi daftar urusan menampilkan badge jumlah butir tak bisa dinilai (jika > 0).
- Perbaikan bug `LaporanController.js`: nilai 0 saat ini tampil "–" di `{{FT_SKOR}}` karena cek truthy; harus dibedakan 0 vs kosong.

## Non-goal

- Tidak mengubah skema data Firebase (tidak ada field baru).
- Tidak memperbaiki anomali bobot data (P1/P3/P69/P85/P146) — ditunda, lihat `docs/catatan-bobot-anomali.md`.
- Tidak mengubah rumus penilaian `_computeLaporanNilai` (0 memang tidak menambah skor).

## Pendekatan (sudah dipilih: A)

- **A (dipilih):** penanda diturunkan dari `skala_evaluator === 0`. Tanpa perubahan skema. Ambigu hanya jika ada bobot 0 di pill A–E — dicegah dengan sanitizer bobot.
- **B (ditolak):** field status eksplisit di record verifikasi. Skema berubah, semua pembaca verifikasi harus dicek, untungnya sedikit.

## Keputusan implementasi

1. **Data:** `verifikasi/{opd}/{id_soal}.skala_evaluator = 0`, `catatan_evaluator` wajib terisi.
2. **UI validasi (JS.html + JS_Modern.html):**
   - Tombol khusus "Tidak Bisa Dinilai" setelah pill A–E; class CSS glowing baru di `CSS.html` + `CSS_Modern.html` (animasi box-shadow pulse, warna oranye/merah).
   - State aktif saat `skala_evaluator === 0` (bandingkan sebagai string "0" untuk selaras dengan pill).
   - `simpanVal`: sebelum kirim, kumpulkan item bernilai 0 tanpa catatan → blok simpan, Swal error berisi jumlah, scroll + highlight kartu pertama yang bermasalah.
3. **Server (`JawabanController.simpanVerifikasi`):** tolak dengan Error jika ada item `skala_evaluator === 0` dan `catatan` kosong.
4. **Statistik (`JawabanController._computeSubKatStats`):** tambah `total_tak_dinilai` per sub-kategori = jumlah verifikasi dengan `skala_evaluator === 0` untuk soal di sub-kategori itu. `total_divalidasi` tidak berubah (0 tetap dihitung divalidasi).
5. **Daftar urusan (JS.html `loadSubKat` + JS_Modern.html `loadSubKat`):** badge tambahan `<i class="bi bi-exclamation-triangle"></i> N tak bisa dinilai` (oranye) di samping badge status, hanya jika `total_tak_dinilai > 0`. Status "Selesai" tidak berubah.
6. **Laporan (`LaporanController.js`):** ganti cek truthy `{{FT_SKOR}}` menjadi eksplisit `!== "" && !== null && !== undefined` agar 0 tercetak "0".
7. **Sanitizer bobot (`SoalController.js`):** saat simpan soal, wajib `bobot` berformat 5 angka positif dipisah `|` (tanpa 0, urutan tidak dipaksakan karena P1 memang menurun). Format salah → tolak dengan pesan jelas. Ini menjaga nilai 0 tetap berarti "tak bisa dinilai".

## Detail teknis yang harus dijaga builder

- Default lama "samakan otomatis dengan responden" hanya berlaku untuk `skala_evaluator === ""/null/undefined` — nilai 0 jangan tertimpa (cek sudah pakai `===`, jangan diubah jadi truthy).
- "Samakan Skor" tidak pernah menghasilkan 0 (bobot responden tidak mungkin 0 setelah sanitizer).
- Data lama: tidak ada `skala_evaluator = 0` di verifikasi (dicek dari backup), jadi tidak ada data historis yang salah makna.

## Tersisa untuk builder

- Nama class CSS glowing dan styling persisnya.
- Salinan penyesuaian kecil UI lain yang tidak mengubah perilaku (mis. placeholder catatan saat opsi dipilih) — opsional.

## Referensi

- `docs/catatan-bobot-anomali.md` — anomali bobot data, perbaikan ditunda.
