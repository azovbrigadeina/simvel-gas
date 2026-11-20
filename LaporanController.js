/**
 * Format skor evaluator untuk baris tabel laporan.
 * 0 harus tercetak "0" (penanda Tidak Bisa Dinilai), bukan "-" —
 * cek truthy lama membuat 0 tampil "-" seperti data kosong.
 */
function _formatSkorEval(ans) {
  const v = ans && ans.skala_evaluator;
  return (v === "" || v === null || v === undefined) ? "-" : v.toString();
}

function buatLaporanUrusan(token, namaUrusan, format) {
  requireRole(token, ["Admin", "Evaluator"]);
  const props = PropertiesService.getScriptProperties();
  const templateId = props.getProperty('template_id');
  const folderId = props.getProperty('folder_id');
  
  if (!templateId || !folderId) {
    throw new Error("ID Template atau ID Folder belum diatur di Pengaturan.");
  }
  
  // Ambil data Global Faktor Umum
  const fuData = getFaktorUmum();
  
  // OPTIMASI: Baca sheet data SEKALI, lalu hitung laporan dan jawaban dari cache
  const sharedData = _loadSharedData();
  const settings = _loadFaktorUmumGlobal();
  
  const laporanFull = _computeLaporanNilai(sharedData.ds, sharedData.dv, settings.faktorUmumGlobal, settings.excludedBonus);
  const laporanUrusan = laporanFull.filter(l => l.urusan === namaUrusan);
  
  // Jika tidak ada data
  if (laporanUrusan.length === 0) {
    throw new Error("Tidak ada data untuk urusan ini.");
  }
  
  // Buat copy dari template
  const fileTemplate = DriveApp.getFileById(templateId);
  const folder = DriveApp.getFolderById(folderId);
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm");
  
  const copyDoc = fileTemplate.makeCopy(`Laporan ${namaUrusan} - ${dateStr}`, folder);
  const docId = copyDoc.getId();
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  
  // --- HEADER TAGS ---
  // Kita ambil total akhir rata-rata atau dari OPD pertama?
  // Karena laporan ditarik per Urusan, tag Header mungkin tidak relevan jika nilainya berbeda per OPD.
  // Kita akan asumsikan tag header menggunakan data rata-rata atau dibiarkan saja.
  let avgFU = 0, avgFT = 0, avgTotal = 0;
  laporanUrusan.forEach(l => {
    avgFU += l.faktor_umum;
    avgFT += l.faktor_teknis;
    avgTotal += l.total_akhir;
  });
  avgFU = (avgFU / laporanUrusan.length).toFixed(2);
  avgFT = (avgFT / laporanUrusan.length).toFixed(2);
  avgTotal = (avgTotal / laporanUrusan.length).toFixed(2);
  
  const ratingInfo = determineRating(parseFloat(avgTotal));
  
  body.replaceText("{{NAMA_URUSAN}}", namaUrusan);
  body.replaceText("{{TANGGAL_CETAK}}", dateStr);
  body.replaceText("{{TOTAL_NILAI_FU}}", avgFU.toString());
  body.replaceText("{{TOTAL_NILAI_FT}}", avgFT.toString());
  body.replaceText("{{TOTAL_AKHIR}}", avgTotal.toString());
  body.replaceText("{{INTENSITAS}}", ratingInfo.intensitas);
  body.replaceText("{{TIPE_PD}}", ratingInfo.tipe);
  
  // --- TABEL 1: FAKTOR UMUM ---
  // Cari baris yang mengandung {{FU_NO}}
  const tables = body.getTables();
  let fuRowTemplate = null;
  let fuTable = null;
  
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      if (row.getText().includes("{{FU_NO}}")) {
        fuRowTemplate = row;
        fuTable = table;
        break;
      }
    }
    if (fuRowTemplate) break;
  }
  
  if (fuRowTemplate && fuTable) {
    const fuList = [
      { no: 1, ind: fuData.fu_1_name, skor: fuData.fu_1_val },
      { no: 2, ind: fuData.fu_2_name, skor: fuData.fu_2_val },
      { no: 3, ind: fuData.fu_3_name, skor: fuData.fu_3_val }
    ];
    
    fuList.forEach(fu => {
      const newRow = fuRowTemplate.copy();
      newRow.replaceText("{{FU_NO}}", fu.no.toString());
      newRow.replaceText("{{FU_INDIKATOR}}", fu.ind);
      newRow.replaceText("{{FU_SKOR}}", fu.skor.toString());
      fuTable.appendTableRow(newRow);
    });
    fuRowTemplate.removeFromParent(); // Hapus template row
  }
  
  // --- TABEL 2: FAKTOR TEKNIS ---
  // OPTIMASI: gunakan sharedData yang sudah di-load di atas
  const semuaJawaban = _computeJawabanBySubKategori(namaUrusan, sharedData.ds, sharedData.dj, sharedData.dv);
  
  let ftRowTemplate = null;
  let ftTable = null;
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      if (row.getText().includes("{{FT_NO}}")) {
        ftRowTemplate = row;
        ftTable = table;
        break;
      }
    }
    if (ftRowTemplate) break;
  }
  
  if (ftRowTemplate && ftTable) {
    let rowIdx = 1;
    semuaJawaban.forEach(soal => {
      soal.jawaban_opd.forEach(ans => {
        const newRow = ftRowTemplate.copy();
        newRow.replaceText("{{FT_NO}}", rowIdx.toString());
        // Tambahkan nama OPD ke Indikator agar jelas ini jawaban siapa
        newRow.replaceText("{{FT_INDIKATOR}}", soal.pertanyaan);
        newRow.replaceText("{{FT_SISTEM_NILAI}}", ans.sistem_nilai || "-");
        newRow.replaceText("{{FT_DATA_DUKUNG}}", ans.nama_dokumen || "-");
        newRow.replaceText("{{FT_SUMBER}}", ans.sumber_data || "-");
        newRow.replaceText("{{FT_PENJELASAN}}", ans.penjelasan || "-");
        newRow.replaceText("{{FT_SKOR}}", _formatSkorEval(ans));
        ftTable.appendTableRow(newRow);
        rowIdx++;
      });
    });
    ftRowTemplate.removeFromParent();
  }
  
  doc.saveAndClose();
  
  // Kembalikan URL untuk download otomatis
  if (format === 'PDF') {
    const pdfBlob = copyDoc.getAs('application/pdf');
    const pdfFile = folder.createFile(pdfBlob);
    copyDoc.setTrashed(true); // Hapus doc sementara jika minta PDF
    // Link download langsung untuk PDF dari Google Drive
    return pdfFile.getUrl();
  } else {
    // Link export langsung ke format .docx untuk Google Docs
    return "https://docs.google.com/document/d/" + copyDoc.getId() + "/export?format=docx";
  }
}

/**
 * Agregasi laporan per urusan.
 * Satu urusan = satu baris. Bila satu OPD menghasilkan beberapa baris karena
 * variasi penulisan nama urusan, baris-baris itu digabung menjadi SATU
 * kontribusi OPD (Faktor Umum dihitung sekali, Faktor Teknis dijumlahkan),
 * lalu Total Nilai urusan = rata-rata kontribusi seluruh OPD. Untuk nama
 * urusan yang seragam, hasilnya sama dengan perhitungan buatLaporanUrusan.
 */
function _aggregateRekapUrusan(laporan) {
  var groups = Object.create(null);
  var rowSeq = 0;

  (laporan || []).forEach(function (row) {
    if (!row || !row.urusan) return;
    var display = row.urusan.toString().replace(/\s+/g, " ").trim();
    if (!display || display.toLowerCase() === "umum") return;

    var urusanKey = display.toLowerCase();
    if (!groups[urusanKey]) {
      groups[urusanKey] = { urusan: display, opds: Object.create(null) };
    }

    var opdKey = row.opd ? row.opd.toString() : ("__row_" + (rowSeq++));
    var opd = groups[urusanKey].opds[opdKey];
    if (!opd) {
      opd = { total: 0, hasTotal: false, extraTeknis: 0, multiplier: 1.0, hasBreakdown: false };
      groups[urusanKey].opds[opdKey] = opd;
    }

    var hasBreakdown = row.faktor_umum !== undefined && row.faktor_teknis !== undefined;
    if (!hasBreakdown) {
      opd.total += parseFloat(row.total_akhir) || 0;
      opd.hasTotal = true;
      return;
    }

    opd.hasBreakdown = true;
    if (!opd.hasTotal) {
      // Baris pertama OPD ini: pakai total_akhir apa adanya agar identik
      // dengan buatLaporanUrusan ketika nama urusan seragam.
      opd.total = parseFloat(row.total_akhir) || 0;
      opd.multiplier = row.bonus_applied === false ? 1.0 : 1.1;
      opd.hasTotal = true;
    } else {
      // Baris varian berikutnya: tambahkan kontribusi teknisnya saja,
      // tanpa menghitung ulang Faktor Umum.
      opd.extraTeknis += parseFloat(row.faktor_teknis) || 0;
    }
  });

  var result = [];
  Object.keys(groups).forEach(function (urusanKey) {
    var g = groups[urusanKey];
    var opdKeys = Object.keys(g.opds);
    var sumTotal = 0;

    opdKeys.forEach(function (opdKey) {
      var opd = g.opds[opdKey];
      if (opd.hasBreakdown) {
        sumTotal += opd.total + (opd.extraTeknis * opd.multiplier);
      } else {
        sumTotal += opd.total;
      }
    });

    var avg = opdKeys.length > 0 ? Number((sumTotal / opdKeys.length).toFixed(2)) : 0;
    var rating = determineRating(avg);
    result.push({
      urusan: g.urusan,
      total_nilai: avg,
      intensitas: rating.intensitas,
      tipe: rating.tipe
    });
  });

  result.sort(function (a, b) { return b.total_nilai - a.total_nilai; });
  return result;
}

/**
 * Endpoint publik (tanpa login) untuk tombol Informasi Hasil Penilaian di landing.
 * Hasil di-cache singkat agar klik berulang tidak selalu membaca seluruh database.
 */
function getRekapUrusanPublik() {
  var cacheKey = 'simvel_rekap_urusan_publik_v1';
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const data = _loadSharedData();
  const settings = _loadFaktorUmumGlobal();
  const laporan = _computeLaporanNilai(data.ds, data.dv, settings.faktorUmumGlobal, settings.excludedBonus);
  var result = _aggregateRekapUrusan(laporan);

  try {
    if (cache) cache.put(cacheKey, JSON.stringify(result), 180);
  } catch (e) {}

  return result;
}
