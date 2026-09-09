function prosesLogin(username, password) {
  const u = username.trim(); const p = password.trim();

  if (SETTINGS.USE_FIREBASE) {
    try {
      const escapedU = Firebase.escapeKey(u);
      let userData = Firebase.get(`users/${escapedU}`);
      if (!userData && u !== u.toLowerCase()) {
        userData = Firebase.get(`users/${Firebase.escapeKey(u.toLowerCase())}`);
      }
      if (userData) {
        const dbPass = (userData.password !== undefined ? userData.password : userData.pass);
        const passMatch = (dbPass === p) || (dbPass === "" && (p === "rahasia123" || p === "123"));
        if (passMatch) {
          const role = userData.role;
          const nama_opd = userData.nama_opd;
          let sudahIsi = false;
          if (role === "Responden") {
            try {
              if (nama_opd && nama_opd.toString().trim() !== "") {
                const opdEscaped = Firebase.escapeKey(nama_opd.toString().trim());
                const jawabanOPD = Firebase.get(`jawaban/${opdEscaped}`);
                if (jawabanOPD && Object.keys(jawabanOPD).length > 0) {
                  sudahIsi = true;
                }
              }
            } catch (e) {}
          }
          return { status: "success", role: role, nama_opd: nama_opd, username: u, sudahIsi: sudahIsi };
        }
      }
    } catch(e) {}
  }

  // Fallback ke Google Sheets
  const ss = getSS();
  const userSheet = ss ? ss.getSheetByName("Users") : null;
  if (userSheet && userSheet.getLastRow() >= 2) {
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const uCell = data[i][0] ? data[i][0].toString().trim() : "";
      const pCell = data[i][1] ? data[i][1].toString().trim() : "";
      if (uCell.toLowerCase() === u.toLowerCase() && (pCell === p || (pCell === "" && (p === "rahasia123" || p === "123")))) {
        const role = data[i][2]; 
        const nama_opd = data[i][3];
        let sudahIsi = false;
        
        if (role === "Responden") {
          const js = ss.getSheetByName("Jawaban");
          if(js && js.getLastRow() > 1) {
            const opdCol = js.getRange(2, 2, js.getLastRow() - 1, 1).getValues();
            sudahIsi = opdCol.some(r => r[0] && r[0].toString().trim().toLowerCase() === nama_opd.toString().trim().toLowerCase());
          }
        }
        return { status: "success", role: role, nama_opd: nama_opd, username: data[i][0], sudahIsi: sudahIsi };
      }
    }
  }
  return { status: "error", message: "Username atau Password Salah!" };
}
