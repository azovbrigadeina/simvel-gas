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

function saveFaktorUmum(data) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('fu_1_name', data.fu_1_name);
  props.setProperty('fu_1_val', data.fu_1_val);
  props.setProperty('fu_2_name', data.fu_2_name);
  props.setProperty('fu_2_val', data.fu_2_val);
  props.setProperty('fu_3_name', data.fu_3_name);
  props.setProperty('fu_3_val', data.fu_3_val);
  props.setProperty('excluded_bonus_urusan', data.excluded_bonus);
  props.setProperty('template_id', data.template_id);
  props.setProperty('folder_id', data.folder_id);
  return "Berhasil disimpan";
}
