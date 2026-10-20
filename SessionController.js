/**
 * Server-side session & authorization helpers.
 * Session token disimpan di CacheService (6 jam), role diverifikasi
 * di setiap fungsi server yang sensitif.
 */

const SESSION_TTL_SECONDS = 6 * 60 * 60;

function _hashPassword(password, salt) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (salt || '') + ':' + (password || ''),
    Utilities.Charset.UTF_8
  );
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Membuat/menambahkan user dengan hash password.
 * Password lama yang masih plaintext akan otomatis di-hash saat user login.
 */
function _storeUserPassword(userData, plainPassword) {
  const salt = Utilities.getUuid();
  userData.salt = salt;
  userData.password_hash = _hashPassword(plainPassword, salt);
  delete userData.password;
  delete userData.pass;
}

function _verifyPassword(userData, plainPassword) {
  if (userData.password_hash && userData.salt) {
    return userData.password_hash === _hashPassword(plainPassword, userData.salt);
  }
  // Migrasi: password legacy plaintext — cocokkan lalu upgrade ke hash
  const legacy = (userData.password !== undefined ? userData.password : userData.pass);
  if (legacy !== undefined && legacy === plainPassword) {
    _storeUserPassword(userData, plainPassword);
    return true;
  }
  return false;
}

function _createSession(loginResult) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    'simvel_sess_' + token,
    JSON.stringify({ username: loginResult.username, role: loginResult.role, nama_opd: loginResult.nama_opd }),
    SESSION_TTL_SECONDS
  );
  return token;
}

function _getSession() {
  return null; // diganti _getSessionFromToken(token)
}

function logout(token) {
  _destroySession(token);
  return "OK";
}

function _getSessionFromToken(token) {
  if (!token) return null;
  try {
    const raw = CacheService.getScriptCache().get('simvel_sess_' + token);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _refreshSession(token) {
  if (!token) return;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('simvel_sess_' + token);
  if (raw) cache.put('simvel_sess_' + token, raw, SESSION_TTL_SECONDS);
}

function _destroySession(token) {
  if (token) CacheService.getScriptCache().remove('simvel_sess_' + token);
}

/**
 * Guard otorisasi. Lempar error jika token tidak valid atau role tidak sesuai.
 * @param {string} token - session token dari client
 * @param {string[]} allowedRoles - daftar role yang diizinkan
 */
function requireRole(token, allowedRoles) {
  const sess = _getSessionFromToken(token);
  if (!sess) {
    throw new Error('Sesi tidak valid atau telah berakhir. Silakan login ulang.');
  }
  if (allowedRoles && allowedRoles.length > 0 && allowedRoles.indexOf(sess.role) === -1) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk aksi ini.');
  }
  _refreshSession(token);
  return sess;
}
