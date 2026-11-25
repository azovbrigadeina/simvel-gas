/**
 * Format skor evaluator untuk baris tabel laporan.
 * 0 harus tercetak "0" (penanda Tidak Bisa Dinilai), bukan "-" —
 * cek truthy lama membuat 0 tampil "-" seperti data kosong.
 */
function _formatSkorEval(ans) {
  const v = ans && ans.skala_evaluator;
  return (v === "" || v === null || v === undefined) ? "-" : v.toString();
}

/**
 * Mengambil satu baris laporan gabungan untuk urusan tertentu.
 * Nama urusan dibandingkan setelah spasi dan huruf besar/kecil dinormalkan.
 */
function _cariLaporanUrusan(laporan, namaUrusan) {
  var key = _normalizeUrusanName(namaUrusan).toLowerCase();
  return _aggregateLaporanByUrusan(laporan).filter(function (row) {
    return _normalizeUrusanName(row.urusan).toLowerCase() === key;
  });
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
  const laporanUrusan = _cariLaporanUrusan(laporanFull, namaUrusan);
  
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
  // Satu urusan = satu baris gabungan seluruh OPD yang mengisi urusan ini.
  const header = laporanUrusan[0];
  const avgFU = Number(header.faktor_umum || 0).toFixed(2);
  const avgFT = Number(header.faktor_teknis || 0).toFixed(2);
  const avgTotal = Number(header.total_akhir || 0).toFixed(2);
  
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
 * Satu urusan = satu baris. Bila urusan diisi lebih dari satu OPD, skor teknis
 * seluruh OPD dijumlahkan dan Faktor Umum hanya dihitung sekali, sehingga
 * nilai urusan mencerminkan gabungan seluruh butir pada urusan tersebut.
 */
function _aggregateRekapUrusan(laporan) {
  return _aggregateLaporanByUrusan(laporan).map(function (row) {
    return {
      urusan: row.urusan,
      total_nilai: row.total_akhir,
      intensitas: row.intensitas,
      tipe: row.tipe
    };
  });
}

/**
 * Cetak rekap SEMUA urusan ke satu PDF.
 * PDF dibuat dari Google Doc programatik (bukan template laporan per urusan)
 * agar tidak ada tag template yang bisa bentrok antar urusan.
 */
function buatRekapSemuaUrusanPDF(token) {
  requireRole(token, ["Admin", "Evaluator"]);

  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('folder_id');
  if (!folderId) {
    throw new Error("ID Folder belum diatur di Pengaturan.");
  }

  const sharedData = _loadSharedData();
  const settings = _loadFaktorUmumGlobal();
  const laporan = _computeLaporanNilai(sharedData.ds, sharedData.dv, settings.faktorUmumGlobal, settings.excludedBonus);
  const rekap = _aggregateRekapUrusan(laporan);
  if (!rekap || rekap.length === 0) {
    throw new Error("Tidak ada data untuk direkap.");
  }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm");
  const docName = `Rekap Hasil Penilaian - ${dateStr}`;

  const doc = DocumentApp.create(docName);
  const docId = doc.getId();

  try {
    const body = doc.getBody();
    body.clear();
    body.setPageWidth(595);   // A4 210mm
    body.setPageHeight(842);  // A4 297mm

    const title = body.appendParagraph("REKAPITULASI HASIL PENILAIAN");
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    title.editAsText().setBold(true).setFontSize(14);

    const sub = body.appendParagraph(`Dicetak: ${dateStr} • Jumlah Urusan: ${rekap.length}`);
    sub.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    // appendTableRow() membuat baris TANPA sel; sel harus ditambahkan
    // lewat appendTableCell(). getCell(i) akan null bila sel belum ada.
    const table = body.appendTable();
    const headerCells = ["Urusan", "Total Nilai", "Intensitas & Tipe"];
    const header = table.appendTableRow();
    headerCells.forEach(function (label) {
      const cell = header.appendTableCell(label);
      cell.setBackgroundColor("#E2E8F0");
      cell.editAsText().setBold(true);
    });

    rekap.forEach(function (row) {
      const tr = table.appendTableRow();
      tr.appendTableCell(row.urusan);
      tr.appendTableCell(Number(row.total_nilai).toFixed(2));
      tr.appendTableCell(row.intensitas + " / " + row.tipe);
    });

    doc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName(docName + ".pdf");
    return DriveApp.getFolderById(folderId).createFile(pdfBlob).getUrl();
  } finally {
    // Doc sementara selalu dibersihkan; kegagalan trash tidak boleh
    // membatalkan PDF yang sudah dibuat.
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (e) {}
  }
}

/**
 * Endpoint publik (tanpa login) untuk tombol Informasi Hasil Penilaian di landing.
 * Hasil di-cache singkat agar klik berulang tidak selalu membaca seluruh database.
 */
function getRekapUrusanPublik() {
  var cacheKey = 'simvel_rekap_urusan_publik_v2';
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
