function simpanSemuaJawaban(payload) {
  const sheet = getSS().getSheetByName("Jawaban");
  const rows = payload.jawaban.map(item => [
    new Date(), 
    payload.opd, 
    item.id, 
    item.skala, 
    item.link, 
    item.pilihan_teks 
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return "Berhasil";
}

function getOPDSudahKirim() {
  const sheet = getSS().getSheetByName("Jawaban");
  if (sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  return [...new Set(data.map(r => r[1]))];
}

function getSubKategoriList() {
  const sheet = getSS().getSheetByName("Master_Pertanyaan");
  if (sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  // Sub Kategori is at index 2 (Kolom C)
  const subCats = data.map(r => r[2] ? r[2].toString().trim() : "Umum");
  return [...new Set(subCats)];
}

function getJawabanBySubKategori(subKategori) {
  const ss = getSS();
  const ds = ss.getSheetByName("Master_Pertanyaan").getDataRange().getValues().slice(1);
  const djSheet = ss.getSheetByName("Jawaban");
  const dj = djSheet.getLastRow() > 1 ? djSheet.getDataRange().getValues().slice(1) : [];
  const vSheet = ss.getSheetByName("Verifikasi");
  const dv = vSheet.getLastRow() > 1 ? vSheet.getDataRange().getValues().slice(1) : [];
  
  // Filter pertanyaan by Sub Kategori (Kolom C / Index 2)
  const soalTerkait = ds.filter(s => (s[2] ? s[2].toString().trim() : "Umum") === subKategori);
  
  // Build the result
  return soalTerkait.map(soal => {
    const idSoal = soal[0].toString();
    const pertanyaan = soal[3];
    const bobot_str = soal[8] ? soal[8].toString() : "";
    
    // Cari semua OPD yang menjawab soal ini
    const jawabanSoalIni = dj.filter(j => j[2].toString() === idSoal);
    
    const jawabanMapped = jawabanSoalIni.map(j => {
      const opd = j[1];
      const verif = dv.find(v => v[1] === opd && v[2].toString() === idSoal);
      return {
        opd: opd,
        pilihan_responden: j[5] || "-",
        skala_responden: j[3],
        link: j[4],
        skala_evaluator: verif ? verif[4] : "",
        catatan: verif ? verif[5] : ""
      };
    });
    
    return {
      id_soal: idSoal,
      pertanyaan: pertanyaan,
      bobot_str: bobot_str,
      jawaban_opd: jawabanMapped
    };
  });
}

function simpanVerifikasi(payload) {
  const sheet = getSS().getSheetByName("Verifikasi");
  const data = sheet.getDataRange().getValues();
  
  // payload.items structure: [{opd, id_soal, skala_responden, skala_evaluator, catatan}, ...]
  payload.items.forEach(item => {
    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === item.opd && data[i][2].toString() === item.id_soal.toString()) { 
        rowIdx = i + 1; 
        break; 
      }
    }
    const val = [new Date(), item.opd, item.id_soal, item.skala_responden, item.skala_evaluator, item.catatan];
    if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, 6).setValues([val]);
    else sheet.appendRow(val);
  });
  return "Berhasil";
}

function getStats() {
  const ss = getSS();
  const userSheet = ss.getSheetByName("Users");
  const resps = userSheet.getDataRange().getValues().filter(r => r[2] === "Responden").length;
  const jSheet = ss.getSheetByName("Jawaban");
  const sudah = jSheet.getLastRow() > 1 ? [...new Set(jSheet.getDataRange().getValues().slice(1).map(r => r[1]))].length : 0;
  return { total: resps, sudah: sudah };
}

function getLaporanNilai() {
  const ss = getSS();
  
  // 1. Get Global Faktor Umum Setting
  let faktorUmumGlobal = 0;
  try {
    const sheetPengaturan = ss.getSheetByName("Pengaturan_Umum");
    if (sheetPengaturan) {
      const dataPengaturan = sheetPengaturan.getDataRange().getValues();
      for(let i = 1; i < dataPengaturan.length; i++) {
        faktorUmumGlobal += parseFloat(dataPengaturan[i][2]) || 0;
      }
    }
  } catch(e) {}
  
  // 2. Get Master Pertanyaan (to map id_soal -> sub_kategori)
  const dsSheet = ss.getSheetByName("Master_Pertanyaan");
  const ds = dsSheet.getLastRow() > 1 ? dsSheet.getDataRange().getValues().slice(1) : [];
  let mapSubKategori = {}; // { "id_soal": "Sub Kategori" }
  ds.forEach(r => {
    const sub = r[2] ? r[2].toString().trim() : "Umum";
    mapSubKategori[r[0].toString()] = sub;
  });
  
  // 3. Get all Verifikasi (Evaluator's verified scores)
  const vSheet = ss.getSheetByName("Verifikasi");
  const dv = vSheet.getLastRow() > 1 ? vSheet.getDataRange().getValues().slice(1) : [];
  
  // Hitung score per OPD per Sub-kategori
  let opdScores = {}; // { "OPD A": { "Kepegawaian": 10, "Keuangan": 20 } }
  
  dv.forEach(r => {
    const opd = r[1];
    const idSoal = r[2].toString();
    const skorEval = parseFloat(r[4]) || 0;
    
    if (!opdScores[opd]) opdScores[opd] = {};
    
    const subKat = mapSubKategori[idSoal] || "Umum";
    if (!opdScores[opd][subKat]) opdScores[opd][subKat] = 0;
    
    opdScores[opd][subKat] += skorEval;
  });
  
  // Format for reporting
  let laporan = [];
  for (let opd in opdScores) {
    for (let urusan in opdScores[opd]) {
      let teknis = opdScores[opd][urusan];
      laporan.push({
        opd: opd,
        urusan: urusan,
        faktor_umum: faktorUmumGlobal,
        faktor_teknis: teknis,
        total_akhir: faktorUmumGlobal + teknis
      });
    }
  }
  
  // Sort by highest total_akhir
  laporan.sort((a, b) => b.total_akhir - a.total_akhir);
  
  return laporan;
}

function getOpdSudahIsi() {
  const ss = getSS();
  const jSheet = ss.getSheetByName("Jawaban");
  if (jSheet.getLastRow() < 2) return [];
  const data = jSheet.getRange(2, 2, jSheet.getLastRow() - 1, 1).getValues();
  const opds = [...new Set(data.map(r => r[0].toString().trim()))].filter(o => o !== "");
  return opds.sort();
}

function resetJawabanOPD(opdName) {
  const ss = getSS();
  
  // Hapus dari sheet Jawaban
  const jSheet = ss.getSheetByName("Jawaban");
  if (jSheet.getLastRow() > 1) {
    const jData = jSheet.getDataRange().getValues();
    // Reverse loop to avoid index shifting
    for (let i = jData.length - 1; i >= 1; i--) {
      if (jData[i][1].toString() === opdName) {
        jSheet.deleteRow(i + 1);
      }
    }
  }
  
  // Hapus dari sheet Verifikasi juga
  resetValidasiOPD(opdName);
  
  return "Seluruh data jawaban dan validasi untuk " + opdName + " berhasil di-reset!";
}

function resetValidasiOPD(opdName) {
  const ss = getSS();
  const vSheet = ss.getSheetByName("Verifikasi");
  if (vSheet.getLastRow() > 1) {
    const vData = vSheet.getDataRange().getValues();
    for (let i = vData.length - 1; i >= 1; i--) {
      if (vData[i][1].toString() === opdName) {
        vSheet.deleteRow(i + 1);
      }
    }
  }
  return "Data validasi evaluator untuk " + opdName + " berhasil di-reset!";
}
