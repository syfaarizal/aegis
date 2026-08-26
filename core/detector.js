const { record } = require("../cache/store");
const { hashText, hashLink, hashAttachment, extractLinks } = require("./hasher");
const config = require("../config");

/**
 * Cek apakah user punya role yang di-ignore (admin, mod, dll).
 */
function isIgnoredUser(message, ignoredRoles) {
  if (!message.member) return false;
  return message.member.roles.cache.some((role) =>
    ignoredRoles.includes(role.name.toLowerCase())
  );
}

/**
 * Periksa duplikat cross-channel dari entries.
 */
function getUniqueChannels(entries) {
  return [...new Set(entries.map((e) => e.channelId))];
}

/**
 * Proses satu sinyal hash. Return detection atau null.
 */
function checkSignal(guildId, userId, hash, channelId, channelName, type, threshold) {
  const entries = record(guildId, userId, hash, channelId, channelName);
  const uniqueChannels = getUniqueChannels(entries);

  if (uniqueChannels.length >= threshold) {
    return {
      type,
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
 * Return array detections — deduplicated, link tidak double-count sebagai teks.
 */
function analyzeMessage(message) {
  const detections = [];
  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;
  const channelName = message.channel.name || channelId;

  // Per-guild config override
  const guildCfg = config.getGuildConfig(guildId);

  // Jika guild punya config dan enabled=false, skip semua deteksi
  if (guildCfg && !guildCfg.enabled) {
    return [];
  }

  const ignoredRoles = guildCfg ? guildCfg.ignoredRoles : config.IGNORED_ROLES;
  const minTextLength = guildCfg ? guildCfg.minTextLength : config.MIN_TEXT_LENGTH;
  const threshold = guildCfg ? guildCfg.duplicateChannelThreshold : config.DUPLICATE_CHANNEL_THRESHOLD;

  // ── Anti False Positive ──────────────────────────────────
  if (isIgnoredUser(message, ignoredRoles)) {
    console.log(`[Aegis] ⏭️  Skip — ${message.author.tag} punya ignored role`);
    return [];
  }

  const rawContent = message.content || "";

  // ── 1. Cek Link dulu (sebelum teks) ─────────────────────
  // Link selalu di-track terlepas dari panjang teks
  const links = extractLinks(rawContent);
  for (const link of links) {
    const linkHash = hashLink(link);
    const result = checkSignal(guildId, userId, linkHash, channelId, channelName, "link", threshold);
    if (result) detections.push({ ...result, link });
  }

  // ── 2. Cek Teks — strip URL dulu biar gak double count ───
  // "cek ini https://spam.com bro" → hash "cek ini  bro" (link dipisah)
  const textOnly = rawContent.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, "").trim();
  if (textOnly.length >= minTextLength) {
    const textHash = hashText(textOnly);
    const result = checkSignal(guildId, userId, textHash, channelId, channelName, "text", threshold);
    if (result) detections.push(result);
  }

  // ── 3. Cek Attachment ────────────────────────────────────
  for (const [, attachment] of message.attachments) {
    const attHash = hashAttachment(attachment);
    const result = checkSignal(guildId, userId, attHash, channelId, channelName, "image", threshold);
    if (result) detections.push({ ...result, filename: attachment.name });
  }

  // Deduplicate berdasarkan hash (kalau teks + link overlap)
  const seen = new Set();
  return detections.filter((d) => {
    if (seen.has(d.hash)) return false;
    seen.add(d.hash);
    return true;
  });
}

module.exports = { analyzeMessage };