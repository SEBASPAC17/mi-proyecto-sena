(() => {
  const DEFAULT_PORT = "3000";
  const PRODUCTION_API_URL = "https://refresh-foto-included-sold.trycloudflare.com";
  const API_STORAGE_KEY = "dinamicash_api_url";
  const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

  function cleanUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function getConfiguredApiUrl() {
    return cleanUrl(
      window.DINAMICASH_API_URL ||
      localStorage.getItem(API_STORAGE_KEY) ||
      PRODUCTION_API_URL
    );
  }

  function getSavedApiUrl() {
    return cleanUrl(localStorage.getItem(API_STORAGE_KEY) || "");
  }

  function saveApiUrl(url) {
    const clean = cleanUrl(url);
    if (!clean) {
      localStorage.removeItem(API_STORAGE_KEY);
      return "";
    }
    localStorage.setItem(API_STORAGE_KEY, clean);
    return clean;
  }

  function isPlaceholderUrl(url = getBaseUrl()) {
    return cleanUrl(url) === cleanUrl(PRODUCTION_API_URL);
  }

  function getBaseUrl() {
    const { protocol, hostname, port, origin } = window.location;
    const isHttp = protocol === "http:" || protocol === "https:";
    const isLoopback = LOOPBACK_HOSTS.has(hostname);
    const isCapacitorAndroid = isHttp && hostname === "localhost" && port === "";

    if (isHttp && isLoopback && port === DEFAULT_PORT) {
      return origin;
    }

    if (isLoopback && !isCapacitorAndroid) {
      return `${protocol}//${hostname}:${DEFAULT_PORT}`;
    }

    return getConfiguredApiUrl();
  }

  window.DinamicashApi = {
    getBaseUrl,
    getSavedApiUrl,
    saveApiUrl,
    isPlaceholderUrl
  };
})();
