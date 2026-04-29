(function () {
  const state = {
    overlayHost: null,
    overlayWidget: null,
    onboardingHost: null,
    onboardingWidget: null,
    loaderHost: null,
    loaderWidget: null,
    hideTimer: null
  };

  function ensureOverlay() {
    if (!state.overlayHost) {
      state.overlayHost = document.getElementById("walleOverlay");
    }
    return state.overlayHost;
  }

  function mountWidget(host, options) {
    if (!host || !window.WalleWidget?.create) return null;
    host.innerHTML = "";
    const widget = window.WalleWidget.create(options);
    host.appendChild(widget);
    return widget;
  }

  function inferMoodFromMessage(message) {
    const text = String(message || "").toLowerCase();
    if (text.includes("ojo") || text.includes("gasto")) return "alert";
    if (text.includes("ahorra") || text.includes("meta")) return "motivate";
    if (text.includes("hola") || text.includes("bienvenido")) return "guide";
    return "happy";
  }

  const api = {
    init() {
      const overlay = ensureOverlay();
      if (overlay && !state.overlayWidget) {
        state.overlayWidget = mountWidget(overlay, {
          message: "",
          mood: "happy",
          showBubble: true,
          showClose: true,
          onClose: () => api.hideOverlay()
        });
      }

      state.onboardingHost = document.getElementById("walleOnboardingDock");
      if (state.onboardingHost && !state.onboardingWidget) {
        state.onboardingWidget = mountWidget(state.onboardingHost, {
          message: "Hola! Soy Walle, tu companero financiero",
          mood: "guide",
          compact: true,
          showBubble: true
        });
      }

      state.loaderHost = document.getElementById("walleLoaderDock");
      if (state.loaderHost && !state.loaderWidget) {
        state.loaderWidget = mountWidget(state.loaderHost, {
          message: "Cargando tu mejor version financiera...",
          mood: "guide",
          compact: true,
          showBubble: true,
          extraClass: "is-running"
        });
      }
    },

    showOverlay(message, options = {}) {
      const overlay = ensureOverlay();
      if (!overlay) return;

      if (!state.overlayWidget) {
        api.init();
      }

      const mood = options.mood || inferMoodFromMessage(message);
      overlay.hidden = false;
      overlay.classList.add("visible");
      state.overlayWidget?.setMessage(message, mood);
      overlay.dataset.mood = mood;

      clearTimeout(state.hideTimer);
      if (options.autoHide !== false) {
        state.hideTimer = setTimeout(() => api.hideOverlay(), options.duration || 3600);
      }
    },

    hideOverlay() {
      const overlay = ensureOverlay();
      if (!overlay) return;
      overlay.classList.remove("visible");
      overlay.hidden = true;
      clearTimeout(state.hideTimer);
    },

    updateLoader(message) {
      if (!state.loaderWidget) api.init();
      state.loaderWidget?.setMessage(message, "guide");
    },

    syncOnboarding(step) {
      if (!state.onboardingWidget) api.init();
      if (!step) return;

      const message = step.walleMessage || step.body || "Aqui estare para ayudarte.";
      const mood = step.walleMood || inferMoodFromMessage(message);
      state.onboardingWidget?.setMessage(message, mood);
    }
  };

  window.WalleController = api;
  window.showWalleMessage = function showWalleMessage(message, options) {
    api.showOverlay(message, options);
  };
})();
