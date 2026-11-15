function getUsersData(token) {
  requireRole(token, ["Admin"]);
  const users = Firebase.get("users") || {};
  return Object.entries(users).map(([u, v]) => [
    Firebase.unescapeKey(u),
    "", // password (hash) tidak pernah dikembalikan ke client
    v.role || "",
    v.nama_opd || ""
  ]);
}

function tambahUser(token, dataUser) {
  requireRole(token, ["Admin"]);
  try {
    const u = Firebase.escapeKey((dataUser[0] || "").toString().trim());
    if (!u) return { status: "error", message: "Username tidak boleh kosong!" };
    if (Firebase.get(`users/${u}`)) return { status: "error", message: "Username sudah digunakan!" };
    const newUser = {
      role: dataUser[2] || "Responden",
      nama_opd: dataUser[3] || "-"
    };
    _storeUserPassword(newUser, (dataUser[1] !== undefined ? dataUser[1].toString() : ""));
    Firebase.put(`users/${u}`, newUser);
    Firebase.clearMasterOPDCache();
    return { status: "success", message: "User berhasil ditambahkan!" };
  } catch (err) {
    Logger.log("Error tambahUser: " + err.message);
    return { status: "error", message: "Gagal menambahkan user: " + (err.message || err) };
  }
}

function updateUser(token, oldUsername, dataUser) {
  const sess = requireRole(token, ["Admin"]);
  try {
    const oldU = Firebase.escapeKey((oldUsername || "").toString().trim());
    const newU = Firebase.escapeKey((dataUser[0] || "").toString().trim());
    if (!oldU || !newU) return { status: "error", message: "Username tidak valid!" };

    // Baca data lama SEBELUM record dihapus/ditimpa. Sebelumnya data dibaca
    // setelah Firebase.remove(), sehingga password user lama selalu hilang.
    const existingData = Firebase.get(`users/${oldU}`);
    if (!existingData) return { status: "error", message: "User tidak ditemukan!" };
    if (oldU !== newU && Firebase.get(`users/${newU}`)) {
      return { status: "error", message: "Username sudah digunakan!" };
    }

    // Pertahankan seluruh field lama (password/hash/salt) lalu timpa field yang diedit.
    const updatedUser = Object.assign({}, existingData, {
      role: dataUser[2] || "Responden",
      nama_opd: dataUser[3] || "-"
    });
    const newPass = (dataUser[1] !== undefined ? dataUser[1].toString() : "");
    if (newPass !== "") {
      _storeUserPassword(updatedUser, newPass);
    }
    // Jika password tidak diubah, field password/password_hash/salt lama
    // otomatis tetap ada lewat Object.assign di atas.
    // Tulis user baru dulu, baru hapus key lama: kalau penulisan gagal,
    // akun lama tidak ikut hilang.
    Firebase.put(`users/${newU}`, updatedUser);
    if (oldU !== newU) Firebase.remove(`users/${oldU}`);
    Firebase.clearMasterOPDCache();
    return { status: "success", message: "User berhasil diperbarui!" };
  } catch (err) {
    Logger.log("Error updateUser: " + err.message);
    return { status: "error", message: "Gagal memperbarui user: " + (err.message || err) };
  }
}

function hapusUser(token, username) {
  const sess = requireRole(token, ["Admin"]);
  try {
    if (username === sess.username) return { status: "error", message: "Tidak dapat menghapus diri sendiri!" };
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

