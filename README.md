# 🛡️ Aegis Security Bot

Bot keamanan Discord untuk mendeteksi dan menangkal **spam duplikat cross-channel** secara otomatis.

## Fitur

- **Deteksi Multi-Tipe** — Teks, gambar, dan link duplikat yang disebarkan ke banyak channel
- **Auto-Enforcement** — Hapus pesan spam + timeout offender secara otomatis
- **Anti-False Positive** — Abaikan user ber-role admin/moderator, skip pesan pendek
- **Per-Guild Config** — Setiap server punya pengaturan sendiri via `/aegis setup`
- **Cooldown** — Tidak spam-enforce user yang sama berkali-kali
- **Guild-Scoped Cache** — Cache deteksi terisolasi per server (tidak saling влиять antar server)

## Cara Kerja

```
User kirim pesan
      ↓
Hash pesan (text/link/attachment)
      ↓
Cek apakah user yang sama dengan hash sama
sudah kirim ke ≥ N channel berbeda dalam window waktu
      ↓
[SPAM] → hapus semua pesan + timeout user
[SEMBUH] → tidak ada aksi
```

## Persiapan

### 1. Clone & Install

```bash
git clone https://github.com/syfaarizal/aegis.git
cd aegis
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
BOT_TOKEN=your_bot_token_here
LOG_CHANNEL_ID=your_log_channel_id_here
```

### 3. Aktifkan Intent

Di [Discord Developer Portal](https://discord.com/developers/applications):

1. Pilih aplikasi bot kamu
2. **Bot** → **Privileged Gateway Intents** → aktifkan:
   - ✅ **Message Content Intent** (wajib untuk baca isi pesan)
   - ✅ **Server Members Intent** (diperlukan untuk onGuildCreate)
3. **OAuth2** → **URL Generator** → centang `bot` + `applications.commands`
4. Invite bot ke server dengan permission: `Send Messages`, `Manage Messages`, `Manage Roles`

### 4. Jalankan

```bash
npm start
```

## Command

### `/aegis setup`

Konfigurasi Aegis untuk server ini. Tanpa argument menampilkan config saat ini.

| Option | Tipe | Default | Deskripsi |
|---|---|---|---|
| `enabled` | Boolean | `true` | Aktifkan/nonaktifkan deteksi |
| `threshold` | Integer | `2` | Jumlah channel berbeda untuk dianggap spam |
| `window` | Integer (detik) | `15` | Window waktu deteksi |
| `timeout` | Integer (menit) | `5` | Durasi timeout untuk spammer |
| `minlength` | Integer | `10` | Minimum panjang teks untuk di-track |
| `ignoredroles` | String | `admin, moderator, mod, staff` | Role yang diabaikan (koma-separated) |

**Contoh:**

```
/aegis setup enabled:true threshold:3 window:30 timeout:10
/aegis setup ignoredroles:admin,moderator,bot-manager
/aegis setup (tanpa argumen = lihat config)
```

## Konfigurasi Global (config.js)

| Key | Default | Deskripsi |
|---|---|---|
| `DETECTION_WINDOW_MS` | `15000` | Window deteksi (ms) |
| `DUPLICATE_CHANNEL_THRESHOLD` | `2` | Channel minimal untuk dianggap spam |
| `MIN_TEXT_LENGTH` | `10` | Min panjang teks untuk di-track |
| `IGNORED_ROLES` | `["admin","moderator","mod","staff"]` | Role immune (case-insensitive) |
| `DELETE_DELAY_MS` | `300` | Delay antar delete (ms) |
| `TIMEOUT_DURATION_MS` | `300000` (5 menit) | Durasi timeout default |

## Struktur File

```
aegis/
├── index.js          # Entry point + event handlers
├── config.js         # Konfigurasi global
├── guildConfig.js    # Loader/manajer config per guild
├── guild-config.json # Penyimpanan config per guild
├── cache/
│   └── store.js      # Cache in-memory (guild-scoped)
├── core/
│   ├── detector.js   # Analisa pesan → deteksi
│   ├── hasher.js     # Hashing text/link/attachment
│   └── ratelimiter.js # Rate limiting
├── actions/
│   ├── enforcer.js   # Collect → delete → timeout
│   ├── logger.js     # Embed log ke admin channel
│   ├── warn.js       # (placeholder)
│   ├── mute.js       # (placeholder)
│   └── ban.js        # (placeholder)
├── commands/
│   └── setup.js      # /aegis setup slash command
├── events/
│   └── onMessage.js  # Handler messageCreate
└── .env              # Token & channel ID (jangan di-commit)
```

## Endpoint Config Per Guild

Guild config tersimpan di `guild-config.json`. Setiap guild punya override:

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
      "timeoutReason": "Aegis: Spam terdeteksi — pesan duplikat di multiple channel"
    }
  }
}
```

## Catatan Penting

- **MESSAGE CONTENT INTENT** harus aktif di Developer Portal, sonst bot tidak bisa baca isi pesan
- Bot butuh permission: `Send Messages`, `Manage Messages`, `Manage Roles` (untuk timeout)
- Cache bersifat in-memory (reset saat bot restart)
- Config per-guild di `guild-config.json` auto-managed via `/aegis setup`

## Lisensi

ISC
