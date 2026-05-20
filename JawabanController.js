// ============================================================
// INTERNAL HELPERS — Shared Data Loading & Computation
// ============================================================

/**
 * Memuat data dari 3 sheet utama sekaligus untuk menghindari
 * pembacaan spreadsheet berulang di fungsi-fungsi yang berbeda.
 */
function _loadSharedData(ss) {
  const dsSheet = ss.getSheetByName("Master_Pertanyaan");
  const djSheet = ss.getSheetByName("Jawaban");
  const vSheet = ss.getSheetByName("Verifikasi");
  
  return {
    ds: dsSheet.getLastRow() > 1 ? dsSheet.getDataRange().getValues().slice(1) : [],
    dj: djSheet.getLastRow() > 1 ? djSheet.getDataRange().getValues().slice(1) : [],
    dv: vSheet.getLastRow() > 1 ? vSheet.getDataRange().getValues().slice(1) : []
  };
}

/**
 * Memuat pengaturan faktor umum global (dari sheet Pengaturan_Umum)
 * dan daftar urusan yang dikecualikan dari bonus (dari PropertiesService).
 */
function _loadFaktorUmumGlobal(ss) {
  let faktorUmumGlobal = 0;
  let excludedBonus = [];
  try {
    const props = PropertiesService.getScriptProperties();
    excludedBonus = (props.getProperty('excluded_bonus_urusan') || "").split(",").map(s => s.trim().toLowerCase());

    const sheetPengaturan = ss.getSheetByName("Pengaturan_Umum");
    if (sheetPengaturan) {
      const dataPengaturan = sheetPengaturan.getDataRange().getValues();
      for (let i = 1; i < dataPengaturan.length; i++) {
        faktorUmumGlobal += parseFloat(dataPengaturan[i][2]) || 0;
      }
    }
  } catch(e) {}
  return { faktorUmumGlobal: faktorUmumGlobal, excludedBonus: excludedBonus };
}

/**
 * Komputasi statistik sub-kategori menggunakan Map/Set untuk O(1) lookup.
 * Menggantikan nested loop + Array.includes() yang sebelumnya O(n²).
 */
function _computeSubKatStats(ds, dj, dv) {
  var stats = {};

  // Reverse-map: qId → subKategori (O(1) lookup)
  var qIdToSub = {};
  ds.forEach(function(r) {
    var sub = r[2] ? r[2].toString().trim() : "Umum";
    var qId = r[0].toString();
    qIdToSub[qId] = sub;
    if (!stats[sub]) {
      stats[sub] = { nama: sub, total_jawaban: 0, total_divalidasi: 0 };
    }
  });

  // Verification Set for O(1) lookup
  var verifSet = {};
  dv.forEach(function(v) {
    verifSet[v[1] + "||" + v[2].toString()] = true;
  });

  // Count Jawaban — O(1) per item (was O(n²))
  dj.forEach(function(j) {
    var qId = j[2].toString();
    var opd = j[1];
    var sub = qIdToSub[qId];
    if (sub && stats[sub]) {
      stats[sub].total_jawaban++;
      if (verifSet[opd + "||" + qId]) {
        stats[sub].total_divalidasi++;
      }
    }
  });

  var result = [];
  for (var sub in stats) {
    result.push({
      nama: stats[sub].nama,
      total_jawaban: stats[sub].total_jawaban,
      total_divalidasi: stats[sub].total_divalidasi
    });
  }
  return result;
}

/**
 * Komputasi jawaban per sub-kategori menggunakan Map untuk O(1) lookup verifikasi.
 * Menggantikan dv.find() yang sebelumnya O(n) per jawaban.
 */
function _computeJawabanBySubKategori(subKategori, ds, dj, dv) {
  // Verification Map for O(1) lookup (was dv.find() = O(n) per call)
  var verifMap = {};
  dv.forEach(function(v) {
    verifMap[v[1] + "||" + v[2].toString()] = v;
  });

  // Filter pertanyaan by Sub Kategori
  var soalTerkait = ds.filter(function(s) {
    return (s[2] ? s[2].toString().trim() : "Umum") === subKategori;
  });

  return soalTerkait.map(function(soal) {
    var idSoal = soal[0].toString();
    var pertanyaan = soal[3];
    var bobot_str = soal[8] ? soal[8].toString() : "";

    var jawabanSoalIni = dj.filter(function(j) {
      return j[2].toString() === idSoal;
    });

    var jawabanMapped = jawabanSoalIni.map(function(j) {
      var opd = j[1];
      var verif = verifMap[opd + "||" + idSoal];
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

/**
 * Komputasi laporan nilai dari data yang sudah di-load.
 * Menghindari pembacaan ulang spreadsheet.
 */
function _computeLaporanNilai(ds, dv, faktorUmumGlobal, excludedBonus) {
  // Map id_soal -> sub_kategori
  var mapSubKategori = {};
  ds.forEach(function(r) {
    var sub = r[2] ? r[2].toString().trim() : "Umum";
    mapSubKategori[r[0].toString()] = sub;
  });

  // Score per OPD per Sub-kategori
  var opdScores = {};
  dv.forEach(function(r) {
    var opd = r[1];
    var idSoal = r[2].toString();
    var skorEval = parseFloat(r[4]) || 0;

    if (!opdScores[opd]) opdScores[opd] = {};
    var subKat = mapSubKategori[idSoal] || "Umum";
    if (!opdScores[opd][subKat]) opdScores[opd][subKat] = 0;
    opdScores[opd][subKat] += skorEval;
  });

  var laporan = [];
  for (var opd in opdScores) {
    for (var urusan in opdScores[opd]) {
      var teknis = opdScores[opd][urusan];
      var totalMurni = faktorUmumGlobal + teknis;
      var isExcluded = excludedBonus.includes(urusan.toLowerCase());
      var multiplier = isExcluded ? 1.0 : 1.1;
      var totalAkhir = totalMurni * multiplier;
      var ratingInfo = determineRating(totalAkhir);

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

  laporan.sort(function(a, b) { return b.total_akhir - a.total_akhir; });
  return laporan;
}

// ============================================================
// PUBLIC API FUNCTIONS (Thin wrappers — sama persis hasilnya)
// ============================================================

function simpanSemuaJawaban(payload) {
  // Validasi Batas Waktu Server-Side
  const props = PropertiesService.getScriptProperties();
  const dGlobal = props.getProperty('deadline_global') || '';
  let opdDeadlines = {};
  try { opdDeadlines = JSON.parse(props.getProperty('deadline_opd') || '{}'); } catch(e) {}
  
  let deadlineStr = opdDeadlines[payload.opd] || dGlobal;
  if (deadlineStr) {
    const deadlineTime = new Date(deadlineStr).getTime();
    const now = new Date().getTime();
    if (now > deadlineTime) {
      throw new Error("Gagal menyimpan: Waktu pengisian untuk OPD Anda telah berakhir.");
    }
  }

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
  const data = _loadSharedData(getSS());
  return _computeSubKatStats(data.ds, data.dj, data.dv);
}

function getJawabanBySubKategori(subKategori) {
  const data = _loadSharedData(getSS());
  return _computeJawabanBySubKategori(subKategori, data.ds, data.dj, data.dv);
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

/**
 * OPTIMASI: getStats() sekarang membaca semua sheet SEKALI,
 * lalu menghitung subKatStats dan laporan dari data yang sama.
 * Sebelumnya: ~8 sheet reads → Sekarang: ~5 sheet reads.
 */
function getStats() {
  const ss = getSS();
  
  // Baca semua data SEKALI
  const userSheet = ss.getSheetByName("Users");
  const resps = userSheet.getDataRange().getValues().filter(r => r[2] === "Responden").length;
  
  const data = _loadSharedData(ss);
  const settings = _loadFaktorUmumGlobal(ss);

  const listOpd = [...new Set(data.dj.map(r => r[1]))];
  const sudah = listOpd.length;
  
  // Hitung dari shared data (bukan panggil fungsi yang baca sheet lagi)
  const subKatStats = _computeSubKatStats(data.ds, data.dj, data.dv);
  const urusanSudah = subKatStats.filter(s => s.total_jawaban > 0 && s.total_divalidasi >= s.total_jawaban).length;
  
  const laporan = _computeLaporanNilai(data.ds, data.dv, settings.faktorUmumGlobal, settings.excludedBonus);
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
  const data = _loadSharedData(ss);
  const settings = _loadFaktorUmumGlobal(ss);
  return _computeLaporanNilai(data.ds, data.dv, settings.faktorUmumGlobal, settings.excludedBonus);
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
