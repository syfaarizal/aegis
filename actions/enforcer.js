const { DELETE_DELAY_MS, TIMEOUT_DURATION_MS, TIMEOUT_REASON } = require("../config");
const { getGuildConfig } = require("../guildConfig");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Kumpulkan semua pesan spam dari channels yang terdampak.
 * Skip pesan yang sudah ada di deletedSet (agar tidak double-delete).
 */
async function collectSpamMessages(guild, detection, triggerMessage, deletedSet) {
  const collected = new Map(); // messageId → Message (biar gak dobel)
  const userId = detection.userId;

  console.log(`[Aegis] 🔍 Collect: userId=${userId}, hash=${detection.hash}, triggerMsg=${triggerMessage.id}`);
  console.log(`[Aegis] 🔍 Channels di detection: ${detection.channels.map((c) => `${c.id}(${c.name})`).join(", ")}`);

  // Masukkan trigger message dulu (jika belum dihapus)
  if (!deletedSet.has(triggerMessage.id)) {
    collected.set(triggerMessage.id, triggerMessage);
  }

  // Deduplicate channel IDs dari detection — channel bisa muncul >1x di entries
  const uniqueChannelIds = [...new Set(detection.channels.map((c) => c.id))];
  console.log(`[Aegis] 🔍 Scanning ${uniqueChannelIds.length} channel unik...`);

  // Gunakan timestamp minimum dari detection sebagai window start
  // Ini memastikan pesan terdeteksi (bisa >30 detik lalu) ikut terhapus
  const earliestTimestamp = Math.min(...detection.channels.map((c) => c.timestamp));
  const windowMs = Date.now() - earliestTimestamp + 5_000; // +5s buffer
  console.log(`[Aegis] 🔍 Window: earliest=${new Date(earliestTimestamp).toISOString()}, ms=${Math.round(windowMs / 1000)}s`);

  for (const channelId of uniqueChannelIds) {
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.log(`[Aegis] 🔍   #${channelId}: channel tidak ditemukan`);
        continue;
      }
      if (!channel.isTextBased()) {
        console.log(`[Aegis] 🔍   #${channel.name}: bukan text channel`);
        continue;
      }

      console.log(`[Aegis] 🔍   #${channel.name}: fetching 30 pesan...`);
      // Fetch pesan yang milik spammer dalam window deteksi
      const messages = await channel.messages.fetch({ limit: 30 });
      const spamMsgs = messages.filter(
        (m) =>
          m.author.id === userId &&
          Date.now() - m.createdTimestamp < windowMs &&
          !deletedSet.has(m.id) // skip yang sudah dihapus sebelumnya
      );

      console.log(`[Aegis] 🔍   #${channel.name}: ${messages.size} fetched, ${spamMsgs.size} match (${deletedSet.size} sudah dihapus sebelumnya)`);
      for (const msg of spamMsgs.values()) {
        collected.set(msg.id, msg); // Map otomatis deduplicate by ID
      }
    } catch (err) {
      console.error(`[Aegis] 🔍   Gagal fetch channel ${channelId}:`, err.message);
    }
  }

  console.log(`[Aegis] 🔍 Total collected: ${collected.size} pesan`);
  return [...collected.values()];
}

/**
 * Hapus semua pesan spam dengan delay antar delete.
 * Pakai .catch() biar gak crash kalau pesan udah terlanjur dihapus.
 */
async function deleteSpamMessages(messages, guildId, deletedSet) {
  let deleted = 0;
  const guildCfg = getGuildConfig(guildId);
  const deleteDelay = guildCfg ? guildCfg.deleteDelayMs : DELETE_DELAY_MS;

  console.log(`[Aegis] 🗑️  Mulai hapus ${messages.length} pesan (delay=${deleteDelay}ms)...`);

  for (const msg of messages) {
    console.log(`[Aegis] 🗑️    delete msg ${msg.id} (${msg.createdAt.toISOString()})...`);
    const result = await msg.delete().catch((err) => {
      if (err.code === 10008) {
        console.log(`[Aegis] 🗑️    msg ${msg.id} sudah dihapus sebelumnya`);
      } else if (err.code === 50013) {
        console.error(`[Aegis] 🗑️    GAGAL — bot tidak punya permission hapus pesan di channel`);
      } else {
        console.error(`[Aegis] 🗑️    Gagal hapus msg ${msg.id}: ${err.message} (code: ${err.code})`);
      }
      return err;
    });
    deleted++;
    deletedSet.add(msg.id);

    if (deleted < messages.length) {
      await sleep(deleteDelay);
    }
  }

  console.log(`[Aegis] 🗑️  Selesai: ${deleted}/${messages.length} dihapus`);
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
 * Main enforcer — collect → delete → timeout.
 * deletedSet prevents double-deleting messages across multiple enforcement calls.
 * skipTimeout: set true when user is on timeout cooldown.
 */
async function enforce(guild, detection, triggerMessage, deletedSet, skipTimeout) {
  const summary = {
    messagesDeleted: 0,
    timeout: { applied: false, reason: null, skipped: false, duration: 0 },
  };

  // 1. Collect semua pesan spam (skip yang sudah dihapus)
  const spamMessages = await collectSpamMessages(guild, detection, triggerMessage, deletedSet);
  console.log(`[Aegis] 📦 Total ${spamMessages.length} pesan akan dihapus`);

  if (spamMessages.length === 0) {
    console.log(`[Aegis] 📦 Semua pesan sudah dihapus sebelumnya`);
    return summary;
  }

  // 2. Delete dengan delay (track ID yang berhasil dihapus)
  summary.messagesDeleted = await deleteSpamMessages(spamMessages, guild.id, deletedSet);

  // 3. Timeout — skip jika sedang cooldown
  if (skipTimeout) {
    console.log(`[Aegis] ⏱️  Timeout dilewati — masih cooldown`);
    summary.timeout = { applied: false, reason: null, skipped: false, duration: 0, reasonOnly: "Cooldown timeout" };
  } else {
    summary.timeout = await timeoutUser(guild, detection.userId, guild.id);
  }

  return summary;
}

module.exports = { enforce, deleteSpamMessages, timeoutUser };
