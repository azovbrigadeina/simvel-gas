const SPREADSHEET_ID = '124y03dq0oSyC576x0oOWh8y97q40Qy6l4XuzqXCtO_o';

const SETTINGS = {
  USE_FIREBASE: true,
  FIREBASE_DB_URL: 'https://simvel-9291b-default-rtdb.firebaseio.com',
  FIREBASE_SECRET: 'NRsngWcl1TKI6LaLDYWiZQw86jIXGxyk7G1yRfWy'
};

function getSS() { 
  return SpreadsheetApp.openById(SPREADSHEET_ID); 
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('SimVel - Bagor Muaro Jambi')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}