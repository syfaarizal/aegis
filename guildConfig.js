const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "guild-config.json");

const DEFAULT_CONFIG = {
  enabled: true,
  detectionWindowMs: 15_000,
  duplicateChannelThreshold: 2,
  minTextLength: 10,
  ignoredRoles: ["admin", "moderator", "mod", "staff"],
  deleteDelayMs: 300,
  timeoutDurationMs: 5 * 60 * 1000,
  timeoutReason: "Aegis: Spam terdeteksi — pesan duplikat di multiple channel",
};

let cache = null;

function loadConfig() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    cache = { _schema: "1.0", _note: "Guild configs are auto-managed.", guilds: {} };
    saveConfig(cache);
  }
  return cache;
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), "utf8");
  cache = data;
}

function getGuildConfig(guildId) {
  const config = loadConfig();
  const guildData = config.guilds[guildId];
  if (!guildData) return null;
  return {
    ...DEFAULT_CONFIG,
    ...guildData,
  };
}

function setGuildConfig(guildId, overrides) {
  const config = loadConfig();
  config.guilds[guildId] = {
    ...(config.guilds[guildId] || {}),
    ...overrides,
  };
  saveConfig(config);
}

function removeGuild(guildId) {
  const config = loadConfig();
  if (config.guilds[guildId]) {
    delete config.guilds[guildId];
    saveConfig(config);
  }
}

module.exports = { getGuildConfig, setGuildConfig, removeGuild, DEFAULT_CONFIG };
