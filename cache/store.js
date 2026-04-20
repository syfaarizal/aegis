const { DETECTION_WINDOW_MS } = require("../config");

const store = new Map();

function record(userId, hash, channelId, channelName) {
  const key = `${userId}:${hash}`;
  const now = Date.now();

  // Ambil existing entries dan filter yang sudah expired
  const entries = (store.get(key) || []).filter(
    (e) => now - e.timestamp < DETECTION_WINDOW_MS
  );

  // Tambahkan entry baru ke cache
  entries.push({ channelId, channelName, timestamp: now });
  store.set(key, entries);

  // Auto-cleanup key setelah window habis
  setTimeout(() => {
    const current = store.get(key) || [];
    const fresh = current.filter((e) => Date.now() - e.timestamp < DETECTION_WINDOW_MS);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }, DETECTION_WINDOW_MS);

  return entries;
}

function clearUser(userId) {
  for (const key of store.keys()) {
    if (key.startsWith(`${userId}:`)) store.delete(key);
  }
}

module.exports = { record, clearUser };