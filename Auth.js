function prosesLogin(username, password) {
  const u = username.trim(); const p = password.trim();

  if (SETTINGS.USE_FIREBASE) {
    try {
      const escapedU = Firebase.escapeKey(u);
      const userData = Firebase.get(`users/${escapedU}`);
      if (userData && userData.password === p) {
        const role = userData.role;
        const nama_opd = userData.nama_opd;
        
        let sudahIsi = false;
        if (role === "Responden") {
          const escapedOPD = Firebase.escapeKey(nama_opd);
          const jawabanOPD = Firebase.get(`jawaban/${escapedOPD}`);
          sudahIsi = (jawabanOPD && Object.keys(jawabanOPD).length > 0);
        }

        return { 
          status: "success", 
          role: role, 
          nama_opd: nama_opd, 
          username: u,
          sudahIsi: sudahIsi
        };
      }
      return { status: "error", message: "Username atau Password Salah!" };
    } catch(e) {
      return { status: "error", message: "Koneksi Firebase Gagal: " + e.toString() };
    }
  }

  // Fallback ke Google Sheets
  const ss = getSS();
  const userSheet = ss.getSheetByName("Users");
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === u && data[i][1].toString() === p) {
      const role = data[i][2]; 
      const nama_opd = data[i][3];
      let sudahIsi = false;
      
      if (role === "Responden") {
        const js = ss.getSheetByName("Jawaban");
        if(js.getLastRow() > 1) {
          // Optimasi: baca hanya kolom B (OPD) daripada seluruh sheet
          const opdCol = js.getRange(2, 2, js.getLastRow() - 1, 1).getValues();
          sudahIsi = opdCol.some(r => r[0] === nama_opd);
        }
      }
      return { status: "success", role: role, nama_opd: nama_opd, username: data[i][0], sudahIsi: sudahIsi };
    }
  }
  return { status: "error", message: "Username atau Password Salah!" };
}
