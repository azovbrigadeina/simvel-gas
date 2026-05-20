/**
 * Firebase Realtime Database REST API Client for Google Apps Script
 */
const Firebase = {
  escapeKey: function(key) {
    if (!key) return "";
    return key.toString()
              .replace(/%/g, '%25')
              .replace(/\./g, '%2E')
              .replace(/#/g, '%23')
              .replace(/\$/g, '%24')
              .replace(/\[/g, '%5B')
              .replace(/\]/g, '%5D')
              .replace(/\//g, '%2F');
  },

  unescapeKey: function(key) {
    if (!key) return "";
    return key.toString()
              .replace(/%2F/g, '/')
              .replace(/%5D/g, ']')
              .replace(/%5B/g, '[')
              .replace(/%24/g, '$')
              .replace(/%23/g, '#')
              .replace(/%2E/g, '.')
              .replace(/%25/g, '%');
  },

  getDbUrl: function() {
    return (SETTINGS.FIREBASE_DB_URL || "").replace(/\/$/, "");
  },

  getSecret: function() {
    return SETTINGS.FIREBASE_SECRET || "";
  },

  get: function(path) {
    const dbUrl = this.getDbUrl();
    const secret = this.getSecret();
    if (!dbUrl) throw new Error("Firebase Database URL belum dikonfigurasi.");

    const url = `${dbUrl}/${path}.json${secret ? '?auth=' + secret : ''}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase GET Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }
    return JSON.parse(response.getContentText());
  },

  put: function(path, data) {
    const dbUrl = this.getDbUrl();
    const secret = this.getSecret();
    if (!dbUrl) throw new Error("Firebase Database URL belum dikonfigurasi.");

    const url = `${dbUrl}/${path}.json${secret ? '?auth=' + secret : ''}`;
    const options = {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase PUT Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }
    return JSON.parse(response.getContentText());
  },

  patch: function(path, data) {
    const dbUrl = this.getDbUrl();
    const secret = this.getSecret();
    if (!dbUrl) throw new Error("Firebase Database URL belum dikonfigurasi.");

    const url = `${dbUrl}/${path}.json${secret ? '?auth=' + secret : ''}`;
    const options = {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase PATCH Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }
    return JSON.parse(response.getContentText());
  },

  post: function(path, data) {
    const dbUrl = this.getDbUrl();
    const secret = this.getSecret();
    if (!dbUrl) throw new Error("Firebase Database URL belum dikonfigurasi.");

    const url = `${dbUrl}/${path}.json${secret ? '?auth=' + secret : ''}`;
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase POST Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }
    return JSON.parse(response.getContentText());
  },

  remove: function(path) {
    const dbUrl = this.getDbUrl();
    const secret = this.getSecret();
    if (!dbUrl) throw new Error("Firebase Database URL belum dikonfigurasi.");

    const url = `${dbUrl}/${path}.json${secret ? '?auth=' + secret : ''}`;
    const options = {
      method: 'delete',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase DELETE Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }
    return true;
  },

  getCachedMasterPertanyaan: function() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("simvel_master_pertanyaan");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    const pert = this.get("master_pertanyaan") || {};
    try {
      cache.put("simvel_master_pertanyaan", JSON.stringify(pert), 1800); // 30 menit
    } catch (e) {}
    return pert;
  },

  clearMasterPertanyaanCache: function() {
    CacheService.getScriptCache().remove("simvel_master_pertanyaan");
  },

  getCachedMasterOPD: function() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("simvel_master_opd");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    const opd = this.get("master_opd") || [];
    try {
      cache.put("simvel_master_opd", JSON.stringify(opd), 1800); // 30 menit
    } catch (e) {}
    return opd;
  },

  clearMasterOPDCache: function() {
    CacheService.getScriptCache().remove("simvel_master_opd");
  }
};
