(() => {
  const DEFAULT_PORT = "3000";
  const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

  function getBaseUrl() {
    const { protocol, hostname, port, origin } = window.location;
    const isHttp = protocol === "http:" || protocol === "https:";
    const isLoopback = LOOPBACK_HOSTS.has(hostname);

    if (isHttp && isLoopback && port === DEFAULT_PORT) {
      return origin;
    }

    if (isLoopback) {
      return `${protocol}//${hostname}:${DEFAULT_PORT}`;
    }

    return `http://localhost:${DEFAULT_PORT}`;
  }

  window.DinamicashApi = {
    getBaseUrl
  };
})();
