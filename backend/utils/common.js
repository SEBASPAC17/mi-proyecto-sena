const crypto = require("crypto");

function safeUrlOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
}

function normalizeEmail(correo = "") {
  return String(correo || "").trim().toLowerCase();
}

function sanitizeText(value = "", maxLength = 255) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isValidEmail(correo = "") {
  if (!correo || correo.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function isValidName(nombre = "") {
  return nombre.length >= 2 && nombre.length <= 80;
}

function isValidPin(value = "", pinRegex = /^\d{4}$/) {
  return pinRegex.test(String(value || "").trim());
}

function isValidDateValue(value = "") {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function toMySqlDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function addHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

function addSessionDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

module.exports = {
  addHours,
  addSessionDays,
  createToken,
  hashValue,
  isValidDateValue,
  isValidEmail,
  isValidName,
  isValidPin,
  normalizeEmail,
  safeUrlOrigin,
  sanitizeText,
  toMySqlDateTime
};
