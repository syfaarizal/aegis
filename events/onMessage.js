const { analyzeMessage } = require("../core/detector");
const { enforce } = require("../actions/enforcer");
const { logDetections, logActions } = require("../actions/logger");

// Cooldown hanya untuk TIMEOUT, bukan untuk hapus pesan.
// tracking per guild:userId → Set of deleted message IDs
const enforceCooldown = new Map(); // userId → timestamp
const deletedTracker = new Map(); // key: `${guildId}:${userId}` → Set<messageId>
const COOLDOWN_MS = 10_000;

function getDeletedSet(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!deletedTracker.has(key)) deletedTracker.set(key, new Set());
  return deletedTracker.get(key);
}

function clearDeletedSet(guildId, userId) {
  deletedTracker.delete(`${guildId}:${userId}`);
}

/**
 * Handler utama untuk event messageCreate.
 */
async function onMessage(client, message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const tag = message.author.tag;
  const channelName = message.channel.name || message.channel.id;
  const contentPreview = message.content
    ? `"${message.content.slice(0, 60)}"`
    : "(kosong)";

  console.log(
    `[Aegis] 📨 ${tag} → #${channelName} | content: ${contentPreview} | attach: ${message.attachments.size}`
  );

  if (!message.content && message.attachments.size === 0) {
    console.log(`[Aegis] ⚠️  Pesan kosong dari ${tag} — cek MESSAGE CONTENT INTENT di Dev Portal`);
    return;
  }

  try {
    const detections = analyzeMessage(message);

    if (detections.length === 0) {
      console.log(`[Aegis] ✅ Aman`);
      return;
    }

    console.log(
      `[Aegis] 🚨 ${detections.length} deteksi spam dari ${tag} | tipe: ${detections.map((d) => d.type).join(", ")}`
    );

    await logDetections(client, message, detections);

    // Cooldown hanya untuk TIMEOUT, bukan delete.
    // Ini memastikan pesan spam baru tetap dihapus meskipun timeout masih cooldown.
    const lastTimeout = (enforceCooldown.get(message.author.id) || 0);
    const timeoutOnCooldown = Date.now() - lastTimeout < COOLDOWN_MS;

    if (!timeoutOnCooldown) {
      enforceCooldown.set(message.author.id, Date.now());
      setTimeout(() => {
        enforceCooldown.delete(message.author.id);
        clearDeletedSet(message.guild.id, message.author.id);
      }, COOLDOWN_MS);
    } else {
      console.log(`[Aegis] ⏭️  ${tag} timeout masih cooldown — delete pesan spam tetap jalan`);
    }

    // Selalu enforce delete pesan spam (tidak terpengaruh cooldown timeout)
    const summary = await enforce(
      message.guild,
      detections[0],
      message,
      getDeletedSet(message.guild.id, message.author.id),
      timeoutOnCooldown // true = skip timeout call
    );

    await logActions(client, message.guild.id, summary);
  } catch (err) {
    console.error("[Aegis] Error saat proses pesan:", err);
  }
}

module.exports = { onMessage };

