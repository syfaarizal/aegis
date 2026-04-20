require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { onMessage } = require("./events/onMessage");
const { BOT_TOKEN } = require("./config");

// Intent
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Events

client.once("ready", () => {
  console.log(`✅ Aegis online sebagai ${client.user.tag}`);
  console.log(`🛡️  Memantau server...`);
});

client.on("messageCreate", (message) => onMessage(client, message));

client.on("error", (err) => {
  console.error("[Aegis] Client error:", err);
});

// Start

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN tidak ditemukan! Buat file .env dulu.");
  process.exit(1);
}

client.login(BOT_TOKEN);