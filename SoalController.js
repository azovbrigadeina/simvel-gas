// Normalisasi nama OPD: rapikan spasi ganda, trim, dan lowercase.
// Dipakai bersama oleh getPertanyaan() dan validasi simpan jawaban agar
// aturan "soal ini milik OPD mana" konsisten di seluruh aplikasi.
function _normOpdName(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Cek apakah sebuah soal berlaku untuk OPD tertentu.
 * Target kosong / "-" / "semua" / "all" = berlaku untuk semua OPD.
 * Selain itu harus cocok EXACT (bukan substring) agar "Kecamatan Kumpeh"
 * tidak ikut mengambil soal "Kecamatan Kumpeh Ulu".
 */
function _isSoalTargetForOpd(soal, namaOPD) {
  const target = _normOpdName(soal && (soal.target || soal.target_opd));
  if (!target || target === "-" || target === "semua" || target === "all") return true;
  const namaNorm = _normOpdName(namaOPD);
  return target === namaNorm
    || (namaNorm.includes("keuangan") && target.includes("bpkad"))
    || (namaNorm.includes("bpkad") && target.includes("keuangan"));
}

function getPertanyaan(namaOPD) {
  let data = [];

  try {
    const masterPertanyaan = Firebase.getCachedMasterPertanyaan() || {};
    
    Object.entries(masterPertanyaan).forEach(([idEsc, p]) => {
      const idSoal = Firebase.unescapeKey(idEsc);
      const katUtama = p.kategori_utama || p.no || "";
      const sub = p.subkat || p.urusan || "Umum";
      const pert = p.pertanyaan || "";
      const ind = p.indikator || "";
      const dd = p.data_dukung || "";
      const pen = p.penjelasan || "";
      const ref = p.referensi || "";
      const bbt = p.bobot !== undefined ? p.bobot.toString() : "100|80|60|40|20";
      const tgt = p.target || p.target_opd || "";

      data.push([idSoal, katUtama, sub, pert, ind, dd, pen, ref, bbt, tgt]);
    });
  } catch (e) {
    Logger.log("Gagal mengambil master pertanyaan dari Firebase: " + e.message);
  }

  // Urutkan data secara alami (Natural Sort: P1, P2... P9, P10, P100) berdasarkan ID Soal
  data.sort((a, b) => {
    const idA = (a[0] || "").toString();
    const idB = (b[0] || "").toString();
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
  });

  if (!namaOPD) return data;

  const namaNorm = _normOpdName(namaOPD);
  const filtered = data.filter(r => {
    const target = _normOpdName(r[9]);
    if (!target || target === "-" || target === "semua" || target === "all") return true;
    return target === namaNorm
      || (namaNorm.includes("keuangan") && target.includes("bpkad"))
      || (namaNorm.includes("bpkad") && target.includes("keuangan"));
  });

  // Jangan fallback ke SELURUH bank soal ketika tidak ada yang cocok:
  // itu membuat responden bisa melihat/mengisi soal milik OPD lain.
  return filtered;
}

/**
 * Validasi format bobot nilai soal.
 * Format wajib 5 angka positif dipisah "|" (satu per pilihan A-E).
 * Nilai 0 dilarang karena 0 di skala evaluator dipakai sebagai penanda
 * "Tidak Bisa Dinilai" (lihat simpanVerifikasi).
 * Mengembalikan string ternormalisasi, atau melempar Error bila tidak valid.
 */
function _validateBobot(bobot) {
  const raw = (bobot === undefined || bobot === null) ? "" : bobot.toString();
  const parts = raw.split("|").map(function (p) { return p.trim(); });

  if (parts.length !== 5) {
    throw new Error("Bobot harus terdiri dari 5 nilai (A|B|C|D|E), dipisah tanda '|'. Nilai diterima: '" + raw + "'.");
  }

  for (let i = 0; i < parts.length; i++) {
    if (!/^\d+$/.test(parts[i])) {
      throw new Error("Setiap nilai bobot harus berupa angka bulat positif. Nilai tidak valid: '" + parts[i] + "'.");
    }
  }

  const nums = parts.map(Number);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] <= 0) {
      throw new Error("Bobot setiap pilihan harus lebih dari 0 (nilai 0 khusus untuk 'Tidak Bisa Dinilai').");
    }
  }

  return nums.join("|");
}

function updateSoal(token, id, kolomIdx, nilaiBaru) {
  requireRole(token, ["Admin"]);
  // Validasi bobot di luar try agar pesan error naik ke client,
  // bukan tertelan oleh catch Firebase di bawah.
  if (kolomIdx === 8) {
    nilaiBaru = _validateBobot(nilaiBaru);
  }
  try {
    const escapedId = Firebase.escapeKey(id.toString());
    const existing = Firebase.get(`master_pertanyaan/${escapedId}`) || {};
    
    // Pemetaan kolomIdx ke properti Firebase
    const propMap = {
      1: "kategori_utama",
      2: "subkat",
      3: "pertanyaan",
      4: "indikator",
      5: "data_dukung",
      6: "penjelasan",
      7: "referensi",
      8: "bobot",
      9: "target"
    };

    const propName = propMap[kolomIdx];
    if (propName) {
      if (propName === "subkat" || propName === "target") {
        nilaiBaru = (nilaiBaru === undefined || nilaiBaru === null ? "" : nilaiBaru.toString()).replace(/\s+/g, " ").trim();
      }
      existing[propName] = nilaiBaru;
      if (propName === "kategori_utama") existing["no"] = nilaiBaru;
      if (propName === "subkat") existing["urusan"] = nilaiBaru;
      Firebase.put(`master_pertanyaan/${escapedId}`, existing);
      Firebase.clearMasterPertanyaanCache();
    }
  } catch (e) {
    Logger.log("Gagal memperbarui soal di Firebase: " + e.message);
  }

  return "Sukses";
}

function tambahSoal(token, payload) {
  requireRole(token, ["Admin"]);
  if (!payload || !payload.kategori || !payload.subKategori || !payload.pertanyaan) {
    throw new Error("Kategori, Sub Kategori, dan Pertanyaan wajib diisi!");
  }

  const idSoal = payload.id ? payload.id.toString().trim() : ("Q" + Date.now());
  const escapedId = Firebase.escapeKey(idSoal);

  // Mode edit dipakai oleh modal "Edit Soal". Pada mode ini field yang tidak
  // dikirim client (data_dukung, penjelasan, referensi) harus dipertahankan.
  const existing = Firebase.get(`master_pertanyaan/${escapedId}`) || {};
  const isEdit = payload.mode === "edit";
  if (!isEdit && Object.keys(existing).length > 0) {
    throw new Error("ID soal '" + idSoal + "' sudah digunakan. Gunakan ID lain.");
  }

  const soalObj = Object.assign({}, existing, {
    no: payload.kategori,
    kategori_utama: payload.kategori,
    urusan: payload.subKategori.toString().replace(/\s+/g, " ").trim(),
    subkat: payload.subKategori.toString().replace(/\s+/g, " ").trim(),
    pertanyaan: payload.pertanyaan,
    indikator: payload.indikator || "",
    bobot: _validateBobot(payload.bobot || "100|80|60|40|20"),
    target: (payload.targetOPD || "").toString().replace(/\s+/g, " ").trim()
  });

  // Hanya timpa field pelengkap bila client benar-benar mengirimkannya.
  if (payload.dataDukung !== undefined) soalObj.data_dukung = payload.dataDukung;
  if (payload.penjelasan !== undefined) soalObj.penjelasan = payload.penjelasan;
  if (payload.referensi !== undefined) soalObj.referensi = payload.referensi;

  Firebase.put(`master_pertanyaan/${escapedId}`, soalObj);
  Firebase.clearMasterPertanyaanCache();

  return { status: "success", id: idSoal, message: "Soal berhasil disimpan!" };
}

function hapusSoal(token, id) {
  requireRole(token, ["Admin"]);
  if (!id) throw new Error("ID Soal tidak valid!");
  try {
    const escapedId = Firebase.escapeKey(id.toString());
    Firebase.remove(`master_pertanyaan/${escapedId}`);
    Firebase.clearMasterPertanyaanCache();
    return { status: "success", message: "Soal berhasil dihapus!" };
  } catch (e) {
    Logger.log("Gagal menghapus soal di Firebase: " + e.message);
    throw new Error("Gagal menghapus soal: " + e.message);
  }
}


