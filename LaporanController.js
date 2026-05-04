function buatLaporanUrusan(namaUrusan, format) {
  const props = PropertiesService.getScriptProperties();
  const templateId = props.getProperty('template_id');
  const folderId = props.getProperty('folder_id');
  
  if (!templateId || !folderId) {
    throw new Error("ID Template atau ID Folder belum diatur di Pengaturan.");
  }
  
  // Ambil data Global Faktor Umum
  const fuData = getFaktorUmum();
  
  // Ambil rekap laporan untuk mendapatkan Total Nilai
  const laporanFull = getLaporanNilai();
  // Karena laporan per OPD per Urusan, kita perlu merangkum totalnya?
  // User minta 1 laporan per Urusan. Berarti nilai totalnya gimana? 
  // Rata-rata? Atau nilai per OPD? Ini ambigu. Tapi kita akan ambil nilai dari OPD pertama saja untuk header jika perlu, atau kosongkan.
  // Lebih baik kita cari semua OPD yang punya urusan ini.
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
  
  body.replaceText("{{NAMA_URUSAN}}", namaUrusan);
  body.replaceText("{{TANGGAL_CETAK}}", dateStr);
  body.replaceText("{{TOTAL_NILAI_FU}}", avgFU.toString());
  body.replaceText("{{TOTAL_NILAI_FT}}", avgFT.toString());
  body.replaceText("{{TOTAL_AKHIR}}", avgTotal.toString());
  body.replaceText("{{INTENSITAS}}", "-");
  body.replaceText("{{TIPE_PD}}", "-");
  
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
  const semuaJawaban = getJawabanBySubKategori(namaUrusan);
  
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
        newRow.replaceText("{{FT_SKOR}}", ans.skala_evaluator ? ans.skala_evaluator.toString() : "-");
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
    return "https://drive.google.com/uc?export=download&id=" + pdfFile.getId();
  } else {
    // Link export langsung ke format .docx untuk Google Docs
    return "https://docs.google.com/document/d/" + copyDoc.getId() + "/export?format=docx";
  }
}
