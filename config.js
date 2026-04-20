module.exports = {
    // Window deteksi dalam milidetik (default: 15 detik)
    DETECTION_WINDOW_MS: 15_000,
  
    // Berapa channel yang sama = dianggap spam
    DUPLICATE_CHANNEL_THRESHOLD: 2,
  
    // Channel ID untuk log admin (isi di .env)
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  
    // Bot token
    BOT_TOKEN: process.env.BOT_TOKEN,
  };