/**
 * Skrip Migrasi Data Satu-Kali-Jalan (One-Time Migration)
 * Menjalankan fungsi ini akan menyalin seluruh data dari Google Sheets saat ini ke Firebase Realtime Database.
 */
function migrateDataToFirebase() {
  const ss = getSS();

  // 1. Users
  const userSheet = ss.getSheetByName("Users");
  if (userSheet) {
    const data = userSheet.getDataRange().getValues().slice(1);
    const usersObj = {};
    data.forEach(r => {
      if (r[0]) {
        const escapedUser = Firebase.escapeKey(r[0].toString().trim());
        usersObj[escapedUser] = {
          password: r[1].toString().trim(),
          role: r[2].toString().trim(),
          nama_opd: r[3].toString().trim()
        };
      }
    });
    Firebase.put("users", usersObj);
    Logger.log("Tabel Users berhasil dimigrasikan.");
  }

  // 2. Master OPD
  const opdSheet = ss.getSheetByName("Master_OPD");
  if (opdSheet) {
    const data = opdSheet.getRange(2, 1, opdSheet.getLastRow() - 1, 1).getValues();
    const opdList = data.map(r => r[0].toString().trim()).filter(n => n !== "");
    Firebase.put("master_opd", opdList);
    Logger.log("Tabel Master OPD berhasil dimigrasikan.");
  }

  // 3. Master Pertanyaan
  const pertSheet = ss.getSheetByName("Master_Pertanyaan");
  if (pertSheet) {
    const data = pertSheet.getDataRange().getValues().slice(1);
    const pertObj = {};
    data.forEach(r => {
      if (r[0]) {
        const idSoal = Firebase.escapeKey(r[0].toString().trim());
        pertObj[idSoal] = {
          no: r[1] || "",
          urusan: r[2] ? r[2].toString().trim() : "Umum",
          pertanyaan: r[3] || "",
          indikator: r[4] || "",
          data_dukung: r[5] || "",
          penjelasan: r[6] || "",
          referensi: r[7] || "",
          bobot: Number(r[8] || 0)
        };
      }
    });
    Firebase.put("master_pertanyaan", pertObj);
    Logger.log("Tabel Master Pertanyaan berhasil dimigrasikan.");
  }

  // 4. Jawaban
  const jawSheet = ss.getSheetByName("Jawaban");
  if (jawSheet && jawSheet.getLastRow() > 1) {
    const data = jawSheet.getDataRange().getValues().slice(1);
    const jawObj = {};
    data.forEach(r => {
      if (r[1] && r[2]) {
        const opd = Firebase.escapeKey(r[1].toString().trim());
        const idSoal = Firebase.escapeKey(r[2].toString().trim());
        if (!jawObj[opd]) jawObj[opd] = {};
        jawObj[opd][idSoal] = {
          timestamp: r[0],
          skala_responden: r[3] !== "" ? Number(r[3]) : "",
          link: r[4] ? r[4].toString() : "",
          pilihan_teks: r[5] ? r[5].toString() : "",
          nama_dokumen: r[6] ? r[6].toString() : "",
          sistem_nilai: r[7] ? r[7].toString() : "",
          sumber_data: r[8] ? r[8].toString() : "",
          penjelasan: r[9] ? r[9].toString() : ""
        };
      }
    });
    
    for (let opd in jawObj) {
      Firebase.put(`jawaban/${opd}`, jawObj[opd]);
    }
    Logger.log("Tabel Jawaban berhasil dimigrasikan.");
  }

  // 5. Verifikasi
  const verSheet = ss.getSheetByName("Verifikasi");
  if (verSheet && verSheet.getLastRow() > 1) {
    const data = verSheet.getDataRange().getValues().slice(1);
    const verObj = {};
    data.forEach(r => {
      if (r[1] && r[2]) {
        const opd = Firebase.escapeKey(r[1].toString().trim());
        const idSoal = Firebase.escapeKey(r[2].toString().trim());
        if (!verObj[opd]) verObj[opd] = {};
        verObj[opd][idSoal] = {
          timestamp: r[0],
          skala_responden: r[3] !== "" ? Number(r[3]) : "",
          skala_evaluator: r[4] !== "" ? Number(r[4]) : "",
          catatan_evaluator: r[5] ? r[5].toString() : ""
        };
      }
    });
    
    for (let opd in verObj) {
      Firebase.put(`verifikasi/${opd}`, verObj[opd]);
    }
    Logger.log("Tabel Verifikasi berhasil dimigrasikan.");
  }

  return "Migrasi Selesai!";
}
