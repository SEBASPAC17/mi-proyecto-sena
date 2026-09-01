let API_URL = window.DinamicashApi?.getBaseUrl?.() || "http://localhost:3000";
const i18n = window.DinamicashI18n;
const REMEMBER_LOGIN_KEY = "dinamicash_remembered_login";
const BIOMETRIC_KEY = "dinamicash_biometric_login";

i18n?.applyTranslations();
initRememberedLogin();

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await login();
});

document.getElementById("biometricLoginBtn")?.addEventListener("click", async () => {
  await loginWithBiometric();
});

function getRememberedLogin() {
  try {
    return normalizeRememberedLogin(JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || "null"));
  } catch (error) {
    console.error(error);
    return null;
  }
}

function normalizeRememberedLogin(value) {
  const correo = String(value?.correo || "").trim();
  if (!correo) {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
    return null;
  }

  if (value?.password) {
    localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
      correo,
      savedAt: value.savedAt || Date.now()
    }));
    localStorage.removeItem(BIOMETRIC_KEY);
  }

  return { correo, savedAt: value?.savedAt || null };
}

function saveRememberedLogin(correo) {
  localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
    correo,
    savedAt: Date.now()
  }));
}

function clearRememberedLogin() {
  localStorage.removeItem(REMEMBER_LOGIN_KEY);
  localStorage.removeItem(BIOMETRIC_KEY);
}

function getBiometricCredential() {
  try {
    return JSON.parse(localStorage.getItem(BIOMETRIC_KEY) || "null");
  } catch (error) {
    console.error(error);
    return null;
  }
}

function setBiometricStatus(message) {
  const status = document.getElementById("biometricStatus");
  if (status) status.textContent = message || "";
}

function getNativeBiometricPlugin() {
  return window.Capacitor?.Plugins?.DinamicashBiometric || window.Capacitor?.Plugins?.DinamicashBiometricPlugin || null;
}

function hasWebAuthnBiometric() {
  return Boolean(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
}

async function isBiometricAvailable() {
  const nativeBiometric = getNativeBiometricPlugin();
  if (nativeBiometric?.isAvailable) {
    try {
      const result = await nativeBiometric.isAvailable();
      return Boolean(result?.available);
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  return hasWebAuthnBiometric();
}

async function updateBiometricButton() {
  const button = document.getElementById("biometricLoginBtn");
  if (!button) return;

  const remembered = getRememberedLogin();
  const credential = getBiometricCredential();
  const available = await isBiometricAvailable();
  button.hidden = !(remembered?.correo && credential?.secureToken && credential?.enabled && available);
}

function initRememberedLogin() {
  const remembered = getRememberedLogin();
  const rememberCheckbox = document.getElementById("recordarme");
  const correoInput = document.getElementById("correo");

  if (remembered?.correo) {
    if (correoInput) correoInput.value = remembered.correo;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  rememberCheckbox?.addEventListener("change", () => {
    if (!rememberCheckbox.checked) {
      clearRememberedLogin();
      updateBiometricButton();
      setBiometricStatus("");
    }
  });

  updateBiometricButton();
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function registerBiometricCredential(correo) {
  const nativeBiometric = getNativeBiometricPlugin();
  if (nativeBiometric?.isAvailable) {
    const available = await isBiometricAvailable();
    if (!available) {
      setBiometricStatus("Tu celular no tiene huella o bloqueo seguro configurado.");
      return false;
    }

    if (nativeBiometric.authenticate) {
      try {
        setBiometricStatus("Confirma con tu huella para activarla.");
        const result = await nativeBiometric.authenticate();
        if (!result?.verified) {
          setBiometricStatus("No se activo la huella. Puedes ingresar con tu PIN.");
          return false;
        }
      } catch (error) {
        console.warn(error);
        setBiometricStatus("No se activo la huella. Puedes ingresar con tu PIN.");
        return false;
      }
    }

    const secureToken = await createBackendBiometricToken();
    if (!secureToken) return false;

    localStorage.setItem(BIOMETRIC_KEY, JSON.stringify({
      correo,
      enabled: true,
      provider: "native",
      secureToken,
      savedAt: Date.now()
    }));
    setBiometricStatus("Huella activada para el proximo ingreso.");
    await updateBiometricButton();
    return true;
  }

  if (!hasWebAuthnBiometric()) {
    setBiometricStatus("Tu dispositivo no permite huella desde esta pantalla.");
    return false;
  }

  const existing = getBiometricCredential();
  if (existing?.correo === correo && existing?.id && existing?.secureToken) {
    updateBiometricButton();
    return true;
  }

  try {
    setBiometricStatus("Activa la huella para este usuario.");
    const userId = new TextEncoder().encode(correo).slice(0, 64);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: "Dinamicash Wallet" },
        user: {
          id: userId,
          name: correo,
          displayName: correo
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    if (!credential?.rawId) return false;
    const secureToken = await createBackendBiometricToken();
    if (!secureToken) return false;

    localStorage.setItem(BIOMETRIC_KEY, JSON.stringify({
      correo,
      enabled: true,
      id: bytesToBase64Url(credential.rawId),
      provider: "webauthn",
      secureToken,
      savedAt: Date.now()
    }));
    setBiometricStatus("Huella activada para el proximo ingreso.");
    await updateBiometricButton();
    return true;
  } catch (error) {
    console.warn(error);
    setBiometricStatus("No se activo la huella. Puedes ingresar con tu PIN.");
    return false;
  }
}

async function createBackendBiometricToken() {
  try {
    const res = await fetch(`${API_URL}/auth/biometric/register`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.token) {
      setBiometricStatus(data.mensaje || "No se pudo activar la huella.");
      return "";
    }
    return data.token;
  } catch (error) {
    console.error(error);
    setBiometricStatus("No se pudo activar la huella.");
    return "";
  }
}

async function verifyBiometricCredential() {
  const credential = getBiometricCredential();
  const nativeBiometric = getNativeBiometricPlugin();

  if (credential?.provider === "native" && nativeBiometric?.authenticate) {
    try {
      setBiometricStatus("Confirma con tu huella.");
      const result = await nativeBiometric.authenticate();
      return Boolean(result?.verified);
    } catch (error) {
      console.warn(error);
      setBiometricStatus("No se pudo validar la huella.");
      return false;
    }
  }

  if (!credential?.id || !hasWebAuthnBiometric()) {
    return false;
  }

  try {
    setBiometricStatus("Confirma con tu huella.");
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{
          type: "public-key",
          id: base64UrlToBytes(credential.id)
        }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return Boolean(assertion);
  } catch (error) {
    console.warn(error);
    setBiometricStatus("No se pudo validar la huella.");
    return false;
  }
}

async function loginWithBiometric() {
  const remembered = getRememberedLogin();
  const credential = getBiometricCredential();
  if (!remembered?.correo || !credential?.secureToken) {
    setBiometricStatus("Primero inicia con Recordar correo activado.");
    return;
  }

  const verified = await verifyBiometricCredential();
  if (!verified) return;

  try {
    const res = await fetch(`${API_URL}/auth/biometric-login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        correo: remembered.correo,
        token: credential.secureToken
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      clearRememberedLogin();
      setBiometricStatus(data.mensaje || "No se pudo iniciar con huella. Ingresa con tu PIN.");
      return;
    }

    const userConfigKey = `dinamicash_config_${data.usuario.id_usuario}`;
    const savedConfig = JSON.parse(localStorage.getItem(userConfigKey) || "{}");
    i18n?.setPreferredLanguage(savedConfig.language || i18n.getPreferredLanguage());
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    setBiometricStatus(getConnectionErrorMessage());
  }
}

async function login(options = {}) {
  const correo = (options.correo || document.getElementById("correo").value).trim();
  const password = (options.password || document.getElementById("password").value).trim();
  const rememberCheckbox = document.getElementById("recordarme");
  const shouldRemember = Boolean(rememberCheckbox?.checked);
  const pinMessage = i18n?.t("registerPasswordMin") || "El PIN debe tener exactamente 4 digitos numericos";

  if (!correo || !password) {
    alert(i18n?.t("loginRequired") || "Completa todos los campos");
    return;
  }

  if (!/^\d{4}$/.test(password)) {
    alert(pinMessage);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ correo, password })
    });

    const data = await res.json();

    if (res.status === 403 && data.requiresVerification) {
      const reenviar = confirm(`${data.mensaje}\n\n¿Quieres que enviemos otro correo de confirmacion?`);
      if (reenviar) {
        await reenviarVerificacion(correo);
      }
      return;
    }

    if (!res.ok || !data.success) {
      alert(data.mensaje || i18n?.t("invalidCredentials") || "Credenciales incorrectas");
      return;
    }

    if (shouldRemember) {
      saveRememberedLogin(correo);
      await registerBiometricCredential(correo);
    } else {
      clearRememberedLogin();
    }

    const userConfigKey = `dinamicash_config_${data.usuario.id_usuario}`;
    const savedConfig = JSON.parse(localStorage.getItem(userConfigKey) || "{}");
    i18n?.setPreferredLanguage(savedConfig.language || i18n.getPreferredLanguage());
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    alert(getConnectionErrorMessage());
  }
}

async function reenviarVerificacion(correo) {
  try {
    const res = await fetch(`${API_URL}/reenviar-verificacion`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ correo })
    });

    const data = await res.json();
    alert(data.mensaje || "Si el correo existe, te enviaremos un nuevo enlace.");
  } catch (error) {
    console.error(error);
    alert(i18n?.t("recoveryError") || "No se pudo procesar la solicitud");
  }
}

function irRegistro() {
  window.location.href = "registro.html";
}

function getConnectionErrorMessage() {
  if (window.DinamicashApi?.isPlaceholderUrl?.(API_URL)) {
    return "No hay servidor disponible para iniciar sesión desde esta instalación.";
  }
  return i18n?.t("loginServerError") || "No se pudo conectar con el servidor";
}

async function olvido() {
  const correo = prompt(i18n?.t("forgotPrompt") || "Ingresa tu correo");

  if (!correo) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/recuperar`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ correo })
    });

    const data = await res.json();
    alert(data.mensaje || i18n?.t("recoverySent") || "Solicitud enviada");
  } catch (error) {
    console.error(error);
    alert(i18n?.t("recoveryError") || "No se pudo procesar la solicitud");
  }
}
