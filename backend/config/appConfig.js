const META_ICON = "\u{1F3AF}";
const DEFAULT_ICON = "\u{1F4E6}";
const PIN_REGEX = /^\d{4}$/;
const PIN_VALIDATION_MESSAGE = "La clave debe ser un PIN numerico de 4 digitos";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5500/frontend").replace(/\/+$/, "");
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || "soporte@dinamicash.local";
const TOKEN_TTL_HOURS = { verify_email: 24, password_reset: 1, email_change: 24 };
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "dinamicash_session";
const SESSION_TTL_DAYS = Math.max(1, Number(process.env.SESSION_TTL_DAYS || 7));
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const SECURE_COOKIES = String(process.env.SECURE_COOKIES || process.env.NODE_ENV === "production").toLowerCase() === "true";
const LOGIN_MAX_ATTEMPTS = Math.max(3, Number(process.env.LOGIN_MAX_ATTEMPTS || 5));
const LOGIN_BLOCK_MINUTES = Math.max(1, Number(process.env.LOGIN_BLOCK_MINUTES || 15));
const LOGIN_WINDOW_MS = LOGIN_BLOCK_MINUTES * 60 * 1000;
const MAX_TEXT_LENGTH = 255;
const DEFAULT_CATEGORIES = [
  { nombre: "Vivienda", icono: "\u{1F3E0}" },
  { nombre: "Alimentacion", icono: "\u{1F37D}\uFE0F" },
  { nombre: "Transporte", icono: "\u{1F697}" },
  { nombre: "Servicios", icono: "\u{1F4A1}" },
  { nombre: "Salud", icono: "\u{1FA7A}" },
  { nombre: "Educacion", icono: "\u{1F4DA}" },
  { nombre: "Entretenimiento", icono: "\u{1F3AC}" },
  { nombre: "Compras", icono: "\u{1F6CD}\uFE0F" },
  { nombre: "Deudas", icono: "\u{1F4B3}" },
  { nombre: "Ahorro", icono: "\u{1F4B0}" },
  { nombre: "Regalos", icono: "\u{1F381}" },
  { nombre: "Viajes", icono: "\u2708\uFE0F" },
  { nombre: "Mascotas", icono: "\u{1F43E}" },
  { nombre: "Ropa", icono: "\u{1F455}" },
  { nombre: "Otros", icono: DEFAULT_ICON }
];

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_ICON,
  FRONTEND_URL,
  LOGIN_BLOCK_MINUTES,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  MAX_TEXT_LENGTH,
  META_ICON,
  PIN_REGEX,
  PIN_VALIDATION_MESSAGE,
  SECURE_COOKIES,
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  SESSION_TTL_MS,
  SUPPORT_EMAIL,
  TOKEN_TTL_HOURS
};
