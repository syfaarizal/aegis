const crypto = require("crypto");

/**
 * Hash ringan pakai MD5 — cukup buat in-memory fingerprint.
 */
function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

/**
 * Normalize + hash sebuah URL
 */
function hashLink(rawUrl) {
  try {
    const url = new URL(rawUrl);
    // Buang query params yang tidak relevan
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(
      (p) => url.searchParams.delete(p)
    );
    url.hash = "";
    // Normalize trailing slash dan case insensitive
    const normalized = url.toString().replace(/\/+$/, "").toLowerCase();
    return md5(normalized);
  } catch {
    return md5(rawUrl.toLowerCase().trim());
  }
}

/**
 * Hash konten teks
 */
function hashText(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return md5(normalized);
}

/**
 * Hash attachment berdasarkan filename + size.
 */
function hashAttachment(attachment) {
  const fingerprint = `${attachment.name}:${attachment.size}`;
  return md5(fingerprint);
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function extractLinks(text) {
  return text.match(URL_REGEX) || [];
}

module.exports = { hashText, hashLink, hashAttachment, extractLinks };