const { EmbedBuilder } = require("discord.js");
const { getGuildConfig, setGuildConfig, DEFAULT_CONFIG } = require("../guildConfig");

function formatMs(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

/**
 * Build current config embed for a guild.
 */
function buildCurrentConfigEmbed(guildId, guildName, logChannel) {
  const cfg = getGuildConfig(guildId);
  const enabled = cfg ? cfg.enabled : true;
  const threshold = cfg ? cfg.duplicateChannelThreshold : DEFAULT_CONFIG.duplicateChannelThreshold;
  const window = cfg ? cfg.detectionWindowMs : DEFAULT_CONFIG.detectionWindowMs;
  const minLen = cfg ? cfg.minTextLength : DEFAULT_CONFIG.minTextLength;
  const timeout = cfg ? cfg.timeoutDurationMs : DEFAULT_CONFIG.timeoutDurationMs;
  const ignoredRoles = cfg && cfg.ignoredRoles && cfg.ignoredRoles.length > 0
    ? cfg.ignoredRoles.join(", ")
    : "(tidak ada — semua orang terdeteksi)";

  const logChannelLine = logChannel
    ? `${logChannel.name} (\`${logChannel.id}\`)`
    : `\`${cfg && cfg.logChannelId ? cfg.logChannelId : "default"}\``;

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🛡️ Aegis — Config")
    .setDescription(`Konfigurasi untuk server **${guildName}**`)
    .addFields(
      { name: "🔒 Aegis Aktif", value: enabled ? "✅ Ya" : "❌ Tidak", inline: true },
      { name: "📡 Threshold", value: `${threshold} channel berbeda`, inline: true },
      { name: "⏱️ Window Deteksi", value: formatMs(window), inline: true },
      { name: "📝 Min Text Length", value: `${minLen} karakter`, inline: true },
      { name: "⏳ Timeout", value: formatMs(timeout), inline: true },
      { name: "📢 Log Channel", value: logChannelLine, inline: true },
      { name: "🚫 Ignored Roles", value: `\`${ignoredRoles}\``, inline: false }
    )
    .setFooter({ text: "Gunakan /aegis setup untuk mengubah konfigurasi" })
    .setTimestamp();
}

/**
 * /aegis setup — configure Aegis per-guild settings.
 */
async function handleSetup(interaction) {
  const guildId = interaction.guildId;
  const guildName = interaction.guild.name;

  if (!interaction.isChatInputCommand()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const threshold = interaction.options.getInteger("threshold");
  const window = interaction.options.getInteger("window");
  const timeout = interaction.options.getInteger("timeout");
  const minlength = interaction.options.getInteger("minlength");
  const ignoredroles = interaction.options.getString("ignoredroles");
  const logchannel = interaction.options.getChannel("log_channel");

  // Resolve log channel name for display
  const logChannelObj = logchannel
    ? { name: logchannel.name, id: logchannel.id }
    : null;

  // Jika tidak ada option, tampilkan config saat ini
  if (!enabled && !threshold && !window && !timeout && !minlength && !ignoredroles && !logchannel) {
    const cfg = getGuildConfig(guildId);
    let resolvedLogChannel = null;
    if (cfg && cfg.logChannelId) {
      const ch = await interaction.guild.channels.fetch(cfg.logChannelId).catch(() => null);
      if (ch) resolvedLogChannel = { name: ch.name, id: ch.id };
    }
    const embed = buildCurrentConfigEmbed(guildId, guildName, resolvedLogChannel);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Build override object (konversi dari detik/menit ke milidetik)
  const overrides = {};
  if (enabled !== null) overrides.enabled = enabled;
  if (threshold !== null) overrides.duplicateChannelThreshold = threshold;
  if (window !== null) overrides.detectionWindowMs = window * 1000;
  if (timeout !== null) overrides.timeoutDurationMs = timeout * 60 * 1000;
  if (minlength !== null) overrides.minTextLength = minlength;
  if (ignoredroles !== null) {
    overrides.ignoredRoles = ignoredroles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  }
  if (logchannel !== null) overrides.logChannelId = logchannel.id;

  setGuildConfig(guildId, overrides);

  const embed = buildCurrentConfigEmbed(guildId, guildName, logChannelObj);
  embed.setColor(0xf5a623).setTitle("🛡️ Aegis — Config Updated");

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleSetup, buildCurrentConfigEmbed };
