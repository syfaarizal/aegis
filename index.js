require("dotenv").config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const { onMessage } = require("./events/onMessage");
const { BOT_TOKEN, LOG_CHANNEL_ID } = require("./config");

// Intent yang dibutuhkan Aegis
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Wajib diaktifkan di Discord Dev Portal
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Events ─────────────────────────────────────────────

client.once("clientReady", async () => {
  console.log(`✅ Aegis online sebagai ${client.user.tag}`);
  console.log(`🛡️  Memantau server...`);

  // Kirim startup message ke log channel
  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🛡️ Aegis — Online")
      .setDescription("Bot aktif dan siap memantau server.")
      .addFields(
        { name: "⏰ Waktu", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: "📡 Status", value: "Memantau semua channel", inline: true }
      )
      .setFooter({ text: "Aegis Security", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[Aegis] Gagal kirim startup message:", err.message);
    console.error("        → Cek LOG_CHANNEL_ID di .env dan permission bot di channel tersebut.");
  }
});

client.on("messageCreate", (message) => onMessage(client, message));

client.on("error", (err) => {
  console.error("[Aegis] Client error:", err);
});

// ── Start ───────────────────────────────────────────────

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN tidak ditemukan! Buat file .env dulu.");
  process.exit(1);
}

client.login(BOT_TOKEN);