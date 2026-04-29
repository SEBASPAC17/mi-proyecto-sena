const API_URL = window.DinamicashApi?.getBaseUrl?.() || "http://localhost:3000";
const i18n = window.DinamicashI18n;

i18n?.applyTranslations();

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await login();
});

async function login() {
  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value.trim();
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

    const userConfigKey = `dinamicash_config_${data.usuario.id_usuario}`;
    const savedConfig = JSON.parse(localStorage.getItem(userConfigKey) || "{}");
    i18n?.setPreferredLanguage(savedConfig.language || i18n.getPreferredLanguage());
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    alert(i18n?.t("loginServerError") || "No se pudo conectar con el servidor");
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
