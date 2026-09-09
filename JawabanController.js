// ============================================================
// INTERNAL HELPERS — Shared Data Loading & Computation
// ============================================================

/**
 * Memuat data dari 3 sheet utama sekaligus untuk menghindari
 * pembacaan spreadsheet berulang di fungsi-fungsi yang berbeda.
 */
function _loadSharedData(ss) {
  if (!ss) ss = getSS();
  const dsSheet = ss ? ss.getSheetByName("Master_Pertanyaan") : null;
  let ds = [];
  if (dsSheet && dsSheet.getLastRow() > 1) {
    ds = dsSheet.getDataRange().getValues().slice(1);
  }

  if (SETTINGS.USE_FIREBASE) {
    if (ds.length === 0) {
      const masterPertanyaan = Firebase.getCachedMasterPertanyaan();
      Object.entries(masterPertanyaan).forEach(([id, p]) => {
        const sub = p.subkat || p.sub_kategori || (p.urusan && !p.urusan.startsWith("A.") && !p.urusan.startsWith("B.") ? p.urusan : "Umum");
        ds.push([Firebase.unescapeKey(id), p.no || p.kategori_utama || "", sub, p.pertanyaan || "", p.indikator || "", p.data_dukung || "", p.penjelasan || "", p.referensi || "", p.bobot || ""]);
      });
    }

    const jawabanAll = Firebase.get("jawaban") || {};
    const verifikasiAll = Firebase.get("verifikasi") || {};

    const dj = [];
    Object.entries(jawabanAll).forEach(([opd, dataOPD]) => {
      const rawOPD = Firebase.unescapeKey(opd);
      Object.entries(dataOPD || {}).forEach(([id, j]) => {
        dj.push([j.timestamp, rawOPD, Firebase.unescapeKey(id), j.skala_responden, j.link, j.pilihan_teks, j.nama_dokumen, j.sistem_nilai, j.sumber_data, j.penjelasan, j.link_arsip]);
      });
    });

    const dv = [];
    Object.entries(verifikasiAll).forEach(([opd, dataOPD]) => {
      const rawOPD = Firebase.unescapeKey(opd);
      Object.entries(dataOPD || {}).forEach(([id, v]) => {
        dv.push([v.timestamp, rawOPD, Firebase.unescapeKey(id), v.skala_responden, v.skala_evaluator, v.catatan_evaluator]);
      });
    });

    return { ds: ds, dj: dj, dv: dv };
  }

  const djSheet = ss.getSheetByName("Jawaban");
  const vSheet = ss.getSheetByName("Verifikasi");
  
  return {
    ds: ds,
    dj: djSheet && djSheet.getLastRow() > 1 ? djSheet.getDataRange().getValues().slice(1) : [],
    dv: vSheet && vSheet.getLastRow() > 1 ? vSheet.getDataRange().getValues().slice(1) : []
  };
}

/**
 * Memuat pengaturan faktor umum global (dari sheet Pengaturan_Umum)
 * dan daftar urusan yang dikecualikan dari bonus (dari PropertiesService).
 */
/**
 * Memuat pengaturan faktor umum global (dari PropertiesService / sheet Pengaturan_Umum)
 * dan daftar urusan yang dikecualikan dari bonus (dari PropertiesService).
 */
function _loadFaktorUmumGlobal(ss) {
  let faktorUmumGlobal = 0;
  let excludedBonus = [];
  try {
    const props = PropertiesService.getScriptProperties();
    excludedBonus = (props.getProperty('excluded_bonus_urusan') || "").split(",").map(s => s.trim().toLowerCase());

    const fu1 = parseFloat(props.getProperty('fu_1_val')) || 0;
    const fu2 = parseFloat(props.getProperty('fu_2_val')) || 0;
    const fu3 = parseFloat(props.getProperty('fu_3_val')) || 0;
    faktorUmumGlobal = fu1 + fu2 + fu3;

    if (faktorUmumGlobal === 0 && ss) {
      const sheetPengaturan = ss.getSheetByName("Pengaturan_Umum");
      if (sheetPengaturan && sheetPengaturan.getLastRow() > 1) {
        const dataPengaturan = sheetPengaturan.getDataRange().getValues();
        for (let i = 1; i < dataPengaturan.length; i++) {
          faktorUmumGlobal += parseFloat(dataPengaturan[i][2]) || 0;
        }
      }
    }
  } catch(e) {}
  return { faktorUmumGlobal: faktorUmumGlobal, excludedBonus: excludedBonus };
}

/**
 * Komputasi statistik sub-kategori / urusan.
 * Mengabaikan header kategori utama 'A. FAKTOR UMUM' agar daftar urusan murni berdasarkan Urusan Pemerintahan.
 */
function _computeSubKatStats(ds, dj, dv) {
  var stats = {};

  var qIdToSub = {};
  ds.forEach(function(r) {
    var katUtama = r[1] ? r[1].toString().trim() : "";
    var sub = r[2] ? r[2].toString().trim() : "Umum";
    var qId = r[0].toString();
    
    // Jika r[2] masih berisi "A. FAKTOR UMUM" atau "B. FAKTOR TEKNIS", kita lewati atau default ke SubKategori
    if (sub.toUpperCase().startsWith("A. FAKTOR") || sub.toUpperCase().startsWith("B. FAKTOR")) {
      return;
    }

    qIdToSub[qId] = sub;
    if (!stats[sub]) {
      stats[sub] = { nama: sub, total_jawaban: 0, total_divalidasi: 0 };
    }
  });

  var verifSet = {};
  dv.forEach(function(v) {
    verifSet[v[1] + "||" + v[2].toString()] = true;
  });

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
 * Komputasi jawaban per sub-kategori / urusan.
 */
function _computeJawabanBySubKategori(subKategori, ds, dj, dv) {
  var verifMap = {};
  dv.forEach(function(v) {
    verifMap[v[1] + "||" + v[2].toString()] = v;
  });

  var targetNorm = (subKategori || "").toString().trim().toLowerCase();
  var soalTerkait = ds.filter(function(s) {
    var sub = s[2] ? s[2].toString().trim().toLowerCase() : "umum";
    return sub === targetNorm;
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
        timestamp: j[0] || "",
        pilihan_responden: j[5] || "-",
        skala_responden: j[3],
        link: j[4],
        link_arsip: j[10] || "",
        nama_dokumen: j[6] || "-",
        sistem_nilai: j[7] || "-",
        sumber_data: j[8] || "-",
        penjelasan: j[9] || "-",
        skala_evaluator: verif ? verif[4] : "",
        catatan: verif ? verif[5] : ""
      };
    });

    var indikator = soal[4] ? soal[4].toString() : "";
    var data_dukung = soal[5] ? soal[5].toString() : "";
    var penjelasan_soal = soal[6] ? soal[6].toString() : "";

    return {
      id_soal: idSoal,
      pertanyaan: pertanyaan,
      bobot_str: bobot_str,
      indikator: indikator,
      data_dukung: data_dukung,
      penjelasan_soal: penjelasan_soal,
      jawaban_opd: jawabanMapped
    };
  });
}

/**
 * Komputasi laporan nilai dari data yang sudah di-load.
 * Menghitung Total Akhir = (Faktor Umum Global + Faktor Teknis) * Multiplier.
 */
function _computeLaporanNilai(ds, dv, faktorUmumGlobal, excludedBonus) {
  var mapSubKategori = {};
  ds.forEach(function(r) {
    var sub = r[2] ? r[2].toString().trim() : "Umum";
    if (!sub.toUpperCase().startsWith("A. FAKTOR") && !sub.toUpperCase().startsWith("B. FAKTOR")) {
      mapSubKategori[r[0].toString()] = sub;
    }
  });

  var opdScores = {};
  dv.forEach(function(r) {
    var opd = r[1];
    var idSoal = r[2].toString();
    var skorEval = parseFloat(r[4]) || 0;

    var subKat = mapSubKategori[idSoal];
    if (subKat) {
      if (!opdScores[opd]) opdScores[opd] = {};
      if (!opdScores[opd][subKat]) opdScores[opd][subKat] = 0;
      opdScores[opd][subKat] += skorEval;
    }
  });

  var laporan = [];
  for (var opd in opdScores) {
    for (var urusan in opdScores[opd]) {
      var teknis = opdScores[opd][urusan];
      var totalMurni = faktorUmumGlobal + teknis;
      var normUrusan = urusan.toLowerCase().trim();
      var isExcluded = excludedBonus.some(function(ex) {
        var normEx = (ex || "").toString().trim().toLowerCase();
        return normEx !== "" && (normUrusan === normEx || normUrusan.includes(normEx) || normEx.includes(normUrusan));
      });
      var multiplier = isExcluded ? 1.0 : 1.1;
      var totalAkhir = parseFloat((totalMurni * multiplier).toFixed(2));
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

  if (SETTINGS.USE_FIREBASE) {
    const ts = new Date().toISOString();
    const opdEscaped = Firebase.escapeKey(payload.opd);
    const existingJawaban = Firebase.get(`jawaban/${opdEscaped}`) || {};
    const updates = {};
    (payload.jawaban || []).forEach(item => {
      if (!item || item.id === undefined || item.id === null) return;
      const escapedId = Firebase.escapeKey(item.id.toString());
      const prevItem = existingJawaban[escapedId] || {};
      const itemLink = String(item.link || "").trim();
      let linkArsip = prevItem.link_arsip || "";
      if (!linkArsip && itemLink) {
        try {
          linkArsip = snapshotDriveFolder(payload.opd, itemLink) || "";
        } catch (e) {}
      }

      updates[escapedId] = {
        timestamp: ts,
        skala_responden: (item.skala !== "" && item.skala !== undefined && item.skala !== null) ? Number(item.skala) : "",
        link: itemLink,
        link_arsip: linkArsip,
        pilihan_teks: item.pilihan_teks || "",
        nama_dokumen: item.nama_dokumen || "",
        sistem_nilai: item.sistem_nilai !== undefined ? item.sistem_nilai : "-",
        sumber_data: item.sumber_data !== undefined ? item.sumber_data : "-",
        penjelasan: item.penjelasan !== undefined ? item.penjelasan : "-"
      };
    });
    if (Object.keys(updates).length > 0) {
      Firebase.patch(`jawaban/${opdEscaped}`, updates);
    }
    Firebase.remove(`jawaban_draft/${opdEscaped}`);
    return "Berhasil";
  }

  const sheet = getSS().getSheetByName("Jawaban");
  const rows = payload.jawaban.map(item => {
    let linkArsip = snapshotDriveFolder(payload.opd, item.link) || "";
    return [
      new Date(), 
      payload.opd, 
      item.id, 
      item.skala, 
      item.link, 
      item.pilihan_teks,
      item.nama_dokumen,
      item.sistem_nilai || "-",
      item.sumber_data || "-",
      item.penjelasan || "-",
      linkArsip
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return "Berhasil";
}

function getOPDSudahKirim() {
  if (SETTINGS.USE_FIREBASE) {
    const jawabanAll = Firebase.get("jawaban") || {};
    return Object.keys(jawabanAll).map(opd => Firebase.unescapeKey(opd)).sort();
  }

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
  if (SETTINGS.USE_FIREBASE) {
    const ts = new Date().toISOString();
    if (!payload.items || payload.items.length === 0) return "Berhasil";
    
    // Kelompokkan item per-OPD agar verifikasi tersimpan ke node OPD masing-masing
    const opdUpdatesMap = {};
    payload.items.forEach(item => {
      if (!item.opd) return;
      const opdEscaped = Firebase.escapeKey(item.opd);
      if (!opdUpdatesMap[opdEscaped]) {
        opdUpdatesMap[opdEscaped] = {};
      }
      const qIdEscaped = Firebase.escapeKey(item.id_soal.toString());
      opdUpdatesMap[opdEscaped][qIdEscaped] = {
        timestamp: ts,
        skala_responden: item.skala_responden !== "" && item.skala_responden !== null ? Number(item.skala_responden) : "",
        skala_evaluator: item.skala_evaluator !== "" && item.skala_evaluator !== null ? Number(item.skala_evaluator) : "",
        catatan_evaluator: item.catatan || ""
      };
    });

    Object.entries(opdUpdatesMap).forEach(([opdEscaped, updates]) => {
      Firebase.patch(`verifikasi/${opdEscaped}`, updates);
    });

    return "Berhasil";
  }

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
  
  let resps = 0;
  if (SETTINGS.USE_FIREBASE) {
    try {
      const usersData = Firebase.get("users") || {};
      resps = Object.values(usersData).filter(u => u && (u.role === "Responden" || u.role === "responden")).length;
    } catch (e) {
      Logger.log("Gagal membaca users dari Firebase: " + e.message);
    }
  }

  if (resps === 0 && ss) {
    const userSheet = ss.getSheetByName("Users");
    if (userSheet && userSheet.getLastRow() > 1) {
      resps = userSheet.getDataRange().getValues().filter(r => r[2] === "Responden").length;
    }
  }
  
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
  if (SETTINGS.USE_FIREBASE) {
    return getOPDSudahKirim();
  }
  const ss = getSS();
  const jSheet = ss.getSheetByName("Jawaban");
  if (jSheet.getLastRow() < 2) return [];
  const data = jSheet.getRange(2, 2, jSheet.getLastRow() - 1, 1).getValues();
  const opds = [...new Set(data.map(r => r[0].toString().trim()))].filter(o => o !== "");
  return opds.sort();
}

function deleteArchiveFolderByOPD(opdName) {
  try {
    const parentArchive = getOrCreateArchiveParentFolder();
    const cleanOpd = opdName.toString().trim();
    const prefix = `[${cleanOpd}]`;
    const folders = parentArchive.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName().startsWith(prefix)) {
        folder.setTrashed(true);
      }
    }
  } catch (e) {
    Logger.log("Gagal menghapus folder arsip Drive OPD: " + e.toString());
  }
}

function resetJawabanOPD(opdName) {
  // Pindahkan folder snapshot Drive milik OPD ini ke Trash Drive Admin
  deleteArchiveFolderByOPD(opdName);

  if (SETTINGS.USE_FIREBASE) {
    const opd = Firebase.escapeKey(opdName);
    Firebase.remove(`jawaban/${opd}`);
    Firebase.remove(`verifikasi/${opd}`);
    Firebase.remove(`jawaban_draft/${opd}`);
    return "Seluruh data jawaban, draf isian, validasi, dan folder snapshot Drive untuk " + opdName + " berhasil di-reset!";
  }

  const ss = getSS();
  const jSheet = ss.getSheetByName("Jawaban");
  
  if (jSheet.getLastRow() > 1) {
    const jData = jSheet.getDataRange().getValues();
    const newData = jData.filter((row, i) => i === 0 || row[1].toString() !== opdName);
    
    jSheet.clearContents();
    if (newData.length > 0) {
      jSheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
    }
  }
  
  resetValidasiOPD(opdName);
  
  return "Seluruh data jawaban, validasi, dan folder snapshot Drive untuk " + opdName + " berhasil di-reset!";
}

function resetValidasiOPD(opdName) {
  if (SETTINGS.USE_FIREBASE) {
    const opd = Firebase.escapeKey(opdName);
    Firebase.remove(`verifikasi/${opd}`);
    return "Data validasi evaluator untuk " + opdName + " berhasil di-reset!";
  }

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

// ============================================================
// GOOGLE DRIVE SNAPSHOT ENGINE & REFRESH ENDPOINTS
// ============================================================

function parseDriveUrl(url) {
  if (!url) return null;
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return { type: 'FOLDER', id: folderMatch[1] };
  }
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return { type: 'FILE', id: fileMatch[1] };
  }
  return null;
}

function getOrCreateArchiveParentFolder() {
  const folderName = "[SIMVEL] Arsip Bukti Dukung";
  const existingFolders = DriveApp.getFoldersByName(folderName);
  if (existingFolders.hasNext()) {
    return existingFolders.next();
  }
  return DriveApp.createFolder(folderName);
}

function copyFolderRecursive(sourceFolder, targetFolder) {
  const files = sourceFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    file.makeCopy(file.getName(), targetFolder);
  }

  const subfolders = sourceFolder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    const newSubFolder = targetFolder.createFolder(subfolder.getName());
    copyFolderRecursive(subfolder, newSubFolder);
  }
}

function snapshotDriveFolder(opdName, originalDriveUrl) {
  if (!originalDriveUrl) return null;
  const parsed = parseDriveUrl(originalDriveUrl);
  if (!parsed) return null;

  try {
    const parentArchive = getOrCreateArchiveParentFolder();
    const cleanOpd = opdName.toString().trim();

    if (parsed.type === 'FOLDER') {
      try {
        const sourceFolder = DriveApp.getFolderById(parsed.id);
        const originalFolderName = sourceFolder.getName();
        const targetFolderName = `[${cleanOpd}] - ${originalFolderName}`;
        const targetFolder = parentArchive.createFolder(targetFolderName);
        
        copyFolderRecursive(sourceFolder, targetFolder);
        return targetFolder.getUrl();
      } catch (e) {
        parsed.type = 'FILE';
      }
    }

    if (parsed.type === 'FILE') {
      const sourceFile = DriveApp.getFileById(parsed.id);
      const originalFileName = sourceFile.getName();
      
      const targetFolderName = `[${cleanOpd}] - File Bukti Dukung`;
      let targetFolder;
      const existingFolders = parentArchive.getFoldersByName(targetFolderName);
      if (existingFolders.hasNext()) {
        targetFolder = existingFolders.next();
      } else {
        targetFolder = parentArchive.createFolder(targetFolderName);
      }

      const copiedFile = sourceFile.makeCopy(originalFileName, targetFolder);
      return copiedFile.getUrl();
    }

    return null;
  } catch (e) {
    Logger.log("Gagal snapshot Drive item: " + e.toString());
    return null;
  }
}

function resnapshotAllByOPD(opdName) {
  if (!opdName) return { success: false, message: "OPD tidak valid" };

  try {
    let count = 0;
    if (SETTINGS.USE_FIREBASE) {
      const opdEscaped = Firebase.escapeKey(opdName);
      const jawabanOPD = Firebase.get(`jawaban/${opdEscaped}`) || {};
      const updates = {};

      Object.entries(jawabanOPD).forEach(([escapedId, j]) => {
        if (j && j.link) {
          const newArsip = snapshotDriveFolder(opdName, j.link);
          if (newArsip) {
            updates[`${escapedId}/link_arsip`] = newArsip;
            count++;
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        Firebase.patch(`jawaban/${opdEscaped}`, updates);
      }
    } else {
      const ss = getSS();
      const sheet = ss.getSheetByName("Jawaban");
      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][1] === opdName && data[i][4]) {
            const newArsip = snapshotDriveFolder(opdName, data[i][4]);
            if (newArsip) {
              sheet.getRange(i + 1, 11).setValue(newArsip);
              count++;
            }
          }
        }
      }
    }

    return {
      success: true,
      count: count,
      message: `Berhasil memperbarui ${count} snapshot bukti dukung untuk ${opdName}.`
    };
  } catch (e) {
    return { success: false, message: "Gagal refresh snapshot: " + e.message };
  }
}

function resnapshotBySubKategori(subKategori) {
  if (!subKategori) return { success: false, message: "Sub Kategori (Urusan) tidak valid" };

  try {
    const data = _loadSharedData(getSS());
    const soalTerkait = data.ds.filter(s => (s[2] ? s[2].toString().trim() : "Umum") === subKategori);
    const idSoalSet = new Set(soalTerkait.map(s => s[0].toString()));

    const opdSet = new Set();
    data.dj.forEach(j => {
      if (idSoalSet.has(j[2].toString())) {
        opdSet.add(j[1]);
      }
    });

    let totalCount = 0;
    opdSet.forEach(opd => {
      const res = resnapshotAllByOPD(opd);
      if (res.success) totalCount += res.count;
    });

    return {
      success: true,
      count: totalCount,
      message: `Berhasil memperbarui snapshot bukti dukung seluruh OPD pada Urusan "${subKategori}".`
    };
  } catch (e) {
    return { success: false, message: "Gagal refresh snapshot Urusan: " + e.message };
  }
}

function resnapshotAllExistingOPDs() {
  try {
    const listOPD = getOPDSudahKirim();
    let totalCount = 0;
    const results = [];
    listOPD.forEach(opd => {
      const res = resnapshotAllByOPD(opd);
      if (res.success) {
        totalCount += res.count;
        results.push(`${opd}: ${res.count} item`);
      }
    });
    return {
      success: true,
      total: totalCount,
      details: results,
      message: `Selesai memproses snapshot ulang untuk ${listOPD.length} OPD (Total ${totalCount} bukti dukung di-snapshot).`
    };
  } catch (e) {
    return { success: false, message: "Gagal memproses snapshot massal: " + e.message };
  }
}

function simpanDraftJawaban(payload) {
  if (!payload || !payload.opd) return { status: "error", message: "Nama OPD tidak valid" };
  
  if (SETTINGS.USE_FIREBASE) {
    const opdEscaped = Firebase.escapeKey(payload.opd);
    const submitted = Firebase.get(`jawaban/${opdEscaped}`);
    if (submitted && Object.keys(submitted).length > 0) {
      return { status: "error", message: "Formulir terkunci: OPD Anda telah mengirimkan jawaban definitif." };
    }

    const ts = new Date().toISOString();
    const updates = {};
    (payload.jawaban || []).forEach(item => {
      if (item && item.id) {
        const escapedId = Firebase.escapeKey(item.id.toString());
        updates[escapedId] = {
          timestamp: ts,
          skala_responden: item.skala !== undefined ? item.skala : "",
          link: item.link || "",
          pilihan_teks: item.pilihan_teks || "",
          nama_dokumen: item.nama_dokumen || "",
          sistem_nilai: item.sistem_nilai || "",
          sumber_data: item.sumber_data || "",
          penjelasan: item.penjelasan || ""
        };
      }
    });
    if (Object.keys(updates).length > 0) {
      Firebase.patch(`jawaban_draft/${opdEscaped}`, updates);
    }
    return { status: "success", message: "Draf berhasil tersimpan di server" };
  }
  return { status: "success", message: "Draf tersimpan" };
}

function getDraftJawaban(opdName) {
  if (!opdName) return { draft: {}, isSubmitted: false };
  if (SETTINGS.USE_FIREBASE) {
    const opdEscaped = Firebase.escapeKey(opdName);
    const submittedData = Firebase.get(`jawaban/${opdEscaped}`);
    const isSubmitted = !!(submittedData && Object.keys(submittedData).length > 0);

    let draftData = Firebase.get(`jawaban_draft/${opdEscaped}`);
    if (!draftData || Object.keys(draftData).length === 0) {
      draftData = submittedData || {};
    }
    const result = {};
    Object.entries(draftData).forEach(([idEscaped, j]) => {
      const qId = Firebase.unescapeKey(idEscaped);
      result[qId] = {
        id: qId,
        skala: j.skala_responden !== undefined ? j.skala_responden : "",
        link: j.link || "",
        pilihan_teks: j.pilihan_teks || "",
        nama_dokumen: j.nama_dokumen || "",
        sistem_nilai: j.sistem_nilai !== undefined ? j.sistem_nilai : "",
        sumber_data: j.sumber_data !== undefined ? j.sumber_data : "",
        penjelasan: j.penjelasan !== undefined ? j.penjelasan : ""
      };
    });
    return { draft: result, isSubmitted: isSubmitted };
  }

  const sheet = getSS().getSheetByName("Jawaban");
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues().slice(1);
    const opdRows = data.filter(r => r[1].toString() === opdName);
    const isSubmitted = opdRows.length > 0;
    const result = {};
    opdRows.forEach(r => {
      const qId = r[2].toString();
      result[qId] = {
        id: qId,
        skala: r[3],
        link: r[4],
        pilihan_teks: r[5],
        nama_dokumen: r[6],
        sistem_nilai: r[7],
        sumber_data: r[8],
        penjelasan: r[9]
      };
    });
    return { draft: result, isSubmitted: isSubmitted };
  }
  return { draft: {}, isSubmitted: false };
}



