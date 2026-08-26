const { DELETE_DELAY_MS, TIMEOUT_DURATION_MS, TIMEOUT_REASON } = require("../config");
const { getGuildConfig } = require("../guildConfig");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Kumpulkan semua pesan spam dari channels yang terdampak.
 * Return array of Discord Message objects (deduplicated by message ID).
 */
async function collectSpamMessages(guild, detection, triggerMessage) {
  const collected = new Map(); // messageId → Message (biar gak dobel)
  const userId = detection.userId;

  // Masukkan trigger message dulu
  collected.set(triggerMessage.id, triggerMessage);

  // Deduplicate channel IDs dari detection — channel bisa muncul >1x di entries
  const uniqueChannelIds = [...new Set(detection.channels.map((c) => c.id))];
  console.log(`[Aegis] 🔍 Scanning ${uniqueChannelIds.length} channel unik...`);

  // Gunakan timestamp minimum dari detection sebagai window start
  // Ini确保 pesan terdeteksi (bisa >30 detik lalu) ikut terhapus
  const earliestTimestamp = Math.min(...detection.channels.map((c) => c.timestamp));
  const windowMs = Date.now() - earliestTimestamp + 5_000; // +5s buffer
  console.log(`[Aegis] ⏱️  Window scan: ${Math.round(windowMs / 1000)} detik`);

  for (const channelId of uniqueChannelIds) {
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      // Fetch pesan yang milik spammer dalam window deteksi
      const messages = await channel.messages.fetch({ limit: 30 });
      const spamMsgs = messages.filter(
        (m) =>
          m.author.id === userId &&
          Date.now() - m.createdTimestamp < windowMs
      );

      for (const msg of spamMsgs.values()) {
        collected.set(msg.id, msg); // Map otomatis deduplicate by ID
      }

      console.log(`[Aegis] 📥 #${channel.name}: ${spamMsgs.size} pesan ditemukan`);
    } catch (err) {
      console.error(`[Aegis] Gagal fetch channel ${channelId}:`, err.message);
    }
  }

  return [...collected.values()];
}

/**
 * Hapus semua pesan spam dengan delay antar delete.
 * Pakai .catch() biar gak crash kalau pesan udah terlanjur dihapus.
 */
async function deleteSpamMessages(messages, guildId) {
  let deleted = 0;
  const guildCfg = getGuildConfig(guildId);
  const deleteDelay = guildCfg ? guildCfg.deleteDelayMs : DELETE_DELAY_MS;

  for (const msg of messages) {
    await msg.delete().catch((err) => {
      if (err.code !== 10008) {
        console.error(`[Aegis] Gagal hapus pesan ${msg.id}:`, err.message);
      }
    });
    deleted++;

    if (deleted < messages.length) {
      await sleep(deleteDelay);
    }
  }

  console.log(`[Aegis] 🗑️  ${deleted} pesan spam dihapus`);
  return deleted;
}

/**
 * Timeout user yang spam.
 * Return { applied, reason, skipped, duration }
 */
async function timeoutUser(guild, userId, guildId) {
  try {
    const guildCfg = getGuildConfig(guildId);
    const timeoutDuration = guildCfg ? guildCfg.timeoutDurationMs : TIMEOUT_DURATION_MS;
    const timeoutReason = guildCfg ? guildCfg.timeoutReason : TIMEOUT_REASON;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { applied: false, reason: "Member tidak ditemukan di server", skipped: false, duration: 0 };
    if (!guild.members.me) return { applied: false, reason: "Bot tidak ditemukan sebagai member", skipped: false, duration: 0 };

    // Owner tidak di-timeout
    if (member.id === guild.ownerId) {
      return { applied: false, reason: "Owner server", skipped: true, duration: 0 };
    }
    // Admin di-delete pesannya tapi TIDAK di-timeout
    if (member.permissions.has("Administrator")) {
      return { applied: false, reason: "Admin — pesan dihapus, timeout dilewati", skipped: true, duration: 0 };
    }
    // Cek role hierarchy
    const botPos = guild.members.me.roles.highest.position;
    const targetPos = member.roles.highest.position;
    if (botPos <= targetPos) {
      return { applied: false, reason: `Role bot (pos: ${botPos}) lebih rendah dari target (pos: ${targetPos})`, skipped: false, duration: 0 };
    }

    await member.timeout(timeoutDuration, timeoutReason);
    console.log(`[Aegis] ⏱️  ${member.user.tag} di-timeout ${timeoutDuration / 1000}s`);
    return { applied: true, reason: null, skipped: false, duration: timeoutDuration };
  } catch (err) {
    console.error(`[Aegis] Gagal timeout user ${userId}:`, err.message);
    return { applied: false, reason: err.message, skipped: false, duration: 0 };
  }
}

/**
 * Main enforcer — collect → delete → timeout
 */
async function enforce(guild, detection, triggerMessage) {
  const summary = {
    messagesDeleted: 0,
    timeout: { applied: false, reason: null, skipped: false, duration: 0 },
  };

  // 1. Collect semua pesan spam
  const spamMessages = await collectSpamMessages(guild, detection, triggerMessage);
  console.log(`[Aegis] 📦 Total ${spamMessages.length} pesan akan dihapus`);

  // 2. Delete dengan delay
  summary.messagesDeleted = await deleteSpamMessages(spamMessages, guild.id);

  // 3. Timeout — result sudah pakai { applied, reason, skipped, duration }
  summary.timeout = await timeoutUser(guild, detection.userId, guild.id);

  return summary;
}

module.exports = { enforce };
