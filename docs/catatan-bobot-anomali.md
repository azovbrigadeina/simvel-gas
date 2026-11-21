# Catatan: Bobot Anomali Master_Pertanyaan (Menunggu Cross-check)

Sumber: `db BACKUP/Aplikasi SimVeL.xlsx` — sheet `Master_Pertanyaan` (271 soal). Dicek 2026-11-20.
**Data backup, bukan live Firebase.** Cek ulang isi live sebelum memperbaiki.

## Anomali bobot ditemukan (5 soal)

| ID | Bobot sekarang | Masalah | Usulan perbaikan | Dampak data terkait |
|----|---------------|---------|------------------|---------------------|
| P69 | `30\60|90|120|150` | backslash bukan `\|`, parsing kacau (4 nilai) | `30|60|90|120|150` | 0 jawaban, 0 verifikasi — aman |
| P85 | `10|20|3040|50` | angka nyatu, hilang `\|` (4 nilai) | `10|20|30|40|50` | 0 jawaban, 0 verifikasi — aman |
| P146 | `6|12|28|24|30` | tidak urut (C=28 > D=24), pola +6 rusak | `6|12|18|24|30` | 1 verifikasi skala 24 (D); setelah fix D tetap 24 — nilai lama tetap cocok |
| P3 | `10|20|30|40|40` | D=E=40 duplikat | `10|20|30|40|50` | 4 jawaban responden (skala 30–40); soal Faktor Umum, tidak masuk skor akhir |
| P1 | `100|80|60|40|20` | menurun (A terbesar), satu-satunya arah terbalik di seluruh dataset | **BUTUH KONFIRMASI** — kelas interval naik (≤250 M → >1 T) tapi bobot menurun; mungkin disengaja (penduduk sedikit = skor besar), mungkin typo | Soal Faktor Umum, tidak memengaruhi skor akhir |

Catatan: selain 5 di atas, pola umum bobot di dataset selalu naik A<E (mis. `2|4|6|8|10`, `60|120|180|240|300`). Bobot terendah yang ada = 2. **Tidak ada soal dengan bobot 0 di pilihan mana pun.**

## Konteks fitur baru: opsi "Tidak Bisa Dinilai"

Fitur sedang dibahas: tombol "Tidak Bisa Dinilai" terpisah dari pill A–E di lembar validasi evaluator, efek glowing, menyimpan `skala_evaluator = 0`, wajib catatan. Karena tidak ada bobot 0 di data, tidak ada tabrakan nilai 0 antara opsi baru dan pill A–E. (Tetap disarankan tandai opsi khusus secara terpisah, bukan hanya dari angka, untuk jaga-jaga admin isi bobot 0 di masa depan.)

## Cara perbaikan (saat sudah di-cross-check)

1. Data live Firebase tidak bisa diedit dari repo ini. Buat script sekali-jalan di `Migration.js` (mis. `perbaikiBobotAnomali()`) berisi mapping ID → bobot benar di atas, jalankan dari Apps Script editor, tampilkan laporan sebelum/sesudah per ID.
2. Tambahan pencegahan: sanitizer bobot di `SoalController.js` — bobot yang disimpan wajib 5 angka dipisah `\|` dan urut naik (kecuali P1 dikonfirmasi memang turun), kalau tidak → tolak dengan pesan jelas.
