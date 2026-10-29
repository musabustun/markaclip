// MarkaClip service worker: validates download requests from the content
// script and hands them to chrome.downloads.

const DEFAULT_SETTINGS = Object.freeze({ saveAs: false, folder: "MarkaClip" });
const ALLOWED_MEDIA_HOSTS = [".cdninstagram.com", ".fbcdn.net"];
const ALLOWED_SENDER_ORIGIN = "https://www.instagram.com";
const MAX_FILES_PER_REQUEST = 20;
const MAX_FILENAME_LENGTH = 120;
const UNSAFE_PATH_CHARS = /[<>:"\\|?*\u0000-\u001f]/g;

function isAllowedMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_MEDIA_HOSTS.some((host) => url.hostname.endsWith(host));
  } catch {
    return false;
  }
}

function sanitizeFolder(folder) {
  const clean = String(folder ?? "")
    .split(/[\\/]+/)
    .map((part) => part.replace(UNSAFE_PATH_CHARS, "").trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return clean || DEFAULT_SETTINGS.folder;
}

function sanitizeFilename(name) {
  const clean = String(name ?? "")
    .replace(UNSAFE_PATH_CHARS, "_")
    .replace(/[\\/]/g, "_")
    .replace(/^\.+/, "")
    .slice(-MAX_FILENAME_LENGTH);
  return clean || "markaclip";
}

/** @returns {{ url: string, filename: string }[]} */
function validateFiles(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES_PER_REQUEST) {
    throw new Error("Geçersiz indirme isteği.");
  }
  return files.map((file) => {
    if (!isAllowedMediaUrl(file?.url)) throw new Error("Desteklenmeyen medya adresi.");
    return { url: file.url, filename: sanitizeFilename(file.filename) };
  });
}

async function startDownloads(files) {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  const folder = sanitizeFolder(settings.folder);
  const results = await Promise.allSettled(
    files.map((file) =>
      chrome.downloads.download({
        url: file.url,
        filename: `${folder}/${file.filename}`,
        saveAs: Boolean(settings.saveAs),
        conflictAction: "uniquify",
      })
    )
  );
  const started = results.filter((r) => r.status === "fulfilled").length;
  if (started === 0) throw results[0].reason;
  results
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("[MarkaClip] partial download failure", r.reason));
  return { started, failed: results.length - started };
}

function isTrustedSender(sender) {
  return sender?.id === chrome.runtime.id && typeof sender.url === "string" && sender.url.startsWith(`${ALLOWED_SENDER_ORIGIN}/`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "markaclip:download") return false;
  if (!isTrustedSender(sender)) {
    sendResponse({ ok: false, error: "Yetkisiz istek." });
    return false;
  }

  Promise.resolve()
    .then(() => startDownloads(validateFiles(message.files)))
    .then(({ started, failed }) => sendResponse({ ok: true, count: started, failed }))
    .catch((err) => {
      console.error("[MarkaClip] download failed", err);
      sendResponse({ ok: false, error: err?.message ?? "İndirme başlatılamadı." });
    });
  return true; // keep the channel open for the async response
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
});
