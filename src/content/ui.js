// DOM pieces MarkaClip adds to Instagram: the download button and toasts.
(() => {
  const ns = globalThis.MarkaClip;
  const { ICONS } = ns;

  const RESET_DELAY_MS = { done: 1800, error: 2400 };
  const TOAST_DURATION_MS = 3200;

  /**
   * @param {"reel" | "post" | "story" | "floating"} variant
   * @returns {HTMLButtonElement}
   */
  function createButton(variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mc-btn mc-btn--${variant}`;
    button.dataset.state = "idle";
    const label = variant === "post" ? "İndir (Shift + tık: tüm albüm)" : "İndir";
    button.setAttribute("aria-label", `MarkaClip ile indir`);
    button.title = `MarkaClip · ${label}`;
    button.innerHTML = ICONS.download;
    if (variant === "floating") {
      button.insertAdjacentHTML("beforeend", '<span class="mc-btn__text">İndir</span>');
    }
    return button;
  }

  /** @param {HTMLButtonElement} button @param {"idle"|"loading"|"done"|"error"} state */
  function setState(button, state) {
    clearTimeout(button._mcReset);
    button.dataset.state = state;
    button.setAttribute("aria-busy", String(state === "loading"));
    const icon = state === "idle" ? ICONS.download : ICONS[state];
    button.querySelector("svg")?.remove();
    button.insertAdjacentHTML("afterbegin", icon);

    if (state === "done" || state === "error") {
      button._mcReset = setTimeout(() => setState(button, "idle"), RESET_DELAY_MS[state]);
    }
  }

  let toastEl = null;
  let toastTimer = 0;

  /** @param {string} message @param {"success" | "error"} kind */
  function toast(message, kind = "success") {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.className = "mc-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.append(toastEl);
    }
    toastEl.dataset.kind = kind;
    toastEl.innerHTML = '<span class="mc-toast__dot"></span><span class="mc-toast__brand">MarkaClip</span><span class="mc-toast__msg"></span>';
    toastEl.querySelector(".mc-toast__msg").textContent = message;
    toastEl.classList.add("mc-toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("mc-toast--visible"), TOAST_DURATION_MS);
  }

  ns.ui = Object.freeze({ createButton, setState, toast });
})();
