function prosesLogin(username, password) {
  const ss = getSS();
  const userSheet = ss.getSheetByName("Users");
  const data = userSheet.getDataRange().getValues();
  const u = username.trim(); const p = password.trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === u && data[i][1].toString() === p) {
      const role = data[i][2]; 
      const nama_opd = data[i][3];
      let sudahIsi = false;
      
      if (role === "Responden") {
        const js = ss.getSheetByName("Jawaban");
        if(js.getLastRow() > 1) {
          sudahIsi = js.getDataRange().getValues().some(r => r[1] === nama_opd);
        }
      }
      return { status: "success", role: role, nama_opd: nama_opd, username: data[i][0], sudahIsi: sudahIsi };
    }
  }
  return { status: "error", message: "Username atau Password Salah!" };
}
