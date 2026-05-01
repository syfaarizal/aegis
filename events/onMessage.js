const { analyzeMessage } = require("../core/detector");
const { logDetection } = require("../actions/logger");

/**
 * Handler utama untuk event messageCreate.
 * Dipanggil setiap kali ada pesan baru di server.
 */
async function onMessage(client, message) {
  // Skip bot dan DM
  if (message.author.bot) return;
  if (!message.guild) return;

  const tag = message.author.tag;
  const channelName = message.channel.name || message.channel.id;
  const contentPreview = message.content
    ? `"${message.content.slice(0, 60)}"`
    : "(kosong)";
  const attachCount = message.attachments.size;

  console.log(
    `[Aegis] 📨 ${tag} → #${channelName} | content: ${contentPreview} | attachments: ${attachCount}`
  );

  // Kalau content kosong DAN tidak ada attachment, kemungkinan intent belum aktif
  if (!message.content && attachCount === 0) {
    console.log(`[Aegis] ⚠️  Pesan kosong dari ${tag} — kemungkinan MESSAGE CONTENT INTENT belum aktif!`);
    return;
  }

  try {
    const detections = analyzeMessage(message);

    if (detections.length === 0) {
      console.log(`[Aegis] ✅ Aman — belum ada duplikat cross-channel`);
      return;
    }

    for (const detection of detections) {
      console.log(
        `[Aegis] 🚨 SPAM DETECTED — ${tag} | tipe: ${detection.type} | ${detection.channelCount} channel`
      );
      await logDetection(client, message, detection);
    }
  } catch (err) {
    console.error("[Aegis] Error saat analisa pesan:", err);
  }
}

module.exports = { onMessage };