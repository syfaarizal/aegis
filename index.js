require("dotenv").config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { onMessage } = require("./events/onMessage");
const { handleSetup } = require("./commands/setup");
const { BOT_TOKEN, LOG_CHANNEL_ID } = require("./config");

// ── Slash Command Definitions ──────────────────────────────
const AEGIS_COMMANDS = [
  new SlashCommandBuilder()
    .setName("aegis")
    .setDescription("Kelola pengaturan Aegis Security Bot")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Lihat atau ubah konfigurasi Aegis untuk server ini")
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Aktifkan/nonaktifkan Aegis").setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("threshold")
            .setDescription("Jumlah channel berbeda untuk dianggap spam")
            .setRequired(false)
            .addChoices(
              { name: "2 channel (Default)", value: 2 },
              { name: "3 channel", value: 3 },
              { name: "4 channel", value: 4 },
              { name: "5 channel", value: 5 }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName("window")
            .setDescription("Window deteksi spam (dalam detik)")
            .setRequired(false)
            .addChoices(
              { name: "15 detik (Default)", value: 15 },
              { name: "30 detik", value: 30 },
              { name: "60 detik", value: 60 },
              { name: "120 detik", value: 120 }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName("timeout")
            .setDescription("Durasi timeout spammer (dalam menit)")
            .setRequired(false)
            .addChoices(
              { name: "5 menit (Default)", value: 5 },
              { name: "10 menit", value: 10 },
              { name: "15 menit", value: 15 },
              { name: "30 menit", value: 30 }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName("minlength")
            .setDescription("Minimum panjang teks untuk di-track")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("ignoredroles")
            .setDescription("Role yang diabaikan (koma-separated)")
            .setRequired(false)
        )
    )
    .toJSON(),
];

// Intent yang dibutuhkan Aegis
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Events ─────────────────────────────────────────────

client.once("clientReady", async () => {
  console.log(`✅ Aegis online sebagai ${client.user.tag}`);
  console.log(`🛡️  Memantau server...`);

  // Register slash commands globally (Discord caches them)
  try {
    await client.application.commands.set(AEGIS_COMMANDS);
    console.log(`📋 ${AEGIS_COMMANDS.length} slash command(s) registered`);
  } catch (err) {
    console.error("[Aegis] Gagal register slash commands:", err.message);
  }

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

client.on("guildCreate", async (guild) => {
  console.log(`[Aegis] 🆕 Ditambahkan ke server: ${guild.name} (${guild.id})`);

  try {
    const owner = await guild.fetchOwner();
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🛡️ Terima kasih sudah menambahkan Aegis!")
      .setDescription(
        `Halo <@${owner.user.id}>! Aegis Security Bot telah ditambahkan ke **${guild.name}**.\n\n` +
        `Aegis secara otomatis melindungi server ini dari spam. Jalankan \`/aegis setup\` untuk mengkonfigurasi pengaturan.\n\n` +
        `**Command yang tersedia:**\n` +
        `• \`/aegis setup\` — Lihat atau ubah konfigurasi`
      )
      .addFields(
        {
          name: "⚡ Fitur utama",
          value:
            "• Deteksi teks/gambar/link duplikat di multiple channel\n" +
            "• Auto-delete + timeout spammer\n" +
            "• Per-guild config\n" +
            "• Immune role (admin, mod, staff)",
        }
      )
      .setFooter({ text: "Aegis Security", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await owner.send({ embeds: [embed] }).catch(() => {
      console.log(`[Aegis] Gagal DM owner ${owner.user.tag} — mungkin DM ditutup`);
    });
  } catch (err) {
    console.error("[Aegis] Gagal kirim pesan ke owner guild:", err.message);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "aegis") return;

  const sub = interaction.options.getSubcommand();
  if (sub === "setup") {
    await handleSetup(interaction);
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