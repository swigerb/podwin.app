(() => {
  const requested = new URLSearchParams(window.location.search).get("scoutTheme");
  const theme = requested === "light" || requested === "dark"
    ? requested
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
})();
