const { DELETE_DELAY_MS, TIMEOUT_DURATION_MS, TIMEOUT_REASON } = require("../config");

/**
 * Delay helper — biar gak kena rate limit Discord.
 */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Cek apakah bot bisa timeout member ini.
 * Gak bisa timeout: admin, owner, atau role lebih tinggi dari bot.
 */
function canTimeout(guild, member) {
  if (!member) return false;
  if (!guild.members.me) return false;

  // Owner server tidak bisa di-timeout
  if (member.id === guild.ownerId) return false;

  // Admin permission tidak bisa di-timeout
  if (member.permissions.has("Administrator")) return false;

  // Role bot harus lebih tinggi dari role tertinggi target
  const botHighestRole = guild.members.me.roles.highest.position;
  const targetHighestRole = member.roles.highest.position;
  return botHighestRole > targetHighestRole;
}

/**
 * Kumpulkan semua pesan spam dari channels yang terdampak.
 * Return array of Discord Message objects.
 */
async function collectSpamMessages(guild, detection, triggerMessage) {
  const collected = [triggerMessage]; // mulai dari pesan yang trigger deteksi
  const userId = detection.userId;

  for (const channelInfo of detection.channels) {
    // Skip channel dari trigger message (udah di-collect)
    if (channelInfo.id === triggerMessage.channel.id) continue;

    try {
      const channel = await guild.channels.fetch(channelInfo.id).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      // Fetch 20 pesan terakhir, cari yang milik spammer
      const messages = await channel.messages.fetch({ limit: 20 });
      const spamMsgs = messages.filter(
        (m) => m.author.id === userId &&
               Date.now() - m.createdTimestamp < 20_000 // dalam 20 detik terakhir
      );

      collected.push(...spamMsgs.values());
    } catch (err) {
      console.error(`[Aegis] Gagal fetch messages dari channel ${channelInfo.id}:`, err.message);
    }
  }

  return collected;
}

/**
 * Hapus semua pesan spam dengan delay antar delete.
 * Pakai .catch() biar gak crash kalau pesan udah terlanjur dihapus.
 */
async function deleteSpamMessages(messages) {
  let deleted = 0;

  for (const msg of messages) {
    await msg.delete().catch((err) => {
      // Abaikan error "Unknown Message" (udah dihapus) dan "Missing Permissions"
      if (err.code !== 10008) {
        console.error(`[Aegis] Gagal hapus pesan ${msg.id}:`, err.message);
      }
    });
    deleted++;

    // Delay antar delete biar gak kena rate limit
    if (deleted < messages.length) {
      await sleep(DELETE_DELAY_MS);
    }
  }

  console.log(`[Aegis] 🗑️  ${deleted} pesan spam dihapus`);
  return deleted;
}

/**
 * Timeout user yang spam.
 * Return { success, reason } — reason berisi kenapa kalau gagal.
 */
async function timeoutUser(guild, userId) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { success: false, reason: "Member tidak ditemukan" };

    if (!canTimeout(guild, member)) {
      return { success: false, reason: "User punya permission lebih tinggi dari bot" };
    }

    await member.timeout(TIMEOUT_DURATION_MS, TIMEOUT_REASON);
    console.log(`[Aegis] ⏱️  User ${member.user.tag} di-timeout ${TIMEOUT_DURATION_MS / 1000}s`);
    return { success: true, reason: null };
  } catch (err) {
    console.error(`[Aegis] Gagal timeout user ${userId}:`, err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Main enforcer — jalankan semua aksi sekaligus:
 * collect → delete → timeout
 *
 * Return summary hasil eksekusi.
 */
async function enforce(guild, detection, triggerMessage) {
  const summary = {
    messagesDeleted: 0,
    timeout: { applied: false, reason: null },
  };

  // 1. Kumpulin semua pesan spam
  const spamMessages = await collectSpamMessages(guild, detection, triggerMessage);
  console.log(`[Aegis] 📦 Collected ${spamMessages.length} pesan spam`);

  // 2. Delete semua sekaligus (dengan delay)
  summary.messagesDeleted = await deleteSpamMessages(spamMessages);

  // 3. Timeout user
  const timeoutResult = await timeoutUser(guild, detection.userId);
  summary.timeout = timeoutResult;

  return summary;
}

module.exports = { enforce };