// Shared constants for the MarkaClip content scripts.
// Every content script reads/extends the same `globalThis.MarkaClip` namespace.
(() => {
  const ns = (globalThis.MarkaClip = globalThis.MarkaClip || {});

  // Public web app id Instagram's own frontend sends with API requests.
  ns.IG_APP_ID = "936619743392459";
  ns.BRAND_LIME = "#D7FF00";

  // Instagram localises aria-labels, so we match a few common UI languages.
  // Values are compared lower-cased.
  ns.LABELS = Object.freeze({
    like: [
      "like", "unlike",
      "beğen", "beğenmekten vazgeç",
      "gefällt mir", "gefällt mir nicht mehr",
      "j’aime", "j'aime", "je n’aime plus", "je n'aime plus",
      "me gusta", "ya no me gusta",
      "mi piace", "non mi piace più",
    ],
    save: [
      "save", "remove",
      "kaydet", "kaldır",
      "speichern", "entfernen",
      "enregistrer", "supprimer",
      "guardar", "eliminar",
      "salva", "rimuovi",
    ],
    storyControl: [
      "pause", "play",
      "duraklat", "oynat",
      "pausieren", "abspielen", "wiedergeben",
      "lire",
      "pausar", "reproducir",
      "pausa", "riproduci",
    ],
  });

  // Shape fallbacks in case a label is not in the lists above.
  ns.SELECTORS = Object.freeze({
    saveShape: 'polygon[points^="20 21 12 13.44"], path[d^="M20 22a.999.999"]',
    likeShape: 'path[d^="M16.792 3.904"], path[d^="M34.6 3.1"], path[d^="M34.6 6.1"]',
  });

  // Outline icons drawn on Instagram's 24px grid with a 2px stroke.
  const svg = (body) =>
    `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  ns.ICONS = Object.freeze({
    download: svg('<path d="M12 3v12.5"/><path d="m6.5 10.5 5.5 5.5 5.5-5.5"/><path d="M3.5 16.5v2.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2.5"/>'),
    loading: svg('<path d="M21 12a9 9 0 1 1-6.22-8.56"/>'),
    done: svg('<path d="m4.5 12.5 5 5 10-11"/>'),
    error: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>'),
  });

  ns.MESSAGES = Object.freeze({
    LOGIN: "Instagram oturumu bulunamadı. Lütfen giriş yapıp tekrar deneyin.",
    RATE_LIMIT: "Instagram çok fazla istek aldı. Biraz bekleyip tekrar deneyin.",
    NOT_FOUND: "Bu içerik için indirilebilir medya bulunamadı.",
    NO_SHORTCODE: "İçeriğin bağlantısı tespit edilemedi. Gönderiyi açıp tekrar deneyin.",
    STORY_NOT_FOUND: "Hikâye bulunamadı. Süresi dolmuş olabilir.",
    CONTEXT_INVALIDATED: "MarkaClip güncellendi. Sayfayı yenileyip tekrar deneyin.",
    DOWNLOAD_FAILED: "İndirme başlatılamadı.",
    GENERIC: "Bir şeyler ters gitti. Tekrar deneyin.",
  });

  class MarkaClipError extends Error {
    constructor(code, detail) {
      super(ns.MESSAGES[code] || ns.MESSAGES.GENERIC);
      this.name = "MarkaClipError";
      this.code = code;
      this.detail = detail;
    }
  }
  ns.MarkaClipError = MarkaClipError;
})();
