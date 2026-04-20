const { EmbedBuilder } = require("discord.js");
const { LOG_CHANNEL_ID } = require("../config");

// Warna dan emoji per tipe deteksi
const TYPE_META = {
  text:  { emoji: "💬", color: 0xf5a623, label: "Teks Duplikat"   },
  link:  { emoji: "🔗", color: 0xe74c3c, label: "Link Duplikat"   },
  image: { emoji: "🖼️", color: 0x9b59b6, label: "Gambar Duplikat" },
};

/**
 * Kirim embed log ke admin channel untuk satu detection.
 */
async function logDetection(client, message, detection) {
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel) {
    console.error("[Aegis] Log channel tidak ditemukan! Cek LOG_CHANNEL_ID di .env");
    return;
  }

  const meta = TYPE_META[detection.type] || TYPE_META.text;
  const user = message.author;

  // Format list channel tempat spam terdeteksi
  const channelList = detection.channels
    .map((c) => `• <#${c.id}> (\`${c.name}\`) — <t:${Math.floor(c.timestamp / 1000)}:T>`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} Aegis — ${meta.label} Terdeteksi`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      {
        name: "👤 User",
        value: `${user.tag} (<@${user.id}>)\nID: \`${user.id}\``,
        inline: true,
      },
      {
        name: "📊 Spread",
        value: `Dikirim ke **${detection.channelCount} channel** berbeda`,
        inline: true,
      },
      {
        name: "📡 Channel yang Terdampak",
        value: channelList || "—",
      }
    )
    .setTimestamp()
    .setFooter({ text: "Aegis Security · MVP", iconURL: client.user.displayAvatarURL() });

  // Info tambahan berdasarkan tipe
  if (detection.type === "link" && detection.link) {
    embed.addFields({ name: "🔗 Link", value: detection.link });
  }
  if (detection.type === "image" && detection.filename) {
    embed.addFields({ name: "📎 File", value: `\`${detection.filename}\`` });
  }
  if (detection.type === "text") {
    const preview = (message.content || "").slice(0, 200);
    embed.addFields({
      name: "📝 Preview Pesan",
      value: `\`\`\`${preview}${preview.length === 200 ? "..." : ""}\`\`\``,
    });
  }

  await logChannel.send({ embeds: [embed] });
}

module.exports = { logDetection };