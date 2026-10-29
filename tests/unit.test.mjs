// Unit tests for MarkaClip's pure logic. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const load = (context, file) => vm.runInContext(readFileSync(new URL(file, root), "utf8"), context, { filename: file });

function contentContext() {
  const context = vm.createContext({ console, URL, location: { href: "https://www.instagram.com/", pathname: "/" } });
  ["src/content/constants.js", "src/content/instagram-api.js", "src/content/ui.js", "src/content/resolver.js"].forEach(
    (file) => load(context, file)
  );
  return context.MarkaClip;
}

function backgroundContext() {
  const noop = { addListener() {} };
  const context = vm.createContext({
    console,
    URL,
    chrome: { runtime: { id: "ext", onMessage: noop, onInstalled: noop }, storage: { sync: {} }, downloads: {} },
  });
  load(context, "src/background.js");
  return context;
}

const mc = contentContext();
const bg = backgroundContext();

test("shortcode converts to the media id it encodes", () => {
  assert.equal(mc.api.shortcodeToMediaId("B"), "1");
  assert.equal(mc.api.shortcodeToMediaId("BA"), "64");
  assert.equal(mc.api.shortcodeToMediaId("_"), "63");
});

test("shortcode ↔ media id round-trips for realistic ids", () => {
  const id = "3478210986514227538";
  const code = mc.api.mediaIdToShortcode(id);
  assert.equal(code.length, 11);
  assert.equal(mc.api.shortcodeToMediaId(code), id);
});

test("private-account shortcodes only use the first 11 characters", () => {
  const code = mc.api.mediaIdToShortcode("3478210986514227538");
  assert.equal(mc.api.shortcodeToMediaId(`${code}ExtraPrivateSuffix`), "3478210986514227538");
});

test("invalid shortcode characters throw a MarkaClipError", () => {
  assert.throws(() => mc.api.shortcodeToMediaId("abc$def"), (err) => err.code === "NO_SHORTCODE");
});

test("toEntries picks the largest video for reels", () => {
  const entries = mc.api.toEntries({
    video_versions: [
      { url: "https://x.cdninstagram.com/small.mp4", width: 480, height: 852 },
      { url: "https://x.cdninstagram.com/large.mp4", width: 1080, height: 1920 },
    ],
    image_versions2: { candidates: [{ url: "https://x.cdninstagram.com/cover.jpg", width: 1080, height: 1920 }] },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(entries)), [{ url: "https://x.cdninstagram.com/large.mp4", ext: "mp4", index: 0 }]);
});

test("toEntries flattens carousels into indexed image/video entries", () => {
  const entries = mc.api.toEntries({
    carousel_media: [
      { image_versions2: { candidates: [{ url: "https://x.fbcdn.net/a.jpg", width: 1080, height: 1350 }] } },
      { video_versions: [{ url: "https://x.fbcdn.net/b.mp4", width: 720, height: 1280 }] },
    ],
  });
  assert.deepEqual(entries.map((e) => [e.ext, e.index]), [["jpg", 0], ["mp4", 1]]);
});

test("toEntries returns nothing for items without media", () => {
  assert.equal(mc.api.toEntries({}).length, 0);
});

test("shortcodeFromPath ignores audio and explore pages", () => {
  assert.equal(mc.resolver.shortcodeFromPath("/reels/DAbc123xYz9/"), "DAbc123xYz9");
  assert.equal(mc.resolver.shortcodeFromPath("/markavio/p/DAbc123xYz9/"), "DAbc123xYz9");
  assert.equal(mc.resolver.shortcodeFromPath("/reels/audio/123456789/"), null);
  assert.equal(mc.resolver.shortcodeFromPath("/explore/tags/reklam/"), null);
});

test("buildFiles names files username_code[_n].ext", () => {
  const files = mc.resolver.buildFiles(
    [{ url: "u1", ext: "jpg", index: 0 }, { url: "u2", ext: "mp4", index: 1 }],
    { username: "markavio", id: "DAbc123", numbered: true }
  );
  assert.deepEqual(files.map((f) => f.filename), ["markavio_DAbc123_1.jpg", "markavio_DAbc123_2.mp4"]);
});

test("background only accepts Instagram CDN https URLs", () => {
  assert.equal(bg.isAllowedMediaUrl("https://scontent-ist1-1.cdninstagram.com/v/a.mp4"), true);
  assert.equal(bg.isAllowedMediaUrl("https://instagram.fist4-1.fna.fbcdn.net/v/a.jpg"), true);
  assert.equal(bg.isAllowedMediaUrl("http://scontent.cdninstagram.com/a.mp4"), false);
  assert.equal(bg.isAllowedMediaUrl("https://evil.example.com/cdninstagram.com"), false);
  assert.equal(bg.isAllowedMediaUrl("not a url"), false);
});

test("background strips path traversal from folder and filename", () => {
  assert.equal(bg.sanitizeFolder("../../etc/./Marka:Clip"), "etc/MarkaClip");
  assert.equal(bg.sanitizeFolder(""), "MarkaClip");
  assert.equal(bg.sanitizeFilename("../secret/a.mp4"), "_secret_a.mp4");
});

test("background rejects empty or oversized download requests", () => {
  assert.throws(() => bg.validateFiles([]));
  assert.throws(() => bg.validateFiles(Array(21).fill({ url: "https://a.cdninstagram.com/x.jpg", filename: "x.jpg" })));
  assert.throws(() => bg.validateFiles([{ url: "https://example.com/x.jpg", filename: "x.jpg" }]));
});
