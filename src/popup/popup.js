// Popup: reads/writes MarkaClip settings in chrome.storage.sync.
const DEFAULT_SETTINGS = Object.freeze({ saveAs: false, folder: "MarkaClip" });
const SAVE_DEBOUNCE_MS = 400;
const STATUS_CLEAR_MS = 1600;

const folderInput = document.getElementById("folder");
const saveAsInput = document.getElementById("saveAs");
const statusEl = document.getElementById("status");
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

let statusTimer = 0;
function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff5c5c" : "";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.textContent = ""), STATUS_CLEAR_MS);
}

async function save(patch) {
  try {
    await chrome.storage.sync.set(patch);
    showStatus("Kaydedildi");
  } catch (err) {
    console.error("[MarkaClip] settings save failed", err);
    showStatus("Ayar kaydedilemedi", true);
  }
}

async function load() {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
    folderInput.value = settings.folder;
    saveAsInput.checked = Boolean(settings.saveAs);
  } catch (err) {
    console.error("[MarkaClip] settings load failed", err);
    showStatus("Ayarlar okunamadı", true);
  }
}

let folderTimer = 0;
folderInput.addEventListener("input", () => {
  clearTimeout(folderTimer);
  folderTimer = setTimeout(() => {
    // The service worker sanitises the path again before every download.
    const folder = folderInput.value.trim() || DEFAULT_SETTINGS.folder;
    save({ folder });
  }, SAVE_DEBOUNCE_MS);
});

saveAsInput.addEventListener("change", () => save({ saveAs: saveAsInput.checked }));

load();
