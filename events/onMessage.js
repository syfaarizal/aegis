const { analyzeMessage } = require("../core/detector");
const { enforce } = require("../actions/enforcer");
const { logDetection } = require("../actions/logger");

// Cooldown per user biar gak spam action (enforce hanya sekali per X detik)
const enforceCooldown = new Map(); // userId → timestamp
const COOLDOWN_MS = 10_000;

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

  // Pesan kosong tanpa attachment = kemungkinan intent belum aktif
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

    for (const detection of detections) {
      console.log(
        `[Aegis] 🚨 SPAM — ${tag} | tipe: ${detection.type} | ${detection.channelCount} channel`
      );

      // Cek cooldown — hindari double enforce untuk user yang sama
      const lastEnforce = enforceCooldown.get(detection.userId) || 0;
      const onCooldown = Date.now() - lastEnforce < COOLDOWN_MS;

      let summary = null;

      if (!onCooldown) {
        enforceCooldown.set(detection.userId, Date.now());

        // Jalankan: collect → delete → timeout
        summary = await enforce(message.guild, detection, message);

        // Cleanup cooldown setelah selesai
        setTimeout(() => enforceCooldown.delete(detection.userId), COOLDOWN_MS);
      } else {
        console.log(`[Aegis] ⏭️  ${tag} masih dalam cooldown enforce, skip action`);
      }

      // Log ke admin channel (dengan atau tanpa summary)
      await logDetection(client, message, detection, summary);
    }
  } catch (err) {
    console.error("[Aegis] Error saat proses pesan:", err);
  }
}

module.exports = { onMessage };