const APP_LANGUAGE_KEY = "dinamicash_language";
const USER_CONFIG_KEY = "dinamicash_config";
const SUPPORTED_LANGUAGES = ["es", "en", "pt"];

const PUBLIC_TEXT = {
  es: {
    appName: "Dinamicash Wallet",
    loginPageTitle: "Login - Dinamicash Wallet",
    loginHeading: "Iniciar sesion",
    email: "Correo",
    password: "PIN de 4 digitos",
    loginButton: "Ingresar",
    registerLink: "Registrarse",
    forgotPassword: "Olvidaste tu PIN?",
    forgotPrompt: "Ingresa tu correo",
    loginRequired: "Completa todos los campos",
    invalidCredentials: "Credenciales incorrectas",
    loginServerError: "No se pudo conectar con el servidor",
    recoverySent: "Solicitud enviada",
    recoveryError: "No se pudo procesar la solicitud",
    registerPageTitle: "Registro - Dinamicash Wallet",
    registerHeading: "Registro",
    name: "Nombre",
    registerButton: "Registrarse",
    registerRequired: "Completa todos los campos",
    registerPasswordMin: "El PIN debe tener exactamente 4 digitos numericos",
    registerError: "No se pudo registrar",
    registerSuccess: "Usuario creado correctamente",
    registerServerError: "No se pudo conectar con el servidor",
    redirecting: "Redirigiendo a login..."
  },
  en: {
    appName: "Dinamicash Wallet",
    loginPageTitle: "Login - Dinamicash Wallet",
    loginHeading: "Sign in",
    email: "Email",
    password: "4-digit PIN",
    loginButton: "Enter",
    registerLink: "Create account",
    forgotPassword: "Forgot your PIN?",
    forgotPrompt: "Enter your email",
    loginRequired: "Complete all fields",
    invalidCredentials: "Incorrect credentials",
    loginServerError: "Could not connect to the server",
    recoverySent: "Request sent",
    recoveryError: "Could not process the request",
    registerPageTitle: "Register - Dinamicash Wallet",
    registerHeading: "Register",
    name: "Name",
    registerButton: "Create account",
    registerRequired: "Complete all fields",
    registerPasswordMin: "PIN must be exactly 4 numeric digits",
    registerError: "Could not register",
    registerSuccess: "User created successfully",
    registerServerError: "Could not connect to the server",
    redirecting: "Redirecting to login..."
  },
  pt: {
    appName: "Dinamicash Wallet",
    loginPageTitle: "Login - Dinamicash Wallet",
    loginHeading: "Entrar",
    email: "E-mail",
    password: "PIN de 4 digitos",
    loginButton: "Acessar",
    registerLink: "Criar conta",
    forgotPassword: "Esqueceu seu PIN?",
    forgotPrompt: "Digite seu e-mail",
    loginRequired: "Preencha todos os campos",
    invalidCredentials: "Credenciais incorretas",
    loginServerError: "Nao foi possivel conectar ao servidor",
    recoverySent: "Solicitacao enviada",
    recoveryError: "Nao foi possivel processar a solicitacao",
    registerPageTitle: "Cadastro - Dinamicash Wallet",
    registerHeading: "Cadastro",
    name: "Nome",
    registerButton: "Cadastrar",
    registerRequired: "Preencha todos os campos",
    registerPasswordMin: "O PIN deve ter exatamente 4 digitos numericos",
    registerError: "Nao foi possivel cadastrar",
    registerSuccess: "Usuario criado com sucesso",
    registerServerError: "Nao foi possivel conectar ao servidor",
    redirecting: "Redirecionando para o login..."
  }
};

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "es";
}

function readUserConfigLanguage() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
    if (!usuario?.id_usuario) {
      return null;
    }
    const config = JSON.parse(localStorage.getItem(`${USER_CONFIG_KEY}_${usuario.id_usuario}`) || "{}");
    return normalizeLanguage(config.language);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function getPreferredLanguage() {
  try {
    const stored = localStorage.getItem(APP_LANGUAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.error(error);
  }

  const userLanguage = readUserConfigLanguage();
  if (userLanguage) {
    return userLanguage;
  }

  const browserLanguage = (navigator.language || "es").slice(0, 2);
  return normalizeLanguage(browserLanguage);
}

function setPreferredLanguage(language) {
  const normalized = normalizeLanguage(language);
  localStorage.setItem(APP_LANGUAGE_KEY, normalized);
  document.documentElement.lang = normalized;
  return normalized;
}

function getPublicText(language = getPreferredLanguage()) {
  const normalized = normalizeLanguage(language);
  return PUBLIC_TEXT[normalized] || PUBLIC_TEXT.es;
}

function t(key, language = getPreferredLanguage()) {
  const texts = getPublicText(language);
  return texts[key] || PUBLIC_TEXT.es[key] || key;
}

function applyTranslations() {
  const language = setPreferredLanguage(getPreferredLanguage());
  const texts = getPublicText(language);

  document.title = texts[document.body?.dataset.pageTitle] || document.title;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (texts[key]) {
      element.textContent = texts[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (texts[key]) {
      element.placeholder = texts[key];
    }
  });
}

window.DinamicashI18n = {
  APP_LANGUAGE_KEY,
  getPreferredLanguage,
  setPreferredLanguage,
  getPublicText,
  t,
  applyTranslations
};
