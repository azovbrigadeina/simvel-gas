function getFaktorUmum() {
  const props = PropertiesService.getScriptProperties();
  return {
    fu_1_name: props.getProperty('fu_1_name') || 'Ketersediaan Dokumen Perencanaan',
    fu_1_val: parseFloat(props.getProperty('fu_1_val')) || 0,
    fu_2_name: props.getProperty('fu_2_name') || 'Tingkat Kepatuhan Pelaporan',
    fu_2_val: parseFloat(props.getProperty('fu_2_val')) || 0,
    fu_3_name: props.getProperty('fu_3_name') || 'Tindak Lanjut Hasil Evaluasi',
    fu_3_val: parseFloat(props.getProperty('fu_3_val')) || 0,
    excluded_bonus: props.getProperty('excluded_bonus_urusan') || '',
    template_id: props.getProperty('template_id') || '',
    folder_id: props.getProperty('folder_id') || ''
  };
}

function saveFaktorUmum(token, data) {
  requireRole(token, ["Admin"]);
  // OPTIMASI: Batch setProperties — 1 API call daripada 9 terpisah
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'fu_1_name': data.fu_1_name,
    'fu_1_val': data.fu_1_val,
    'fu_2_name': data.fu_2_name,
    'fu_2_val': data.fu_2_val,
    'fu_3_name': data.fu_3_name,
    'fu_3_val': data.fu_3_val,
    'excluded_bonus_urusan': data.excluded_bonus,
    'template_id': data.template_id,
    'folder_id': data.folder_id
  });
  return "Berhasil disimpan";
}

function getDeadlineSettings() {
  const props = PropertiesService.getScriptProperties();
  const deadlineGlobal = props.getProperty('deadline_global') || '';
  const deadlineOpdRaw = props.getProperty('deadline_opd') || '{}';

  // Konversi batas waktu per-OPD ke timestamp UTC di server, supaya countdown
  // di browser tidak bergeser bila timezone perangkat pengguna bukan WIB.
  let opdDeadlines = {};
  try { opdDeadlines = JSON.parse(deadlineOpdRaw); } catch (e) {}
  const deadlineOpdUtc = {};
  Object.keys(opdDeadlines || {}).forEach(function(opd) {
    const t = new Date(opdDeadlines[opd]).getTime();
    if (!isNaN(t)) deadlineOpdUtc[opd] = t;
  });

  return {
    deadline_global: deadlineGlobal,
    deadline_opd: deadlineOpdRaw,
    deadline_opd_utc: deadlineOpdUtc,
    // Timestamp UTC (ms) untuk perhitungan countdown di client yang akurat lintas timezone
    deadline_global_utc: deadlineGlobal ? new Date(deadlineGlobal).getTime() : 0
  };
}

function saveDeadlineSettings(token, data) {
  requireRole(token, ["Admin"]);
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'deadline_global': data.deadline_global,
    'deadline_opd': data.deadline_opd
  });
  return "Pengaturan Waktu Berhasil Disimpan";
}

/**
 * OPTIMASI: Fungsi gabungan untuk menyimpan faktor umum + deadline
 * dalam satu server call (menggantikan 2 call sequential dari client).
 */
function saveAllSettings(token, data, deadlineData) {
  requireRole(token, ["Admin"]);
  saveFaktorUmum(token, data);
  saveDeadlineSettings(token, deadlineData);
  return "Semua pengaturan berhasil disimpan";
}
