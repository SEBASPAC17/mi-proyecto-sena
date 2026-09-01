const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const registerHealthRoutes = require("./routes/registerHealthRoutes");
const registerAuthRoutes = require("./routes/registerAuthRoutes");
const registerUserRoutes = require("./routes/registerUserRoutes");
const registerCategoryRoutes = require("./routes/registerCategoryRoutes");
const registerMovementRoutes = require("./routes/registerMovementRoutes");
const registerReportRoutes = require("./routes/registerReportRoutes");
const registerGoalRoutes = require("./routes/registerGoalRoutes");
const registerSupportRoutes = require("./routes/registerSupportRoutes");
const {
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
} = require("./config/appConfig");

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (error) {
  console.warn("Nodemailer no esta instalado. Los correos se registraran en consola hasta configurarlo.");
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE_SAMESITE = process.env.SESSION_COOKIE_SAMESITE || (SECURE_COOKIES ? "None" : "Lax");

const loginAttempts = new Map();

if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true") {
  app.set("trust proxy", 1);
}

function safeUrlOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
}

const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const allowTunnelOrigins = String(process.env.ALLOW_TUNNEL_ORIGINS || "").toLowerCase() === "true";
const allowedOrigins = new Set(
  [
    safeUrlOrigin(FRONTEND_URL),
    ...(process.env.CORS_ORIGIN || "").split(",").map((value) => value.trim())
  ].filter(Boolean)
);

if (!isProduction) {
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "null"
  ].forEach((origin) => allowedOrigins.add(origin));
}

app.use(cors({
  origin(origin, callback) {
    const isTryCloudflareOrigin = allowTunnelOrigins && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin || "");
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin) || isTryCloudflareOrigin) {
      callback(null, true);
      return;
    }
    callback(new Error("Origen no permitido por CORS"));
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json({ limit: "20kb" }));
app.use("/frontend", express.static(path.join(__dirname, "..", "frontend")));

app.get("/dinamicash.apk", (req, res) => {
  const apkPath = path.join(__dirname, "..", "dinamicash.apk");
  if (!fs.existsSync(apkPath)) {
    res.status(404).json({ ok: false, mensaje: "APK no encontrado" });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", "attachment; filename=\"dinamicash.apk\"");
  res.sendFile(apkPath, (error) => {
    if (error && !res.headersSent) {
      res.status(500).json({ ok: false, mensaje: "No se pudo descargar el APK" });
    }
  });
});

function enviarError(res, error, mensaje = "Error interno del servidor") {
  console.error(error);
  return res.status(500).json({ ok: false, mensaje });
}

function normalizeEmail(correo = "") {
  return String(correo || "").trim().toLowerCase();
}

function sanitizeText(value = "", maxLength = MAX_TEXT_LENGTH) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isValidEmail(correo = "") {
  if (!correo || correo.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function isValidName(nombre = "") {
  return nombre.length >= 2 && nombre.length <= 80;
}

function isValidPin(value = "") {
  return PIN_REGEX.test(String(value || "").trim());
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

function buildFrontendUrl(page, token) {
  return `${FRONTEND_URL}/${page}?token=${encodeURIComponent(token)}`;
}

function getMailerConfig() {
  const port = Number(process.env.EMAIL_PORT || 587);
  return {
    host: process.env.EMAIL_HOST,
    port,
    secure: String(process.env.EMAIL_SECURE || "").toLowerCase() === "true" || port === 465,
    auth: process.env.EMAIL_USER && process.env.EMAIL_PASS
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      : null,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "no-reply@dinamicash.local"
  };
}

let transporter = null;
function getTransporter() {
  const config = getMailerConfig();
  if (!nodemailer || !config.host || !config.auth) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    });
  }
  return { transporter, from: config.from };
}

async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log("[EMAIL PENDIENTE DE CONFIGURAR]", { to, subject, text, html });
    return { sent: false, simulated: true };
  }
  await mailer.transporter.sendMail({ from: mailer.from, to, subject, text, html });
  return { sent: true, simulated: false };
}

async function revokeTokens(idUsuario, tipo, correo = null) {
  if (correo) {
    await pool.query(
      "UPDATE email_tokens SET usado_en=NOW() WHERE id_usuario=? AND tipo=? AND correo=? AND usado_en IS NULL",
      [idUsuario, tipo, correo]
    );
    return;
  }
  await pool.query(
    "UPDATE email_tokens SET usado_en=NOW() WHERE id_usuario=? AND tipo=? AND usado_en IS NULL",
    [idUsuario, tipo]
  );
}

async function createEmailToken({ idUsuario, correo, tipo }) {
  const token = createToken();
  await revokeTokens(idUsuario, tipo, correo);
  await pool.query(
    "INSERT INTO email_tokens (id_usuario,correo,tipo,token_hash,expira_en) VALUES (?,?,?,?,?)",
    [idUsuario, normalizeEmail(correo), tipo, hashValue(token), addHours(TOKEN_TTL_HOURS[tipo] || 1)]
  );
  return token;
}

async function findValidToken(token, tipo) {
  const [results] = await pool.query(
    `SELECT et.id,et.id_usuario,et.correo,u.nombre,u.correo AS correo_actual,u.correo_pendiente
     FROM email_tokens et
     INNER JOIN usuarios u ON u.id_usuario=et.id_usuario
     WHERE et.token_hash=? AND et.tipo=? AND et.usado_en IS NULL AND et.expira_en>=NOW()
     LIMIT 1`,
    [hashValue(token), tipo]
  );
  return results[0] || null;
}

const markTokenUsed = (id) => pool.query("UPDATE email_tokens SET usado_en=NOW() WHERE id=?", [id]);

async function sendVerificationEmail(usuario, token, correoDestino = usuario.correo) {
  const url = buildFrontendUrl("verificar-correo.html", token);
  return sendEmail({
    to: normalizeEmail(correoDestino),
    subject: "Confirma tu correo en Dinamicash Wallet",
    text: `Hola ${usuario.nombre}\n\nConfirma tu correo aqui:\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje.`,
    html: `<p>Hola ${usuario.nombre}</p><p>Confirma tu correo aqui:</p><p><a href="${url}">${url}</a></p><p>Si no creaste esta cuenta, ignora este mensaje.</p>`
  });
}

async function sendPasswordResetEmail(usuario, token) {
  const url = buildFrontendUrl("reset-password.html", token);
  return sendEmail({
    to: usuario.correo,
    subject: "Restablece tu PIN de Dinamicash Wallet",
    text: `Hola ${usuario.nombre}\n\nUsa este enlace para restablecer tu PIN:\n${url}\n\nEl enlace vence en 1 hora.`,
    html: `<p>Hola ${usuario.nombre}</p><p>Usa este enlace para restablecer tu PIN:</p><p><a href="${url}">${url}</a></p><p>El enlace vence en 1 hora.</p>`
  });
}

async function sendPasswordChangedEmail(usuario) {
  return sendEmail({
    to: usuario.correo,
    subject: "Tu PIN fue actualizado",
    text: `Hola ${usuario.nombre}\n\nEl PIN de tu cuenta fue actualizado. Si no reconoces este cambio, restablecelo de inmediato.`,
    html: `<p>Hola ${usuario.nombre}</p><p>El PIN de tu cuenta fue actualizado. Si no reconoces este cambio, restablecelo de inmediato.</p>`
  });
}

async function sendEmailChangeConfirmation(usuario, nuevoCorreo, token) {
  const url = buildFrontendUrl("verificar-correo.html", token);
  return sendEmail({
    to: nuevoCorreo,
    subject: "Confirma tu nuevo correo en Dinamicash Wallet",
    text: `Hola ${usuario.nombre}\n\nConfirma tu nuevo correo aqui:\n${url}`,
    html: `<p>Hola ${usuario.nombre}</p><p>Confirma tu nuevo correo aqui:</p><p><a href="${url}">${url}</a></p>`
  });
}

async function sendHelpEmails({ nombre, correo, asunto, mensaje }) {
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Dinamicash Wallet] Soporte: ${asunto || "general"}`,
    text: `Nombre: ${nombre}\nCorreo: ${correo}\nAsunto: ${asunto}\n\n${mensaje}`,
    html: `<p><strong>Nombre:</strong> ${nombre}</p><p><strong>Correo:</strong> ${correo}</p><p><strong>Asunto:</strong> ${asunto}</p><p>${String(mensaje).replace(/\n/g, "<br>")}</p>`
  });
  await sendEmail({
    to: correo,
    subject: "Recibimos tu solicitud de ayuda",
    text: `Hola ${nombre}\n\nRecibimos tu solicitud de ayuda y te responderemos pronto.`,
    html: `<p>Hola ${nombre}</p><p>Recibimos tu solicitud de ayuda y te responderemos pronto.</p>`
  });
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [name, ...valueParts] = part.split("=");
      if (name) {
        acc[name] = decodeURIComponent(valueParts.join("="));
      }
      return acc;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAMESITE,
    secure: SECURE_COOKIES,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  }));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAMESITE,
    secure: SECURE_COOKIES,
    path: "/",
    expires: new Date(0),
    maxAge: 0
  }));
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "0.0.0.0";
}

function getSessionCookieToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

async function createSession(idUsuario, req) {
  const token = createToken();
  await pool.query(
    `INSERT INTO user_sessions (id_usuario, token_hash, expires_en, user_agent, ip_address, last_used_en)
     VALUES (?,?,?,?,?,NOW())`,
    [
      idUsuario,
      hashValue(token),
      addSessionDays(SESSION_TTL_DAYS),
      sanitizeText(req.headers["user-agent"] || "", 255),
      sanitizeText(getClientIp(req), 64)
    ]
  );
  return token;
}

async function createBiometricLoginToken(idUsuario, req) {
  const token = createToken();
  await pool.query(
    `INSERT INTO biometric_tokens (id_usuario, token_hash, user_agent, ip_address, last_used_en)
     VALUES (?,?,?,?,NULL)`,
    [
      idUsuario,
      hashValue(token),
      sanitizeText(req.headers["user-agent"] || "", 255),
      sanitizeText(getClientIp(req), 64)
    ]
  );
  return token;
}

async function findBiometricLoginToken(token, correo) {
  if (!token || !correo) return null;
  const [results] = await pool.query(
    `SELECT bt.id, bt.id_usuario, u.nombre, u.correo, u.email_verificado,
            u.datos_autorizados, u.datos_autorizados_en
     FROM biometric_tokens bt
     INNER JOIN usuarios u ON u.id_usuario = bt.id_usuario
     WHERE bt.token_hash=? AND bt.revocado_en IS NULL AND u.correo=?
     LIMIT 1`,
    [hashValue(token), normalizeEmail(correo)]
  );
  return results[0] || null;
}

async function touchBiometricLoginToken(id) {
  await pool.query("UPDATE biometric_tokens SET last_used_en=NOW() WHERE id=?", [id]);
}

async function revokeBiometricTokensForUser(idUsuario) {
  await pool.query("UPDATE biometric_tokens SET revocado_en=NOW() WHERE id_usuario=? AND revocado_en IS NULL", [idUsuario]);
}

async function findSessionByToken(token) {
  if (!token) return null;
  const [results] = await pool.query(
    `SELECT s.id, s.id_usuario, s.expires_en, u.nombre, u.correo, u.email_verificado,
            u.datos_autorizados, u.datos_autorizados_en
     FROM user_sessions s
     INNER JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.token_hash=? AND s.revocado_en IS NULL AND s.expires_en >= NOW()
     LIMIT 1`,
    [hashValue(token)]
  );
  return results[0] || null;
}

async function touchSession(id) {
  await pool.query("UPDATE user_sessions SET last_used_en=NOW() WHERE id=?", [id]);
}

async function revokeSessionByToken(token) {
  if (!token) return;
  await pool.query("UPDATE user_sessions SET revocado_en=NOW() WHERE token_hash=? AND revocado_en IS NULL", [hashValue(token)]);
}

async function revokeAllSessionsForUser(idUsuario) {
  await pool.query("UPDATE user_sessions SET revocado_en=NOW() WHERE id_usuario=? AND revocado_en IS NULL", [idUsuario]);
}

async function logAuditEvent({ idUsuario = null, entidad, entidadId = null, accion, detalle = null }) {
  await pool.query(
    `INSERT INTO audit_logs (id_usuario, entidad, entidad_id, accion, detalle_json)
     VALUES (?, ?, ?, ?, ?)`,
    [idUsuario, entidad, entidadId, accion, detalle ? JSON.stringify(detalle) : null]
  );
}

function getLoginAttemptKey(req, correo = "") {
  return `${getClientIp(req)}:${normalizeEmail(correo) || "anon"}`;
}

function getActiveLoginBlock(req, correo) {
  const key = getLoginAttemptKey(req, correo);
  const entry = loginAttempts.get(key);
  if (!entry) return null;

  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    return entry;
  }

  if (entry.lastFailureAt && Date.now() - entry.lastFailureAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }

  return entry;
}

function registerFailedLogin(req, correo) {
  const key = getLoginAttemptKey(req, correo);
  const entry = getActiveLoginBlock(req, correo) || { count: 0, blockedUntil: 0, lastFailureAt: 0 };
  entry.count += 1;
  entry.lastFailureAt = Date.now();
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(key, entry);
  return entry;
}

function clearLoginAttempts(req, correo) {
  loginAttempts.delete(getLoginAttemptKey(req, correo));
}

async function requireAuth(req, res, next) {
  try {
    const token = getSessionCookieToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, mensaje: "Tu sesion no es valida o ya vencio" });
    }

    const session = await findSessionByToken(token);
    if (!session || !session.email_verificado) {
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, mensaje: "Tu sesion no es valida o ya vencio" });
    }

    req.auth = {
      sessionId: session.id,
      userId: Number(session.id_usuario),
      token
    };
    req.usuario = {
      id_usuario: Number(session.id_usuario),
      nombre: session.nombre,
      correo: session.correo,
      datos_autorizados: Number(session.datos_autorizados) === 1,
      datos_autorizados_en: session.datos_autorizados_en || null
    };

    await touchSession(session.id);
    return next();
  } catch (error) {
    return enviarError(res, error, "No se pudo validar la sesion");
  }
}

function assertOwnUserId(req, res) {
  const routeUserId = Number(req.params.idUsuario);
  if (!Number.isInteger(routeUserId) || routeUserId <= 0) {
    res.status(400).json({ ok: false, mensaje: "Identificador de usuario invalido" });
    return false;
  }
  if (routeUserId !== req.auth.userId) {
    res.status(403).json({ ok: false, mensaje: "No tienes permiso para acceder a esta informacion" });
    return false;
  }
  return true;
}

async function ensureCategorySchema() {
  const [iconColumn] = await pool.query("SHOW COLUMNS FROM categorias LIKE 'icono'");
  if (iconColumn.length === 0) {
    await pool.query("ALTER TABLE categorias ADD COLUMN icono VARCHAR(10) NOT NULL DEFAULT '📦'");
  }
}

async function ensureUserEmailSchema() {
  const requiredColumns = [
    { name: "email_verificado", sql: "ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "email_verificado_en", sql: "ALTER TABLE usuarios ADD COLUMN email_verificado_en DATETIME NULL" },
    { name: "correo_pendiente", sql: "ALTER TABLE usuarios ADD COLUMN correo_pendiente VARCHAR(255) NULL" },
    { name: "datos_autorizados", sql: "ALTER TABLE usuarios ADD COLUMN datos_autorizados TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "datos_autorizados_en", sql: "ALTER TABLE usuarios ADD COLUMN datos_autorizados_en DATETIME NULL" }
  ];
  for (const column of requiredColumns) {
    const [exists] = await pool.query(`SHOW COLUMNS FROM usuarios LIKE '${column.name}'`);
    if (exists.length === 0) {
      await pool.query(column.sql);
    }
  }
}

async function ensureEmailTokenSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_tokens (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NOT NULL,
      correo VARCHAR(255) NOT NULL,
      tipo VARCHAR(40) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expira_en DATETIME NOT NULL,
      usado_en DATETIME NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_tokens_lookup (token_hash,tipo,usado_en,expira_en),
      INDEX idx_email_tokens_user (id_usuario,tipo),
      CONSTRAINT fk_email_tokens_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
    )`
  );
}

async function ensureSessionSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_en DATETIME NOT NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(64) NULL,
      last_used_en DATETIME NULL,
      revocado_en DATETIME NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_sessions_token_hash (token_hash),
      INDEX idx_user_sessions_user (id_usuario, revocado_en, expires_en),
      CONSTRAINT fk_user_sessions_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
    )`
  );
}

async function ensureBiometricTokenSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS biometric_tokens (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(64) NULL,
      last_used_en DATETIME NULL,
      revocado_en DATETIME NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_biometric_tokens_token_hash (token_hash),
      INDEX idx_biometric_tokens_user (id_usuario, revocado_en),
      CONSTRAINT fk_biometric_tokens_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
    )`
  );
}

async function ensureColumn(tableName, columnName, sql) {
  const [exists] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (exists.length === 0) {
    await pool.query(sql);
  }
}

async function ensureAuditSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NULL,
      entidad VARCHAR(60) NOT NULL,
      entidad_id INT NULL,
      accion VARCHAR(60) NOT NULL,
      detalle_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_user (id_usuario, created_at),
      INDEX idx_audit_logs_entity (entidad, entidad_id, created_at)
    )`
  );
}

async function ensureLifecycleSchema() {
  const timestampColumns = [
    { table: "usuarios", column: "created_at", sql: "ALTER TABLE usuarios ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "usuarios", column: "updated_at", sql: "ALTER TABLE usuarios ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    { table: "categorias", column: "created_at", sql: "ALTER TABLE categorias ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "categorias", column: "updated_at", sql: "ALTER TABLE categorias ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    { table: "movimientos", column: "created_at", sql: "ALTER TABLE movimientos ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "movimientos", column: "updated_at", sql: "ALTER TABLE movimientos ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    { table: "movimientos", column: "deleted_at", sql: "ALTER TABLE movimientos ADD COLUMN deleted_at DATETIME NULL" },
    { table: "metas", column: "created_at", sql: "ALTER TABLE metas ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "metas", column: "updated_at", sql: "ALTER TABLE metas ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    { table: "metas", column: "deleted_at", sql: "ALTER TABLE metas ADD COLUMN deleted_at DATETIME NULL" }
  ];

  for (const entry of timestampColumns) {
    await ensureColumn(entry.table, entry.column, entry.sql);
  }
}

function buildMovementFilters({ idUsuario, startDate, endDate, tipo, categoriaId, includeDeleted = false }) {
  const conditions = ["m.id_usuario=?"];
  const params = [idUsuario];

  if (!includeDeleted) {
    conditions.push("m.deleted_at IS NULL");
  }
  if (startDate) {
    conditions.push("DATE(m.fecha) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(m.fecha) <= ?");
    params.push(endDate);
  }
  if (tipo && tipo !== "todos") {
    conditions.push("m.tipo = ?");
    params.push(tipo);
  }
  if (categoriaId) {
    conditions.push("m.categoria_id = ?");
    params.push(categoriaId);
  }

  return {
    whereSql: conditions.join(" AND "),
    params
  };
}

function getMonthRange(year, month) {
  const safeYear = Number(year);
  const safeMonth = Number(month);
  if (!Number.isInteger(safeYear) || !Number.isInteger(safeMonth) || safeMonth < 1 || safeMonth > 12) {
    return null;
  }
  const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
  const end = new Date(Date.UTC(safeYear, safeMonth, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function getPreviousMonth(year, month) {
  const current = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  current.setUTCMonth(current.getUTCMonth() - 1);
  return {
    year: current.getUTCFullYear(),
    month: current.getUTCMonth() + 1
  };
}

async function getReportTotals({ idUsuario, startDate, endDate, tipo = "todos", categoriaId = null }) {
  const filter = buildMovementFilters({ idUsuario, startDate, endDate, tipo, categoriaId });
  const [rows] = await pool.query(
    `SELECT
        COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN m.tipo='gasto' THEN m.monto ELSE 0 END), 0) AS gastos,
        COUNT(*) AS total_movimientos
     FROM movimientos m
     WHERE ${filter.whereSql}`,
    filter.params
  );
  return rows[0] || { ingresos: 0, gastos: 0, total_movimientos: 0 };
}

async function ensureMetaCategory(idUsuario, nombre, icono = META_ICON) {
  const [categoriaExistente] = await pool.query(
    "SELECT id FROM categorias WHERE id_usuario=? AND nombre=? LIMIT 1",
    [idUsuario, nombre]
  );
  if (categoriaExistente.length === 0) {
    await pool.query("INSERT INTO categorias (nombre,icono,id_usuario) VALUES (?,?,?)", [nombre, icono, idUsuario]);
    return;
  }
  await pool.query("UPDATE categorias SET icono=? WHERE id=?", [icono, categoriaExistente[0].id]);
}

function isMissingOrCorruptIcon(icono) {
  const value = String(icono || "").trim();
  return !value || /^\?+$/.test(value) || /Ã|Â|ð|Ÿ|ï|¸|â/.test(value);
}

async function ensureCategorySchema() {
  const [iconColumn] = await pool.query("SHOW COLUMNS FROM categorias LIKE 'icono'");
  if (iconColumn.length === 0) {
    await pool.query(`ALTER TABLE categorias ADD COLUMN icono VARCHAR(10) NOT NULL DEFAULT ${pool.escape(DEFAULT_ICON)}`);
  }
}

async function ensureDefaultCategoriesForUser(idUsuario) {
  for (const categoria of DEFAULT_CATEGORIES) {
    const [existente] = await pool.query(
      "SELECT id,icono FROM categorias WHERE id_usuario=? AND nombre=? LIMIT 1",
      [idUsuario, categoria.nombre]
    );
    if (existente.length === 0) {
      await pool.query("INSERT INTO categorias (nombre,icono,id_usuario) VALUES (?,?,?)", [categoria.nombre, categoria.icono, idUsuario]);
      continue;
    }
    if (isMissingOrCorruptIcon(existente[0].icono)) {
      await pool.query("UPDATE categorias SET icono=? WHERE id=?", [categoria.icono, existente[0].id]);
    }
  }
}

const routeDeps = {
  app,
  assertOwnUserId,
  bcrypt,
  buildMovementFilters,
  calculateReportPayload: require("./utils/reporting").calculateReportPayload,
  clearLoginAttempts,
  clearSessionCookie,
  createEmailToken,
  createBiometricLoginToken,
  createSession,
  DEFAULT_ICON,
  ensureDefaultCategoriesForUser,
  ensureMetaCategory,
  enviarError,
  findValidToken,
  findBiometricLoginToken,
  getActiveLoginBlock,
  getMonthRange,
  getPreviousMonth,
  getReportTotals,
  isValidDateValue,
  isValidEmail,
  isValidName,
  isValidPin,
  logAuditEvent,
  markTokenUsed,
  META_ICON,
  normalizeEmail,
  PIN_VALIDATION_MESSAGE,
  pool,
  registerFailedLogin,
  requireAuth,
  revokeAllSessionsForUser,
  revokeBiometricTokensForUser,
  revokeSessionByToken,
  revokeTokens,
  sanitizeText,
  sendEmailChangeConfirmation,
  sendHelpEmails,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  setSessionCookie,
  touchBiometricLoginToken,
  toMySqlDateTime
};

registerHealthRoutes(app, routeDeps);
registerAuthRoutes(app, routeDeps);
registerUserRoutes(app, routeDeps);
registerCategoryRoutes(app, routeDeps);
registerMovementRoutes(app, routeDeps);
registerReportRoutes(app, routeDeps);
registerGoalRoutes(app, routeDeps);
registerSupportRoutes(app, routeDeps);

async function startServer() {
  try {
    await ensureCategorySchema();
    await ensureUserEmailSchema();
    await ensureLifecycleSchema();
    await ensureEmailTokenSchema();
    await ensureSessionSchema();
    await ensureBiometricTokenSchema();
    await ensureAuditSchema();
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
