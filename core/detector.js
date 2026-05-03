const { record } = require("../cache/store");
const { hashText, hashLink, hashAttachment, extractLinks } = require("./hasher");
const { DUPLICATE_CHANNEL_THRESHOLD, MIN_TEXT_LENGTH, IGNORED_ROLES } = require("../config");

/**
 * Cek apakah user punya role yang di-ignore (admin, mod, dll).
 * Return true kalau user aman dari deteksi.
 */
function isIgnoredUser(message) {
  // Kalau di DM, skip
  if (!message.member) return false;

  const userRoles = message.member.roles.cache;
  return userRoles.some((role) =>
    IGNORED_ROLES.includes(role.name.toLowerCase())
  );
}

/**
 * Periksa apakah sebuah list entries mengandung duplikat cross-channel.
 */
function getUniqueChannels(entries) {
  const seen = new Set(entries.map((e) => e.channelId));
  return [...seen];
}

/**
 * Proses satu "sinyal" (satu hash) dari user.
 * Return detection result kalau spam, atau null kalau aman.
 */
function checkSignal(userId, hash, channelId, channelName, type) {
  const entries = record(userId, hash, channelId, channelName);
  const uniqueChannels = getUniqueChannels(entries);

  if (uniqueChannels.length >= DUPLICATE_CHANNEL_THRESHOLD) {
    return {
      type,       // "text" | "link" | "image"
      hash,
      userId,
      channelCount: uniqueChannels.length,
      channels: entries.map((e) => ({
        id: e.channelId,
        name: e.channelName,
        timestamp: e.timestamp,
      })),
    };
  }

  return null;
}

/**
 * Analisa satu Discord message.
 * Return array detections, atau array kosong kalau aman / di-skip.
 */
function analyzeMessage(message) {
  const detections = [];
  const userId = message.author.id;
  const channelId = message.channel.id;
  const channelName = message.channel.name || channelId;

  // ── Anti False Positive Guards ───────────────────────────

  // 1. Skip user dengan role yang di-ignore (admin, mod, dll)
  if (isIgnoredUser(message)) {
    console.log(`[Aegis] ⏭️  Skip — ${message.author.tag} punya ignored role`);
    return [];
  }

  // ── Analisa Konten ───────────────────────────────────────

  const rawContent = message.content || "";

  // 2. Cek teks — hanya kalau panjangnya cukup (anti false positive pesan pendek)
  if (rawContent.trim().length >= MIN_TEXT_LENGTH) {
    const textHash = hashText(rawContent);
    const result = checkSignal(userId, textHash, channelId, channelName, "text");
    if (result) detections.push(result);
  }

  // 3. Cek setiap link dalam pesan (link selalu di-track tanpa minimum length)
  const links = extractLinks(rawContent);
  for (const link of links) {
    const linkHash = hashLink(link);
    const result = checkSignal(userId, linkHash, channelId, channelName, "link");
    if (result) detections.push({ ...result, link });
  }

  // 4. Cek attachment (gambar, file)
  for (const [, attachment] of message.attachments) {
    const attHash = hashAttachment(attachment);
    const result = checkSignal(userId, attHash, channelId, channelName, "image");
    if (result) detections.push({ ...result, filename: attachment.name });
  }

  return detections;
}

module.exports = { analyzeMessage };