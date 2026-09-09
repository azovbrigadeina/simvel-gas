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
        const katUtama = r[1] ? r[1].toString().trim() : "";
        const urusanSub = r[2] ? r[2].toString().trim() : "Umum";
        pertObj[idSoal] = {
          no: katUtama,
          kategori_utama: katUtama,
          urusan: urusanSub,
          subkat: urusanSub,
          pertanyaan: r[3] || "",
          indikator: r[4] || "",
          data_dukung: r[5] || "",
          penjelasan: r[6] || "",
          referensi: r[7] || "",
          bobot: r[8] ? r[8].toString().trim() : "",
          target: r[9] ? r[9].toString().trim() : ""
        };
      }
    });
    Firebase.put("master_pertanyaan", pertObj);
    Firebase.clearMasterPertanyaanCache();
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

/**
 * Fungsi Wrapper untuk Push Data secara Interaktif dengan Umpan Balik UI
 */
function syncSheetsToFirebaseInteractive() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "Konfirmasi Push Data",
    "Apakah Anda yakin ingin MENGIRIM seluruh data dari Sheets saat ini untuk menimpa database Firebase?\n\n(Tindakan ini akan menimpa data di Firebase dengan data dari Sheets ini)",
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) return;
  
  try {
    migrateDataToFirebase();
    ui.alert("Sukses", "Seluruh data Sheets berhasil dikirim dan disinkronkan ke Firebase!", ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Gagal", "Terjadi kesalahan saat sinkronisasi: " + e.message, ui.ButtonSet.OK);
  }
}

/**
 * Menarik seluruh data Simvel dari Firebase ke Google Sheets
 */
function pullFirebaseToSheetsInteractive() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "Konfirmasi Tarik Data (Pull)",
    "Apakah Anda yakin ingin MENARIK data Simvel dari Firebase ke Sheets?\n\n(Tindakan ini akan menimpa data saat ini)",
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) return;
  
  const ss = getSS(); // Simvel menggunakan helper getSS()
  
  try {
    // 1. Pull Users
    const shUsers = ss.getSheetByName("Users");
    if (shUsers) {
      const usersData = Firebase.get("users") || {};
      const rows = [["Username", "Password", "Role", "Nama_OPD"]];
      Object.keys(usersData).forEach(k => {
        const u = usersData[k];
        rows.push([Firebase.unescapeKey(k), u.password || "", u.role || "", u.nama_opd || ""]);
      });
      shUsers.clearContents();
      shUsers.getRange(1, 1, rows.length, 4).setValues(rows);
      Logger.log("Users pulled successfully.");
    }

    // 2. Pull Master OPD
    const shOPD = ss.getSheetByName("Master_OPD");
    if (shOPD) {
      const opdData = Firebase.get("master_opd") || [];
      const rows = [["Nama OPD"]];
      opdData.forEach(name => { if (name) rows.push([name]); });
      shOPD.clearContents();
      shOPD.getRange(1, 1, rows.length, 1).setValues(rows);
      Logger.log("Master OPD pulled successfully.");
    }

    // 3. Pull Master Pertanyaan
    const shPert = ss.getSheetByName("Master_Pertanyaan");
    if (shPert) {
      const pertData = Firebase.get("master_pertanyaan") || {};
      const rows = [["id_soal", "No", "Urusan", "Pertanyaan", "Indikator Kinerja", "Data Dukung / Output", "Penjelasan Pengisian", "Referensi Aturan/Link", "Bobot", "Target OPD"]];
      Object.keys(pertData).forEach(k => {
        const p = pertData[k];
        rows.push([
          Firebase.unescapeKey(k),
          p.no || "",
          p.urusan || "",
          p.pertanyaan || "",
          p.indikator || "",
          p.data_dukung || "",
          p.penjelasan || "",
          p.referensi || "",
          p.bobot || 0,
          p.target || p.target_opd || ""
        ]);
      });
      shPert.clearContents();
      shPert.getRange(1, 1, rows.length, 10).setValues(rows);
      Logger.log("Master Pertanyaan pulled successfully.");
    }

    // 4. Pull Jawaban
    const shJawaban = ss.getSheetByName("Jawaban");
    if (shJawaban) {
      const jawData = Firebase.get("jawaban") || {};
      const rows = [["Timestamp", "Nama OPD", "ID Soal", "Skala Responden", "Link Bukti Dukung", "Pilihan Jawaban", "Nama Dokumen Utama", "Sistem / Nilai Aplikasi", "Sumber Data / Aplikasi Pendukung", "Penjelasan Singkat"]];
      Object.keys(jawData).forEach(opdEsc => {
        const opdName = Firebase.unescapeKey(opdEsc);
        const opdAns = jawData[opdEsc] || {};
        Object.keys(opdAns).forEach(idSoalEsc => {
          const ans = opdAns[idSoalEsc] || {};
          rows.push([
            ans.timestamp || new Date().toISOString(),
            opdName,
            Firebase.unescapeKey(idSoalEsc),
            ans.skala_responden || "",
            ans.link || "",
            ans.pilihan_teks || "",
            ans.nama_dokumen || "",
            ans.sistem_nilai || "",
            ans.sumber_data || "",
            ans.penjelasan || ""
          ]);
        });
      });
      shJawaban.clearContents();
      if (rows.length > 1) {
        shJawaban.getRange(1, 1, rows.length, 10).setValues(rows);
      } else {
        shJawaban.getRange(1, 1, 1, 10).setValues(rows);
      }
      Logger.log("Jawaban pulled successfully.");
    }

    // 5. Pull Verifikasi
    const shVerif = ss.getSheetByName("Verifikasi");
    if (shVerif) {
      const verifData = Firebase.get("verifikasi") || {};
      const rows = [["Timestamp", "Nama OPD", "ID Soal", "Skala Responden", "Skala Evaluator", "Catatan Evaluator"]];
      Object.keys(verifData).forEach(opdEsc => {
        const opdName = Firebase.unescapeKey(opdEsc);
        const opdVer = verifData[opdEsc] || {};
        Object.keys(opdVer).forEach(idSoalEsc => {
          const v = opdVer[idSoalEsc] || {};
          rows.push([
            v.timestamp || new Date().toISOString(),
            opdName,
            Firebase.unescapeKey(idSoalEsc),
            v.skala_responden || "",
            v.skala_evaluator || "",
            v.catatan_evaluator || ""
          ]);
        });
      });
      shVerif.clearContents();
      if (rows.length > 1) {
        shVerif.getRange(1, 1, rows.length, 6).setValues(rows);
      } else {
        shVerif.getRange(1, 1, 1, 6).setValues(rows);
      }
      Logger.log("Verifikasi pulled successfully.");
    }

    ui.alert("Sukses", "Data Simvel berhasil ditarik!", ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Gagal", "Kesalahan: " + e.message, ui.ButtonSet.OK);
  }
}

