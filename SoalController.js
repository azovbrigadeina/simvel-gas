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

  const namaLower = namaOPD.toString().toLowerCase().trim();

  const filtered = data.filter(r => {
    const target = r[9] ? r[9].toString().toLowerCase().trim() : "";
    if (!target || target === "" || target === "-" || target === "semua" || target === "all") return true;
    return target.includes(namaLower) || namaLower.includes(target) || (namaLower.includes("keuangan") && target.includes("bpkad")) || (namaLower.includes("bpkad") && target.includes("keuangan"));
  });

  return (filtered && filtered.length > 0) ? filtered : data;
}

function updateSoal(id, kolomIdx, nilaiBaru) {
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

function tambahSoal(payload) {
  if (!payload || !payload.kategori || !payload.subKategori || !payload.pertanyaan) {
    throw new Error("Kategori, Sub Kategori, dan Pertanyaan wajib diisi!");
  }

  const idSoal = payload.id ? payload.id.toString().trim() : ("Q" + Date.now());
  const escapedId = Firebase.escapeKey(idSoal);

  const soalObj = {
    no: payload.kategori,
    kategori_utama: payload.kategori,
    urusan: payload.subKategori,
    subkat: payload.subKategori,
    pertanyaan: payload.pertanyaan,
    indikator: payload.indikator || "",
    data_dukung: payload.dataDukung || "",
    penjelasan: payload.penjelasan || "",
    referensi: payload.referensi || "",
    bobot: payload.bobot || "100|80|60|40|20",
    target: payload.targetOPD || ""
  };

  Firebase.put(`master_pertanyaan/${escapedId}`, soalObj);
  Firebase.clearMasterPertanyaanCache();

  return { status: "success", id: idSoal, message: "Soal baru berhasil ditambahkan!" };
}


