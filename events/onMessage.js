const { analyzeMessage } = require("../core/detector");
const { logDetection } = require("../actions/logger");

/**
 * Handler utama untuk event messageCreate.
 * Dipanggil setiap kali ada pesan baru di server.
 */
async function onMessage(client, message) {
  // Skip bot (termasuk diri sendiri) dan pesan DM
  if (message.author.bot) return;
  if (!message.guild) return;

  console.log(`[DEBUG] Pesan dari ${message.author.tag} | content: "${message.content}" | channel: ${message.channel.name}`);

  try {
    const detections = analyzeMessage(message);

    for (const detection of detections) {
      console.log(
        `[Aegis] Spam terdeteksi — User: ${message.author.tag} | Tipe: ${detection.type} | ${detection.channelCount} channel`
      );
      await logDetection(client, message, detection);
    }
  } catch (err) {
    console.error("[Aegis] Error saat analisa pesan:", err);
  }
}

module.exports = { onMessage };