function getUsersData() {
  if (SETTINGS.USE_FIREBASE) {
    const users = Firebase.get("users") || {};
    return Object.entries(users).map(([u, v]) => [Firebase.unescapeKey(u), v.password, v.role, v.nama_opd]);
  }
  const sheet = getSS().getSheetByName("Users");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues();
}

function tambahUser(dataUser) {
  if (SETTINGS.USE_FIREBASE) {
    const u = Firebase.escapeKey(dataUser[0].toString().trim());
    if (Firebase.get(`users/${u}`)) return { status: "error", message: "Username sudah digunakan!" };
    Firebase.put(`users/${u}`, { password: dataUser[1], role: dataUser[2], nama_opd: dataUser[3] });
    return { status: "success", message: "User berhasil ditambahkan!" };
  }

  const sheet = getSS().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const isExist = data.some(r => r[0].toString() === dataUser[0]);
  if (isExist) return { status: "error", message: "Username sudah digunakan!" };
  
  sheet.appendRow(dataUser);
  return { status: "success", message: "User berhasil ditambahkan!" };
}

function updateUser(oldUsername, dataUser) {
  if (SETTINGS.USE_FIREBASE) {
    const oldU = Firebase.escapeKey(oldUsername.toString().trim());
    const newU = Firebase.escapeKey(dataUser[0].toString().trim());
    if (oldU !== newU) {
      if (Firebase.get(`users/${newU}`)) return { status: "error", message: "Username sudah digunakan!" };
      Firebase.remove(`users/${oldU}`);
    } else {
      if (!Firebase.get(`users/${oldU}`)) return { status: "error", message: "User tidak ditemukan!" };
    }
    Firebase.put(`users/${newU}`, { password: dataUser[1], role: dataUser[2], nama_opd: dataUser[3] });
    return { status: "success", message: "User berhasil diperbarui!" };
  }

  const sheet = getSS().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === oldUsername) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([dataUser]);
      return { status: "success", message: "User berhasil diperbarui!" };
    }
  }
  return { status: "error", message: "User tidak ditemukan!" };
}

function hapusUser(username) {
  if (SETTINGS.USE_FIREBASE) {
    const u = Firebase.escapeKey(username.toString().trim());
    if (!Firebase.get(`users/${u}`)) return { status: "error", message: "User tidak ditemukan!" };
    Firebase.remove(`users/${u}`);
    return { status: "success", message: "User berhasil dihapus!" };
  }

  const sheet = getSS().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === username) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "User berhasil dihapus!" };
    }
  }
  return { status: "error", message: "User tidak ditemukan!" };
}

function getMasterOPDList() {
  if (SETTINGS.USE_FIREBASE) {
    return Firebase.getCachedMasterOPD() || [];
  }
  const sheet = getSS().getSheetByName("Master_OPD");
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return data.map(r => r[0].toString().trim()).filter(opd => opd !== "");
}
