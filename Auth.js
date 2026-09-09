function prosesLogin(username, password) {
  const u = username.trim(); 
  const p = password.trim();

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
  } catch(e) {
    Logger.log("Autentikasi Firebase error: " + e.message);
  }

  return { status: "error", message: "Username atau Password Salah!" };
}

