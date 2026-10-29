// Entry point: watches Instagram's DOM and places a download button next to
// the Save icon (Reels column, feed/post action row) and in the story header.
(() => {
  const ns = globalThis.MarkaClip;
  if (ns.started) return;
  ns.started = true;

  const { LABELS, SELECTORS, MESSAGES, ui, resolver, MarkaClipError } = ns;

  const SCAN_DELAY_MS = 300;
  const MAX_BAR_DEPTH = 8;
  const MAX_SCOPE_DEPTH = 15;
  const FLOATING_AFTER_MISSES = 3;
  const STORY_PREFIX = "/stories/";
  const BAR_ATTR = "data-markaclip-bar";
  const SWALLOWED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"];

  const labelOf = (svg) => (svg.getAttribute("aria-label") || "").trim().toLowerCase();
  const isSaveIcon = (svg) => LABELS.save.includes(labelOf(svg)) || !!svg.querySelector(SELECTORS.saveShape);
  const isLikeIcon = (svg) => LABELS.like.includes(labelOf(svg)) || !!svg.querySelector(SELECTORS.likeShape);
  const isVisible = (el) => el.getBoundingClientRect().width > 0;

  /** Smallest ancestor of the Save icon that also holds the Like icon = the action bar. */
  function findActionBar(saveIcon) {
    let node = saveIcon.parentElement;
    for (let depth = 0; node && depth < MAX_BAR_DEPTH; depth += 1, node = node.parentElement) {
      const like = [...node.querySelectorAll("svg")].find(isLikeIcon);
      if (like) return { bar: node, like };
    }
    return null;
  }

  function childOf(ancestor, el) {
    let node = el;
    while (node && node.parentElement !== ancestor) node = node.parentElement;
    return node;
  }

  /** Element that contains this button's media and links (post article, reel container, ...). */
  function mediaScope(bar) {
    const article = bar.closest("article");
    if (article) return article;
    let node = bar.parentElement;
    for (let depth = 0; node && depth < MAX_SCOPE_DEPTH; depth += 1, node = node.parentElement) {
      if (node.querySelector("video")) return node;
    }
    return bar.closest('[role="dialog"]') || document.querySelector("main");
  }

  function postContext(button, type) {
    const bar = button.closest(`[${BAR_ATTR}]`) ?? button.parentElement;
    const inFeedArticle = !!bar.closest("article") && !bar.closest('[role="dialog"]');
    return { type, scope: mediaScope(bar), preferUrl: type === "reel" || !inFeedArticle };
  }

  async function sendToBackground(files) {
    if (!globalThis.chrome?.runtime?.id) throw new MarkaClipError("CONTEXT_INVALIDATED");
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "markaclip:download", files });
    } catch (err) {
      const invalidated = /context invalidated/i.test(err?.message ?? "");
      throw new MarkaClipError(invalidated ? "CONTEXT_INVALIDATED" : "DOWNLOAD_FAILED", err);
    }
    if (!response?.ok) throw new MarkaClipError("DOWNLOAD_FAILED", response?.error);
  }

  async function download(button, ctx, all) {
    if (button.dataset.state === "loading") return;
    ui.setState(button, "loading");
    try {
      const files = await resolver.resolve(ctx, { all });
      await sendToBackground(files);
      ui.setState(button, "done");
      ui.toast(files.length > 1 ? `${files.length} dosya indiriliyor` : "İndirme başladı");
    } catch (err) {
      console.error("[MarkaClip]", err, err?.detail);
      ui.setState(button, "error");
      ui.toast(err instanceof MarkaClipError ? err.message : MESSAGES.GENERIC, "error");
    }
  }

  function bindButton(button, getContext) {
    // Keep Instagram from treating our clicks as taps on the post/story underneath.
    SWALLOWED_EVENTS.forEach((type) => button.addEventListener(type, (e) => e.stopPropagation()));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      download(button, getContext(), event.shiftKey);
    });
  }

  function injectReel(bar, saveIcon) {
    const slot = childOf(bar, saveIcon);
    if (!slot) return;
    const wrapper = document.createElement("div");
    // Reuse the Save slot's own classes so spacing matches the native column.
    wrapper.className = `${slot.className} mc-slot mc-slot--reel`.trim();
    const button = ui.createButton("reel");
    wrapper.append(button);
    slot.after(wrapper);
    bindButton(button, () => postContext(button, "reel"));
  }

  function injectPost(bar, saveIcon) {
    const closestControl = saveIcon.closest('[role="button"], button');
    const saveControl = closestControl && bar.contains(closestControl) ? closestControl : saveIcon.parentElement;
    const host = saveControl?.parentElement;
    if (!host || !bar.contains(host)) return;
    host.classList.add("mc-host-row");
    const button = ui.createButton("post");
    host.insertBefore(button, saveControl);
    bindButton(button, () => postContext(button, "post"));
  }

  function injectForSaveIcon(saveIcon) {
    const found = findActionBar(saveIcon);
    if (!found || !isVisible(saveIcon)) return;
    const { bar, like } = found;
    if (bar.querySelector(".mc-btn")) return;

    bar.setAttribute(BAR_ATTR, "");
    const likeRect = like.getBoundingClientRect();
    const saveRect = saveIcon.getBoundingClientRect();
    const isVertical = Math.abs(saveRect.top - likeRect.top) > Math.abs(saveRect.left - likeRect.left);
    if (isVertical) injectReel(bar, saveIcon);
    else injectPost(bar, saveIcon);
  }

  function saveIconCandidates() {
    const labelled = [...document.querySelectorAll("svg[aria-label]")].filter(isSaveIcon);
    const shaped = [...document.querySelectorAll(SELECTORS.saveShape)].map((el) => el.closest("svg"));
    return new Set([...labelled, ...shaped].filter(Boolean));
  }

  function scanActionBars() {
    for (const svg of saveIconCandidates()) {
      if (svg.closest(`[${BAR_ATTR}]`)?.querySelector(".mc-btn")) continue;
      injectForSaveIcon(svg);
    }
  }

  // --- Stories ---------------------------------------------------------------

  let storyMisses = 0;
  const storyContext = () => ({ type: "story", scope: null });
  const removeAll = (selector) => document.querySelectorAll(selector).forEach((el) => el.remove());

  function findStoryControl() {
    return [...document.querySelectorAll("svg[aria-label]")].find(
      (svg) => LABELS.storyControl.includes(labelOf(svg)) && isVisible(svg)
    );
  }

  function ensureFloatingButton() {
    if (document.querySelector(".mc-btn--floating")) return;
    const button = ui.createButton("floating");
    document.body.append(button);
    bindButton(button, storyContext);
  }

  function scanStory() {
    const control = findStoryControl();
    if (!control) {
      storyMisses += 1;
      if (storyMisses >= FLOATING_AFTER_MISSES) ensureFloatingButton();
      return;
    }
    storyMisses = 0;
    removeAll(".mc-btn--floating");

    const target = control.closest('[role="button"], button') ?? control.parentElement;
    const host = target?.parentElement;
    if (!host || host.querySelector(":scope > .mc-btn--story")) return;

    removeAll(".mc-btn--story");
    host.classList.add("mc-host-row");
    const button = ui.createButton("story");
    host.insertBefore(button, target);
    bindButton(button, storyContext);
  }

  // --- Lifecycle ---------------------------------------------------------------

  let scanScheduled = false;

  function scan() {
    scanScheduled = false;
    if (location.pathname.startsWith(STORY_PREFIX)) {
      scanStory();
      return;
    }
    storyMisses = 0;
    removeAll(".mc-btn--story, .mc-btn--floating");
    scanActionBars();
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(scan, SCAN_DELAY_MS);
  }

  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  scheduleScan();
})();
