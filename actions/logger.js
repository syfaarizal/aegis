const { EmbedBuilder } = require("discord.js");
const { getGuildConfig } = require("../guildConfig");
const { LOG_CHANNEL_ID } = require("../config");

const TYPE_META = {
  text:  { emoji: "💬", color: 0xf5a623, label: "Teks Duplikat"   },
  link:  { emoji: "🔗", color: 0xe74c3c, label: "Link Duplikat"   },
  image: { emoji: "🖼️", color: 0x9b59b6, label: "Gambar Duplikat" },
};

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

async function safeSend(channel, payload) {
  try {
    await channel.send(payload);
  } catch (err) {
    if (err.code === 50001) {
      console.warn(`[Aegis] ⚠️  Gagal kirim log — bot tidak punya akses ke channel ${channel.id}`);
    } else {
      console.error(`[Aegis] Gagal kirim log:`, err.message);
    }
  }
}

/**
 * Kirim embed log ke guild-specific atau global log channel.
 */
async function fetchLogChannel(client, guildId) {
  const guildCfg = getGuildConfig(guildId);
  const channelId = guildCfg && guildCfg.logChannelId ? guildCfg.logChannelId : LOG_CHANNEL_ID;
  if (!channelId) return null;
  try {
    return await client.channels.fetch(channelId);
  } catch (err) {
    console.warn(`[Aegis] ⚠️  Gagal akses log channel ${channelId}: ${err.message}`);
    return null;
  }
}

/**
 * Kirim 1 embed ringkasan deteksi per batch (bukan per detection).
 */
async function logDetections(client, message, detections) {
  if (detections.length === 0) return;

  const guildId = message.guild.id;
  const logChannel = await fetchLogChannel(client, guildId);
  if (!logChannel) return;

  const byType = {};
  for (const d of detections) {
    if (!byType[d.type]) byType[d.type] = { count: 0, channels: new Set() };
    byType[d.type].count++;
    for (const c of d.channels) byType[d.type].channels.add(c.id);
  }

  const user = message.author;
  const totalChannels = new Set(detections.flatMap((d) => d.channels.map((c) => c.id))).size;

  const typeLines = Object.entries(byType)
    .map(([type, data]) => {
      const meta = TYPE_META[type] || TYPE_META.text;
      return `${meta.emoji} **${meta.label}** — ${data.count}x, ${data.channels.size} channel`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🚨 Aegis — Spam Terdeteksi")
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      {
        name: "👤 User",
        value: `${user.tag} (<@${user.id}>)\nID: \`${user.id}\``,
        inline: true,
      },
      {
        name: "📊 Deteksi",
        value: `${detections.length} jenis spam terdeteksi\n${totalChannels} channel berbeda`,
        inline: true,
      }
    )
    .addFields({ name: "🔍 Tipe", value: typeLines })
    .setTimestamp()
    .setFooter({ text: "Aegis Security", iconURL: client.user.displayAvatarURL() });

  await safeSend(logChannel, { embeds: [embed] });
}

/**
 * Kirim 1 embed hasil action (delete + timeout) per batch.
 */
async function logActions(client, guildId, actionSummary) {
  if (!actionSummary) return;

  const logChannel = await fetchLogChannel(client, guildId);
  if (!logChannel) return;

  let timeoutLine;
  if (actionSummary.timeout.applied) {
    timeoutLine = `✅ Timeout **${formatDuration(actionSummary.timeout.duration)}**`;
  } else if (actionSummary.timeout.skipped) {
    timeoutLine = `⏭️ Timeout dilewati — Admin`;
  } else if (actionSummary.timeout.reason) {
    timeoutLine = `⚠️ Gagal: ${actionSummary.timeout.reason}`;
  } else {
    timeoutLine = `❌ Tidak diterapkan`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("✅ Aegis — Action Taken")
    .addFields(
      {
        name: "🗑️ Pesan Dihapus",
        value: `${actionSummary.messagesDeleted} pesan`,
        inline: true,
      },
      {
        name: "⏱️ Timeout",
        value: timeoutLine,
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Aegis Security", iconURL: client.user.displayAvatarURL() });

  await safeSend(logChannel, { embeds: [embed] });
}

module.exports = { logDetections, logActions, fetchLogChannel };
