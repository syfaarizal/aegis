module.exports = {
  // ── Detection ───────────────────────────────────────────
  // Window deteksi dalam milidetik
  DETECTION_WINDOW_MS: 15_000,

  // Minimum channel berbeda yang dianggap spam
  DUPLICATE_CHANNEL_THRESHOLD: 2,

  // ── Anti False Positive ─────────────────────────────────
  // Minimum panjang teks yang di-track (abaikan pesan super pendek)
  MIN_TEXT_LENGTH: 10,

  // Abaikan user yang punya role ini (nama role, case-insensitive)
  // NOTE: Semua role di-detect. Timeout immunity berdasarkan Discord permission "Administrator".
  // Admin/mod/staff -> pesan dihapus, TIDAK di-timeout. User biasa -> dihapus + di-timeout.
  IGNORED_ROLES: [],

  // ── Auto Delete ─────────────────────────────────────────
  // Delay antar delete (ms) biar gak kena rate limit Discord
  DELETE_DELAY_MS: 300,

  // ── Timeout ─────────────────────────────────────────────
  // Durasi timeout dalam milidetik (default: 5 menit)
  TIMEOUT_DURATION_MS: 5 * 60 * 1000,

  // Alasan timeout yang muncul di audit log Discord
  TIMEOUT_REASON: "Aegis: Spam terdeteksi — pesan duplikat di multiple channel",

  // ── Credentials ─────────────────────────────────────────
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  BOT_TOKEN: process.env.BOT_TOKEN,

  // ── Guild Config ────────────────────────────────────────
  getGuildConfig(guildId) {
    try {
      const { getGuildConfig: get } = require("./guildConfig");
      return get(guildId);
    } catch {
      return null;
    }
  },
};