const { EmbedBuilder } = require("discord.js");
const { LOG_CHANNEL_ID, TIMEOUT_DURATION_MS } = require("../config");

// Warna dan emoji per tipe deteksi
const TYPE_META = {
  text:  { emoji: "💬", color: 0xf5a623, label: "Teks Duplikat"   },
  link:  { emoji: "🔗", color: 0xe74c3c, label: "Link Duplikat"   },
  image: { emoji: "🖼️", color: 0x9b59b6, label: "Gambar Duplikat" },
};

/**
 * Format durasi timeout ke string yang readable.
 */
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

/**
 * Kirim embed log ke admin channel, include hasil enforce.
 */
async function logDetection(client, message, detection, enforceSummary = null) {
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel) {
    console.error("[Aegis] Log channel tidak ditemukan! Cek LOG_CHANNEL_ID di .env");
    return;
  }

  const meta = TYPE_META[detection.type] || TYPE_META.text;
  const user = message.author;

  // Format list channel yang terdampak
  const channelList = detection.channels
    .map((c) => `• <#${c.id}> (\`#${c.name}\`) — <t:${Math.floor(c.timestamp / 1000)}:T>`)
    .join("\n");

  // Status timeout
  let timeoutStatus = "⏳ Belum diproses";
  if (enforceSummary) {
    if (enforceSummary.timeout.applied) {
      timeoutStatus = `✅ Di-timeout selama **${formatDuration(TIMEOUT_DURATION_MS)}**`;
    } else {
      timeoutStatus = `⚠️ Gagal: ${enforceSummary.timeout.reason}`;
    }
  }

  // Jumlah pesan yang dihapus
  const deleteStatus = enforceSummary
    ? `🗑️ ${enforceSummary.messagesDeleted} pesan dihapus`
    : "⏳ Belum diproses";

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji}  Aegis — ${meta.label} Terdeteksi`)
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
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "📡 Channel Terdampak",
        value: channelList || "—",
      },
      {
        name: "🗑️ Pesan Dihapus",
        value: deleteStatus,
        inline: true,
      },
      {
        name: "⏱️ Timeout",
        value: timeoutStatus,
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Aegis Security", iconURL: client.user.displayAvatarURL() });

  // Info tambahan per tipe
  if (detection.type === "link" && detection.link) {
    embed.addFields({ name: "🔗 Link", value: `\`${detection.link}\`` });
  }
  if (detection.type === "image" && detection.filename) {
    embed.addFields({ name: "📎 File", value: `\`${detection.filename}\`` });
  }
  if (detection.type === "text" && message.content) {
    const preview = message.content.slice(0, 200);
    embed.addFields({
      name: "📝 Preview",
      value: `\`\`\`${preview}${message.content.length > 200 ? "..." : ""}\`\`\``,
    });
  }

  await logChannel.send({ embeds: [embed] });
}

module.exports = { logDetection };