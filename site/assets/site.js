(() => {
  const syncThemeLinks = () => {
    const requested = new URLSearchParams(window.location.search).get("scoutTheme");
    if (requested !== "dark" && requested !== "light") return;
    for (const link of document.querySelectorAll("a[href]")) {
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin) continue;
      target.searchParams.set("scoutTheme", requested);
      link.href = target.href;
    }
  };
  syncThemeLinks();
  const themeButton = document.querySelector(".theme-toggle");
  if (themeButton) {
    const updateLabel = () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      themeButton.setAttribute("aria-label", `Switch to ${next} theme`);
    };
    updateLabel();
    themeButton.hidden = false;
    themeButton.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      const url = new URL(window.location.href);
      url.searchParams.set("scoutTheme", next);
      window.history.replaceState(null, "", url);
      syncThemeLinks();
      updateLabel();
    });
  }

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const activateTab = (selected) => {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
    }
  };
  if (tabs.length) {
    document.querySelector(".demo-tabs").hidden = false;
    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === "Home") next = tabs[0];
        if (event.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        activateTab(next);
        next.focus();
      });
    }
  }

  const copyButtons = [...document.querySelectorAll("[data-copy]")];
  if (window.isSecureContext && navigator.clipboard) {
    for (const copyButton of copyButtons) {
      copyButton.hidden = false;
      copyButton.addEventListener("click", async () => {
        const status = document.getElementById(copyButton.dataset.copyStatus ?? "copy-status");
        try {
          await navigator.clipboard.writeText(document.getElementById(copyButton.dataset.copy).textContent);
          status.textContent = "Copied to clipboard.";
        } catch (error) {
          console.error("Could not copy the displayed command.", error);
          status.textContent = "Copy was blocked by the browser. Select and copy the command manually.";
        }
      });
    }
  }
})();
