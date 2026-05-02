function getPertanyaan(namaOPD) {
  const ss = getSS();
  const sheet = ss.getSheetByName("Master_Pertanyaan");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  // Ubah menjadi 10 kolom (A sampai J) -> index 0 sampai 9
  const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  
  if (!namaOPD) return data; 

  return data.filter(r => {
    // Target OPD sekarang pindah ke Kolom J (Index 9)
    const targetOPD = r[9] ? r[9].toString().toLowerCase() : "";
    return targetOPD === "" || targetOPD.includes(namaOPD.toLowerCase());
  });
}

function updateSoal(id, kolomIdx, nilaiBaru) {
  const sheet = getSS().getSheetByName("Master_Pertanyaan");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      sheet.getRange(i + 1, kolomIdx + 1).setValue(nilaiBaru);
      return "Sukses";
    }
  }
}
