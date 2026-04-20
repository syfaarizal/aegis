const { record } = require("../cache/store");
const { hashText, hashLink, hashAttachment, extractLinks } = require("./hasher");
const { DUPLICATE_CHANNEL_THRESHOLD } = require("../config");

function getUniqueChannels(entries) {
  const seen = new Set(entries.map((e) => e.channelId));
  return [...seen];
}

function checkSignal(userId, hash, channelId, channelName, type) {
  const entries = record(userId, hash, channelId, channelName);
  const uniqueChannels = getUniqueChannels(entries);

  if (uniqueChannels.length >= DUPLICATE_CHANNEL_THRESHOLD) {
    return {
      type,         // "text" | "link" | "image"
      hash,
      userId,
      channelCount: uniqueChannels.length,
      channels: entries.map((e) => ({
        id: e.channelId,
        name: e.channelName,
        timestamp: e.timestamp,
      })),
    };
  }

  return null;
}

function analyzeMessage(message) {
  const detections = [];
  const userId = message.author.id;
  const channelId = message.channel.id;
  const channelName = message.channel.name || channelId;

  // 1. Cek konten teks
  const rawContent = message.content || "";
  if (rawContent.trim().length > 0) {
    const textHash = hashText(rawContent);
    const result = checkSignal(userId, textHash, channelId, channelName, "text");
    if (result) detections.push(result);
  }

  // 2. Cek setiap link
  const links = extractLinks(rawContent);
  for (const link of links) {
    const linkHash = hashLink(link);
    const result = checkSignal(userId, linkHash, channelId, channelName, "link");
    if (result) detections.push({ ...result, link });
  }

  // 3. Cek setiap attachment
  for (const [, attachment] of message.attachments) {
    const attHash = hashAttachment(attachment);
    const result = checkSignal(userId, attHash, channelId, channelName, "image");
    if (result) detections.push({ ...result, filename: attachment.name });
  }

  return detections;
}

module.exports = { analyzeMessage };