function getUsersData() {
  const sheet = getSS().getSheetByName("Users");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues();
}

function tambahUser(dataUser) {
  const sheet = getSS().getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const isExist = data.some(r => r[0].toString() === dataUser[0]);
  if (isExist) return { status: "error", message: "Username sudah digunakan!" };
  
  sheet.appendRow(dataUser);
  return { status: "success", message: "User berhasil ditambahkan!" };
}

function updateUser(oldUsername, dataUser) {
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
  const sheet = getSS().getSheetByName("Master_OPD");
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return data.map(r => r[0].toString().trim()).filter(opd => opd !== "");
}
