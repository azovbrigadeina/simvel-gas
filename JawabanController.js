function simpanSemuaJawaban(payload) {
  const sheet = getSS().getSheetByName("Jawaban");
  const rows = payload.jawaban.map(item => [
    new Date(), 
    payload.opd, 
    item.id, 
    item.skala, 
    item.link, 
    item.pilihan_teks,
    item.nama_dokumen,
    item.sistem_nilai || "-",
    item.sumber_data || "-",
    item.penjelasan || "-"
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

function getSubKategoriStats() {
  const ss = getSS();
  const dsSheet = ss.getSheetByName("Master_Pertanyaan");
  const ds = dsSheet.getLastRow() > 1 ? dsSheet.getDataRange().getValues().slice(1) : [];
  
  const djSheet = ss.getSheetByName("Jawaban");
  const dj = djSheet.getLastRow() > 1 ? djSheet.getDataRange().getValues().slice(1) : [];
  
  const vSheet = ss.getSheetByName("Verifikasi");
  const dv = vSheet.getLastRow() > 1 ? vSheet.getDataRange().getValues().slice(1) : [];
  
  let stats = {};
  
  // Group by Sub Kategori
  ds.forEach(r => {
    let sub = r[2] ? r[2].toString().trim() : "Umum";
    let qId = r[0].toString();
    if (!stats[sub]) {
      stats[sub] = { nama: sub, total_jawaban: 0, total_divalidasi: 0, qIds: [] };
    }
    stats[sub].qIds.push(qId);
  });
  
  // Count Jawaban
  dj.forEach(j => {
    let qId = j[2].toString();
    let opd = j[1];
    for (let sub in stats) {
      if (stats[sub].qIds.includes(qId)) {
        stats[sub].total_jawaban++;
        
        let isVerified = dv.find(v => v[1] === opd && v[2].toString() === qId);
        if (isVerified) {
          stats[sub].total_divalidasi++;
        }
        break;
      }
    }
  });
  
  // Clean up qIds from the response to reduce payload size
  let result = Object.values(stats).map(s => ({
    nama: s.nama,
    total_jawaban: s.total_jawaban,
    total_divalidasi: s.total_divalidasi
  }));
  
  return result;
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
        nama_dokumen: j[6] || "-",
        sistem_nilai: j[7] || "-",
        sumber_data: j[8] || "-",
        penjelasan: j[9] || "-",
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
  
  let existingMap = new Map();
  for (let i = 1; i < data.length; i++) {
    existingMap.set(data[i][1] + "-" + data[i][2].toString(), i);
  }
  
  let toAppend = [];
  const now = new Date();
  let dataChanged = false;
  
  payload.items.forEach(item => {
    const key = item.opd + "-" + item.id_soal.toString();
    const val = [now, item.opd, item.id_soal, item.skala_responden, item.skala_evaluator, item.catatan];
    
    if (existingMap.has(key)) {
      data[existingMap.get(key)] = val;
      dataChanged = true;
    } else {
      toAppend.push(val);
    }
  });
  
  // Bulk update baris yang sudah ada (menimpa sheet)
  if (dataChanged) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
  
  // Bulk insert baris baru
  if (toAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
  
  return "Berhasil";
}

function getStats() {
  const ss = getSS();
  const userSheet = ss.getSheetByName("Users");
  const resps = userSheet.getDataRange().getValues().filter(r => r[2] === "Responden").length;
  
  const jSheet = ss.getSheetByName("Jawaban");
  const jData = jSheet.getLastRow() > 1 ? jSheet.getDataRange().getValues().slice(1) : [];
  const listOpd = [...new Set(jData.map(r => r[1]))];
  const sudah = listOpd.length;
  
  // Hitung Urusan yang sudah dinilai
  const subKatStats = getSubKategoriStats();
  const urusanSudah = subKatStats.filter(s => s.total_jawaban > 0 && s.total_divalidasi >= s.total_jawaban).length;
  
  // Calculate rating counts
  const laporan = getLaporanNilai();
  let tipeCounts = { "Tipe A": 0, "Tipe B": 0, "Tipe C": 0, "Lainnya": 0 };
  
  laporan.forEach(d => {
    if (d.tipe.includes("Tipe A")) tipeCounts["Tipe A"]++;
    else if (d.tipe.includes("Tipe B")) tipeCounts["Tipe B"]++;
    else if (d.tipe.includes("Tipe C")) tipeCounts["Tipe C"]++;
    else tipeCounts["Lainnya"]++;
  });

  return { 
    total: resps, 
    sudah: sudah,
    urusan_sudah: urusanSudah,
    list_opd: listOpd.sort(),
    tipeA: tipeCounts["Tipe A"],
    tipeB: tipeCounts["Tipe B"],
    tipeC: tipeCounts["Tipe C"],
    tipeLain: tipeCounts["Lainnya"]
  };
}

function getLaporanNilai() {
  const ss = getSS();
  
  // 1. Get Global Pengaturan (Faktor Umum & Exclusion Bonus)
  let faktorUmumGlobal = 0;
  let excludedBonus = [];
  try {
    const props = PropertiesService.getScriptProperties();
    excludedBonus = (props.getProperty('excluded_bonus_urusan') || "").split(",").map(s => s.trim().toLowerCase());

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
      let totalMurni = faktorUmumGlobal + teknis;
      
      // Apply Multiplier 1.1x if not excluded
      let isExcluded = excludedBonus.includes(urusan.toLowerCase());
      let multiplier = isExcluded ? 1.0 : 1.1;
      let totalAkhir = totalMurni * multiplier;
      
      let ratingInfo = determineRating(totalAkhir);
      
      laporan.push({
        opd: opd,
        urusan: urusan,
        faktor_umum: faktorUmumGlobal,
        faktor_teknis: teknis,
        total_akhir: totalAkhir,
        bonus_applied: !isExcluded,
        intensitas: ratingInfo.intensitas,
        tipe: ratingInfo.tipe
      });
    }
  }
  
  // Sort by highest total_akhir
  laporan.sort((a, b) => b.total_akhir - a.total_akhir);
  
  return laporan;
}

function determineRating(score) {
  if (score <= 300) return { intensitas: "Sangat Kecil", tipe: "Seksi/Subbidang" };
  if (score <= 400) return { intensitas: "Sangat Kecil", tipe: "Bidang" };
  if (score <= 600) return { intensitas: "Kecil", tipe: "Tipe C" };
  if (score <= 800) return { intensitas: "Sedang", tipe: "Tipe B" };
  return { intensitas: "Besar", tipe: "Tipe A" };
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
  const jSheet = ss.getSheetByName("Jawaban");
  
  if (jSheet.getLastRow() > 1) {
    const jData = jSheet.getDataRange().getValues();
    // Gunakan filter array di memori, bukan hapus baris satu per satu
    const newData = jData.filter((row, i) => i === 0 || row[1].toString() !== opdName);
    
    jSheet.clearContents();
    if (newData.length > 0) {
      jSheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
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
    // Filter out rows matching opdName
    const newData = vData.filter((row, i) => i === 0 || row[1].toString() !== opdName);
    
    vSheet.clearContents();
    if (newData.length > 0) {
      vSheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
    }
  }
  return "Data validasi evaluator untuk " + opdName + " berhasil di-reset!";
}
