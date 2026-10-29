// Turns a clicked button's context into concrete files to download.
(() => {
  const ns = globalThis.MarkaClip;
  const { api, MarkaClipError } = ns;

  const POST_PATH = /\/(?:p|reels?|tv)\/([A-Za-z0-9_-]{5,})/;
  const NON_MEDIA_SEGMENTS = new Set(["audio", "explore"]);
  const STORY_PATH = /^\/stories\/([^/]+)\/(\d+)/;
  const HIGHLIGHT_PATH = /^\/stories\/highlights\/(\d+)/;
  const MAX_DOT_SIZE_PX = 10;
  const MIN_STORY_MEDIA_PX = 200;

  function shortcodeFromPath(path) {
    const match = path?.match(POST_PATH);
    return match && !NON_MEDIA_SEGMENTS.has(match[1]) ? match[1] : null;
  }

  function shortcodeFromLinks(scope) {
    if (!scope) return null;
    for (const link of scope.querySelectorAll("a[href]")) {
      const code = shortcodeFromPath(link.getAttribute("href"));
      if (code) return code;
    }
    return null;
  }

  /**
   * Reels, /p/ pages and modals: the URL names the item in view (page links may point
   * to other posts). Feed articles: the article's own permalink wins.
   */
  function findShortcode(ctx) {
    const fromUrl = shortcodeFromPath(location.pathname);
    const fromLinks = shortcodeFromLinks(ctx.scope);
    return ctx.preferUrl ? fromUrl ?? fromLinks : fromLinks ?? fromUrl;
  }

  const isDot = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.width <= MAX_DOT_SIZE_PX && r.height <= MAX_DOT_SIZE_PX;
  };

  function dotEmphasis(el) {
    const style = getComputedStyle(el);
    const [r, g, b] = (style.backgroundColor.match(/\d+(\.\d+)?/g) || [0, 0, 0]).map(Number);
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    return Number(style.opacity) * (1 + saturation);
  }

  /**
   * Index of the active carousel slide, read from the pagination dots; -1 if unknown.
   * Long albums show a sliding window of dots, so a dot row is only trusted when it
   * has exactly one dot per slide.
   */
  function carouselIndex(scope, slideCount) {
    if (!scope) return -1;
    for (const group of scope.querySelectorAll("div")) {
      const dots = [...group.children];
      if (dots.length < 2 || dots.length !== slideCount || !dots.every(isDot)) continue;

      const classCounts = dots.reduce((m, d) => m.set(d.className, (m.get(d.className) || 0) + 1), new Map());
      if (dots.length > 2 && classCounts.size === 2) {
        const odd = dots.findIndex((d) => classCounts.get(d.className) === 1);
        if (odd >= 0) return odd;
      }
      const scores = dots.map(dotEmphasis);
      const max = Math.max(...scores);
      if (scores.filter((s) => s === max).length === 1) return scores.indexOf(max);
    }
    return -1;
  }

  const safePart = (value) => String(value ?? "").replace(/[^\w.-]+/g, "_").slice(0, 60);

  function buildFiles(entries, { username, id, numbered }) {
    return entries.map((entry) => ({
      url: entry.url,
      filename: [safePart(username) || "instagram", safePart(id), numbered ? String(entry.index + 1) : ""]
        .filter(Boolean)
        .join("_") + `.${entry.ext}`,
    }));
  }

  /** Last resort when the API is unavailable: a direct (non-blob) media URL on the page. */
  function domFallback(scope) {
    const video = scope?.querySelector("video");
    const videoUrl = video?.currentSrc || video?.src;
    if (videoUrl?.startsWith("https://")) return [{ url: videoUrl, ext: "mp4", index: 0 }];
    return [];
  }

  async function resolvePost(ctx, { all }) {
    const code = findShortcode(ctx);
    if (!code) throw new MarkaClipError("NO_SHORTCODE");

    let item;
    try {
      item = await api.getMediaByShortcode(code);
    } catch (err) {
      const fallback = domFallback(ctx.scope);
      if (!fallback.length) throw err;
      return buildFiles(fallback, { username: "", id: code, numbered: false });
    }

    const entries = api.toEntries(item);
    if (!entries.length) throw new MarkaClipError("NOT_FOUND");
    const slideCount = item.carousel_media?.length ?? 1;
    const isCarousel = slideCount > 1;
    const active = isCarousel && !all ? carouselIndex(ctx.scope, slideCount) : -1;
    const activeEntry = entries.find((entry) => entry.index === active);
    const selected = activeEntry ? [activeEntry] : entries;
    return buildFiles(selected, { username: item.user?.username, id: code, numbered: isCarousel });
  }

  function mediaFileName(url) {
    try {
      return new URL(url, location.href).pathname.split("/").pop();
    } catch {
      return "";
    }
  }

  /** Highlights have no item id in the URL, so match the on-screen image/poster against the API items. */
  function matchVisibleItem(items) {
    if (items.length === 1) return items[0];
    const visible = [...document.querySelectorAll("section img, section video")]
      .filter((el) => el.getBoundingClientRect().height >= MIN_STORY_MEDIA_PX)
      .map((el) => mediaFileName(el.currentSrc || el.src || el.poster))
      .filter(Boolean);
    return items.find((item) =>
      (item.image_versions2?.candidates ?? []).some((c) => visible.includes(mediaFileName(c.url)))
    );
  }

  async function resolveStory() {
    const story = location.pathname.match(STORY_PATH);
    const highlight = location.pathname.match(HIGHLIGHT_PATH);

    if (highlight) {
      const item = matchVisibleItem(await api.getReelItems(`highlight:${highlight[1]}`));
      if (!item) throw new MarkaClipError("STORY_NOT_FOUND");
      return buildFiles(api.toEntries(item), { username: item.user?.username, id: `highlight_${item.pk}`, numbered: false });
    }
    if (!story) throw new MarkaClipError("STORY_NOT_FOUND");

    const [, username, storyPk] = story;
    let item;
    try {
      item = await api.getMediaById(storyPk);
    } catch (err) {
      if (err.code === "LOGIN" || err.code === "RATE_LIMIT") throw err;
      item = await api.findStoryItem(username, storyPk);
    }
    const entries = api.toEntries(item);
    if (!entries.length) throw new MarkaClipError("STORY_NOT_FOUND");
    return buildFiles(entries, { username, id: `story_${storyPk}`, numbered: false });
  }

  /**
   * @param {{ type: "reel" | "post" | "story", scope: Element | null }} ctx
   * @param {{ all?: boolean }} options
   * @returns {Promise<{ url: string, filename: string }[]>}
   */
  function resolve(ctx, options = {}) {
    return ctx.type === "story" ? resolveStory() : resolvePost(ctx, options);
  }

  ns.resolver = Object.freeze({ resolve, shortcodeFromPath, carouselIndex, buildFiles });
})();
