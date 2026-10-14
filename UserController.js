function getUsersData() {
  const users = Firebase.get("users") || {};
  return Object.entries(users).map(([u, v]) => [
    Firebase.unescapeKey(u), 
    v.password !== undefined ? v.password : (v.pass || ""), 
    v.role || "", 
    v.nama_opd || ""
  ]);
}

function tambahUser(dataUser) {
  try {
    const u = Firebase.escapeKey((dataUser[0] || "").toString().trim());
    if (!u) return { status: "error", message: "Username tidak boleh kosong!" };
    if (Firebase.get(`users/${u}`)) return { status: "error", message: "Username sudah digunakan!" };
    Firebase.put(`users/${u}`, { 
      password: dataUser[1] !== undefined ? dataUser[1].toString() : "", 
      role: dataUser[2] || "Responden", 
      nama_opd: dataUser[3] || "-" 
    });
    Firebase.clearMasterOPDCache();
    return { status: "success", message: "User berhasil ditambahkan!" };
  } catch (err) {
    Logger.log("Error tambahUser: " + err.message);
    return { status: "error", message: "Gagal menambahkan user: " + (err.message || err) };
  }
}

function updateUser(oldUsername, dataUser) {
  try {
    const oldU = Firebase.escapeKey((oldUsername || "").toString().trim());
    const newU = Firebase.escapeKey((dataUser[0] || "").toString().trim());
    if (!oldU || !newU) return { status: "error", message: "Username tidak valid!" };

    if (oldU !== newU) {
      if (Firebase.get(`users/${newU}`)) return { status: "error", message: "Username sudah digunakan!" };
      Firebase.remove(`users/${oldU}`);
    } else {
      if (!Firebase.get(`users/${oldU}`)) return { status: "error", message: "User tidak ditemukan!" };
    }
    Firebase.put(`users/${newU}`, { 
      password: dataUser[1] !== undefined ? dataUser[1].toString() : "", 
      role: dataUser[2] || "Responden", 
      nama_opd: dataUser[3] || "-" 
    });
    Firebase.clearMasterOPDCache();
    return { status: "success", message: "User berhasil diperbarui!" };
  } catch (err) {
    Logger.log("Error updateUser: " + err.message);
    return { status: "error", message: "Gagal memperbarui user: " + (err.message || err) };
  }
}

function hapusUser(username) {
  try {
    const u = Firebase.escapeKey((username || "").toString().trim());
    if (!u) return { status: "error", message: "Username tidak valid!" };
    if (!Firebase.get(`users/${u}`)) return { status: "error", message: "User tidak ditemukan!" };
    Firebase.remove(`users/${u}`);
    Firebase.clearMasterOPDCache();
    return { status: "success", message: "User berhasil dihapus!" };
  } catch (err) {
    Logger.log("Error hapusUser: " + err.message);
    return { status: "error", message: "Gagal menghapus user: " + (err.message || err) };
  }
}

function getMasterOPDList() {
  return Firebase.getCachedMasterOPD() || [];
}

