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
  const u = Firebase.escapeKey(dataUser[0].toString().trim());
  if (Firebase.get(`users/${u}`)) return { status: "error", message: "Username sudah digunakan!" };
  Firebase.put(`users/${u}`, { password: dataUser[1], role: dataUser[2], nama_opd: dataUser[3] });
  Firebase.clearMasterOPDCache();
  return { status: "success", message: "User berhasil ditambahkan!" };
}

function updateUser(oldUsername, dataUser) {
  const oldU = Firebase.escapeKey(oldUsername.toString().trim());
  const newU = Firebase.escapeKey(dataUser[0].toString().trim());
  if (oldU !== newU) {
    if (Firebase.get(`users/${newU}`)) return { status: "error", message: "Username sudah digunakan!" };
    Firebase.remove(`users/${oldU}`);
  } else {
    if (!Firebase.get(`users/${oldU}`)) return { status: "error", message: "User tidak ditemukan!" };
  }
  Firebase.put(`users/${newU}`, { password: dataUser[1], role: dataUser[2], nama_opd: dataUser[3] });
  Firebase.clearMasterOPDCache();
  return { status: "success", message: "User berhasil diperbarui!" };
}

function hapusUser(username) {
  const u = Firebase.escapeKey(username.toString().trim());
  if (!Firebase.get(`users/${u}`)) return { status: "error", message: "User tidak ditemukan!" };
  Firebase.remove(`users/${u}`);
  Firebase.clearMasterOPDCache();
  return { status: "success", message: "User berhasil dihapus!" };
}

function getMasterOPDList() {
  return Firebase.getCachedMasterOPD() || [];
}

