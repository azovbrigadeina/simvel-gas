const SPREADSHEET_ID = '124y03dq0oSyC576x0oOWh8y97q40Qy6l4XuzqXCtO_o';

const SETTINGS = {
  USE_FIREBASE: true,
  FIREBASE_DB_URL: 'https://simvel-9291b-default-rtdb.asia-southeast1.firebasedatabase.app'
};

function getFirebaseSecret() {
  return PropertiesService.getScriptProperties().getProperty('FIREBASE_SECRET') || '';
}

function getSS() { 
  return SpreadsheetApp.openById(SPREADSHEET_ID); 
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  const isModern = e && e.parameter && (e.parameter.ui === 'modern' || e.parameter.v === 'modern');
  const templateName = isModern ? 'Index_Modern' : 'Index';
  return HtmlService.createTemplateFromFile(templateName).evaluate()
      .setTitle('SimVel - Bagor Muaro Jambi' + (isModern ? ' (Modern UI)' : ''))
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Membuat menu kustom di Google Sheets saat dokumen dibuka.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('[ Database Sync ]')
      .addItem('Push: Sync Sheets ke Firebase', 'syncSheetsToFirebaseInteractive')
      .addItem('Pull: Tarik Data Firebase ke Sheets', 'pullFirebaseToSheetsInteractive')
      .addToUi();
  } catch (e) {
    Logger.log("Bukan dijalankan dari konteks Spreadsheet: " + e.message);
  }
}

// Jalankan SEKALI untuk menyimpan Firebase secret ke Script Properties,
// lalu hapus fungsi ini dari editor.
function setSecretSekali() {
  PropertiesService.getScriptProperties()
    .setProperty('FIREBASE_SECRET', 'NRsngWcl1TKI6LaLDYWiZQw86jIXGxyk7G1yRfWy');
  Logger.log("Secret tersimpan: " + (PropertiesService.getScriptProperties().getProperty('FIREBASE_SECRET') ? "OK" : "GAGAL"));
}