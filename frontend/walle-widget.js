(function () {
  const WALLE_ASSETS = {
    happy: "assets/walle-happy.svg",
    guide: "assets/walle-happy.svg",
    alert: "assets/walle-alert.svg",
    motivate: "assets/walle-motivate.svg"
  };

  function createBubble(message, mood) {
    const bubble = document.createElement("div");
    bubble.className = "walle-bubble";
    bubble.dataset.mood = mood || "happy";
    bubble.textContent = message || "";
    return bubble;
  }

  function createWalleWidget(options = {}) {
    const {
      message = "",
      mood = "happy",
      compact = false,
      showBubble = true,
      showClose = false,
      onClose = null,
      extraClass = ""
    } = options;

    const root = document.createElement("div");
    root.className = `walle-widget${compact ? " is-compact" : ""}${extraClass ? ` ${extraClass}` : ""}`;
    root.dataset.mood = mood;

    const mascotWrap = document.createElement("div");
    mascotWrap.className = "walle-mascot-wrap";

    const mascot = document.createElement("img");
    mascot.className = "walle-mascot";
    mascot.src = WALLE_ASSETS[mood] || WALLE_ASSETS.happy;
    mascot.alt = "Walle, tu companero financiero";
    mascotWrap.appendChild(mascot);

    if (showClose) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "walle-close";
      close.setAttribute("aria-label", "Cerrar mensaje de Walle");
      close.textContent = "x";
      close.addEventListener("click", () => {
        if (typeof onClose === "function") onClose();
      });
      mascotWrap.appendChild(close);
    }

    root.appendChild(mascotWrap);

    if (showBubble) {
      root.appendChild(createBubble(message, mood));
    }

    root.setMessage = (nextMessage, nextMood = mood) => {
      root.dataset.mood = nextMood;
      mascot.src = WALLE_ASSETS[nextMood] || WALLE_ASSETS.happy;
      const bubble = root.querySelector(".walle-bubble");
      if (bubble) {
        bubble.dataset.mood = nextMood;
        bubble.textContent = nextMessage || "";
      }
    };

    return root;
  }

  window.WalleWidget = {
    create: createWalleWidget
  };
})();
