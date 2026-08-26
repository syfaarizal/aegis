# 🛡️ Aegis Security Bot

A Discord security bot that automatically detects and blocks **cross-channel duplicate spam**.

## Features

- **Multi-Type Detection** — Duplicate text, images, and links spread across multiple channels
- **Auto-Enforcement** — Auto-delete spam messages and timeout offenders
- **Anti-False Positive** — Ignore users with admin/moderator roles, skip short messages
- **Per-Guild Config** — Each server has its own settings via `/aegis setup`
- **Per-Guild Log Channel** — Server-level logs go to a channel set by the server admin
- **Cooldown** — Avoid spamming enforcement on the same user repeatedly
- **Guild-Scoped Cache** — Detection cache isolated per server (no cross-server interference)

## How It Works

```
User sends a message
      ↓
Hash the message (text/link/attachment)
      ↓
Check if the same user with the same hash
sent to ≥ N different channels within the time window
      ↓
[SPAM] → delete all messages + timeout the user
[CLEAN] → no action
```

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/syfaarizal/aegis.git
cd aegis
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```
BOT_TOKEN=your_bot_token_here
LOG_CHANNEL_ID=your_log_channel_id_here
```

> **Note:** `LOG_CHANNEL_ID` is used **only** for bot-level events (startup notification). Per-server logs are configured by server admins via `/aegis setup log_channel:` — see the [Logging](#logging) section below.

### 3. Enable Privileged Intents

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your bot application
2. **Bot** → **Privileged Gateway Intents** → enable:
   - ✅ **Message Content Intent** (required to read message content)
   - ✅ **Server Members Intent** (required for onGuildCreate)
3. **OAuth2** → **URL Generator** → check `bot` + `applications.commands`
4. Invite the bot to your server with permissions: `Send Messages`, `Manage Messages`, `Manage Roles`

### 4. Run

```bash
npm start
```

## Commands

### `/aegis setup`

Configure Aegis for the current server. Running without arguments shows the current configuration.

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | Boolean | `true` | Enable/disable detection |
| `threshold` | Integer | `2` | Number of different channels to flag as spam |
| `window` | Integer (seconds) | `15` | Detection time window |
| `timeout` | Integer (minutes) | `5` | Timeout duration for spammers |
| `minlength` | Integer | `10` | Minimum text length to track |
| `ignoredroles` | String | `admin, moderator, mod, staff` | Roles to ignore (comma-separated) |
| `log_channel` | Channel | _(none)_ | Discord channel for server-level logs |

**Examples:**

```
/aegis setup enabled:true threshold:3 window:30 timeout:10
/aegis setup ignoredroles:admin,moderator,bot-manager
/aegis setup log_channel:#spam-logs
/aegis setup (no arguments = view current config)
```

## Logging

Aegis uses a **dual-channel logging system**:

| Log Type | Destination | Trigger |
|---|---|---|
| **Bot-level** | `LOG_CHANNEL_ID` in `.env` | Bot startup (🛡️ Aegis — Online) |
| **Server-level** | Channel set via `/aegis setup log_channel:` | Spam detections and enforcement actions |

- **Bot-level logs** are sent to the channel ID defined in `.env`. These are reserved for bot health events (startup, errors). They are **never** sent to per-server log channels.
- **Server-level logs** are sent to the channel configured by the server admin via `/aegis setup log_channel:`. If no channel is set, server-level logs are **not** sent anywhere.
- If the bot has no access to a configured log channel, a warning is logged to the console instead.

## Global Configuration (config.js)

| Key | Default | Description |
|---|---|---|
| `DETECTION_WINDOW_MS` | `15000` | Detection window (ms) |
| `DUPLICATE_CHANNEL_THRESHOLD` | `2` | Minimum channels to flag as spam |
| `MIN_TEXT_LENGTH` | `10` | Min text length to track |
| `IGNORED_ROLES` | `["admin","moderator","mod","staff"]` | Immune roles (case-insensitive) |
| `DELETE_DELAY_MS` | `300` | Delay between deletions (ms) |
| `TIMEOUT_DURATION_MS` | `300000` (5 min) | Default timeout duration |

## File Structure

```
aegis/
├── index.js          # Entry point + event handlers
├── config.js         # Global configuration
├── guildConfig.js    # Per-guild config loader/manager
├── guild-config.json # Per-guild config storage
├── cache/
│   └── store.js      # In-memory cache (guild-scoped)
├── core/
│   ├── detector.js   # Message analysis → detections
│   ├── hasher.js     # Text/link/attachment hashing
│   └── ratelimiter.js # Rate limiting
├── actions/
│   ├── enforcer.js   # Collect → delete → timeout
│   ├── logger.js     # Embed logging (guild-level)
│   ├── warn.js       # (placeholder)
│   ├── mute.js       # (placeholder)
│   └── ban.js        # (placeholder)
├── commands/
│   └── setup.js      # /aegis setup slash command
├── events/
│   └── onMessage.js  # messageCreate handler
└── .env              # Token & channel ID (do not commit)
```

## Per-Guild Config Endpoint

Guild config is stored in `guild-config.json`. Each guild can have overrides:

```json
{
  "_schema": "1.0",
  "guilds": {
    "GUILD_ID_1": {
      "enabled": true,
      "detectionWindowMs": 15000,
      "duplicateChannelThreshold": 2,
      "minTextLength": 10,
      "ignoredRoles": ["admin", "moderator", "mod", "staff"],
      "deleteDelayMs": 300,
      "timeoutDurationMs": 300000,
      "timeoutReason": "Aegis: Spam detected — duplicate messages across multiple channels",
      "logChannelId": null
    }
  }
}
```

## Important Notes

- **MESSAGE CONTENT INTENT** must be enabled in the Developer Portal, otherwise the bot cannot read message content
- The bot requires permissions: `Send Messages`, `Manage Messages`, `Manage Roles` (for timeout)
- Cache is in-memory (reset on bot restart)
- Per-guild config in `guild-config.json` is auto-managed via `/aegis setup`
- `LOG_CHANNEL_ID` in `.env` is for bot-level events only — it does **not** receive per-server logs

## License

ISC
