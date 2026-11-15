function prosesLogin(username, password) {
  const u = username.trim();
  const p = password.trim();

  try {
    const escapedU = Firebase.escapeKey(u);
    let matchedKey = escapedU;
    let userData = Firebase.get(`users/${escapedU}`);
    if (!userData && u !== u.toLowerCase()) {
      const lowerKey = Firebase.escapeKey(u.toLowerCase());
      userData = Firebase.get(`users/${lowerKey}`);
      if (userData) matchedKey = lowerKey;
    }
    if (userData) {
      // Catat SEBELUM verifikasi: _verifyPassword() menghapus field password/pass
      // saat melakukan upgrade hash, sehingga pengecekan setelahnya selalu false.
      const wasLegacy = (userData.password !== undefined || userData.pass !== undefined);
      if (_verifyPassword(userData, p)) {
        // Simpan upgrade hash password legacy (jika terjadi migrasi)
        try {
          if (wasLegacy) {
            Firebase.put(`users/${matchedKey}`, userData);
          }
        } catch (e) {}

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
        const result = { status: "success", role: role, nama_opd: nama_opd, username: Firebase.unescapeKey(matchedKey), sudahIsi: sudahIsi };
        result.token = _createSession(result);
        return result;
      }
    }
  } catch(e) {
    Logger.log("Autentikasi Firebase error: " + e.message);
  }

  return { status: "error", message: "Username atau Password Salah!" };
}
