const { analyzeMessage } = require("../core/detector");
const { enforce } = require("../actions/enforcer");
const { logDetections, logActions } = require("../actions/logger");

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

    // Batch console log detections
    console.log(
      `[Aegis] 🚨 ${detections.length} deteksi spam dari ${tag} | tipe: ${detections.map((d) => d.type).join(", ")}`
    );

    // Kirim 1 embed ringkasan deteksi (bukan per-detection)
    await logDetections(client, message, detections);

    // Cek cooldown — enforce hanya sekali per batch
    const lastEnforce = enforceCooldown.get(message.author.id) || 0;
    const onCooldown = Date.now() - lastEnforce < COOLDOWN_MS;

    if (!onCooldown) {
      enforceCooldown.set(message.author.id, Date.now());

      // Jalankan: collect → delete → timeout
      const summary = await enforce(message.guild, detections[0], message);

      // Cleanup cooldown setelah selesai
      setTimeout(() => enforceCooldown.delete(message.author.id), COOLDOWN_MS);

      // Kirim 1 embed hasil action
      await logActions(client, message.guild.id, summary);
    } else {
      console.log(`[Aegis] ⏭️  ${tag} masih dalam cooldown enforce, skip action`);
    }
  } catch (err) {
    console.error("[Aegis] Error saat proses pesan:", err);
  }
}

module.exports = { onMessage };
