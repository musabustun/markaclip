// Thin client for Instagram's private web API, using the logged-in session.
(() => {
  const ns = globalThis.MarkaClip;
  const { MarkaClipError } = ns;

  const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  // Private-account shortcodes carry extra characters after the 11 that encode the id.
  const SHORTCODE_ID_LENGTH = 11;
  const REQUEST_TIMEOUT_MS = 15000;

  /** @param {string} shortcode @returns {string} numeric media id */
  function shortcodeToMediaId(shortcode) {
    let id = 0n;
    for (const char of shortcode.slice(0, SHORTCODE_ID_LENGTH)) {
      const value = SHORTCODE_ALPHABET.indexOf(char);
      if (value < 0) throw new MarkaClipError("NO_SHORTCODE", `invalid char "${char}"`);
      id = id * 64n + BigInt(value);
    }
    return id.toString();
  }

  /** @param {string} mediaId @returns {string} */
  function mediaIdToShortcode(mediaId) {
    let id = BigInt(mediaId);
    let code = "";
    while (id > 0n) {
      code = SHORTCODE_ALPHABET[Number(id % 64n)] + code;
      id /= 64n;
    }
    return code;
  }

  function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function igFetch(path) {
    let response;
    try {
      response = await fetch(`https://www.instagram.com${path}`, {
        credentials: "include",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "X-IG-App-ID": ns.IG_APP_ID,
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": readCookie("csrftoken"),
        },
      });
    } catch (err) {
      throw new MarkaClipError("GENERIC", err);
    }
    if (response.status === 401 || response.status === 403) throw new MarkaClipError("LOGIN");
    if (response.status === 429) throw new MarkaClipError("RATE_LIMIT");
    if (response.status === 404) throw new MarkaClipError("NOT_FOUND");
    if (!response.ok) throw new MarkaClipError("GENERIC", `HTTP ${response.status} for ${path}`);

    const data = await response.json().catch(() => null);
    // A login wall comes back as 200 with `require_login`.
    if (!data || data.require_login) throw new MarkaClipError("LOGIN");
    return data;
  }

  async function getMediaById(mediaId) {
    const data = await igFetch(`/api/v1/media/${encodeURIComponent(mediaId)}/info/`);
    const item = data.items?.[0];
    if (!item) throw new MarkaClipError("NOT_FOUND");
    return item;
  }

  const getMediaByShortcode = (shortcode) => getMediaById(shortcodeToMediaId(shortcode));

  async function getUserId(username) {
    const data = await igFetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
    const id = data.data?.user?.id;
    if (!id) throw new MarkaClipError("STORY_NOT_FOUND");
    return id;
  }

  /** @param {string} reelId user id or `highlight:<id>` @returns {Promise<object[]>} */
  async function getReelItems(reelId) {
    const data = await igFetch(`/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(reelId)}`);
    const reel = data.reels?.[reelId] ?? data.reels_media?.[0];
    return reel?.items ?? [];
  }

  async function findStoryItem(username, storyPk) {
    const items = await getReelItems(await getUserId(username));
    const item = items.find((it) => String(it.pk) === storyPk || String(it.id).startsWith(`${storyPk}_`));
    if (!item) throw new MarkaClipError("STORY_NOT_FOUND");
    return item;
  }

  const area = (version) => (version?.width ?? 0) * (version?.height ?? 0);
  const largest = (versions = []) =>
    versions.reduce((best, v) => (v?.url && area(v) >= area(best) ? v : best), null);

  /**
   * Flattens an API item into downloadable files, one per carousel slide.
   * @returns {{ url: string, ext: "mp4" | "jpg", index: number }[]}
   */
  function toEntries(item) {
    const nodes = item?.carousel_media?.length ? item.carousel_media : [item];
    return nodes
      .map((node, index) => {
        const video = largest(node?.video_versions);
        const image = largest(node?.image_versions2?.candidates);
        const source = video ?? image;
        return source ? { url: source.url, ext: video ? "mp4" : "jpg", index } : null;
      })
      .filter(Boolean);
  }

  ns.api = Object.freeze({
    shortcodeToMediaId,
    mediaIdToShortcode,
    getMediaById,
    getMediaByShortcode,
    getReelItems,
    findStoryItem,
    toEntries,
  });
})();
