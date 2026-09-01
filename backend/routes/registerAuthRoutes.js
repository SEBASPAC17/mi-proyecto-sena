function registerAuthRoutes(app, deps) {
  const {
    bcrypt,
    pool,
    requireAuth,
    clearLoginAttempts,
    clearSessionCookie,
    createBiometricLoginToken,
    createEmailToken,
    createSession,
    ensureDefaultCategoriesForUser,
    enviarError,
    findBiometricLoginToken,
    findValidToken,
    getActiveLoginBlock,
    isValidEmail,
    isValidName,
    isValidPin,
    logAuditEvent,
    markTokenUsed,
    normalizeEmail,
    PIN_VALIDATION_MESSAGE,
    registerFailedLogin,
    revokeAllSessionsForUser,
    revokeBiometricTokensForUser,
    revokeSessionByToken,
    revokeTokens,
    sanitizeText,
    sendEmailChangeConfirmation,
    sendPasswordChangedEmail,
    sendPasswordResetEmail,
    sendVerificationEmail,
    setSessionCookie,
    touchBiometricLoginToken
  } = deps;

  app.get("/auth/session", requireAuth, async (req, res) => {
    return res.json({ ok: true, usuario: req.usuario });
  });

  app.post("/auth/logout", requireAuth, async (req, res) => {
    try {
      await revokeSessionByToken(req.auth.token);
      clearSessionCookie(res);
      return res.json({ ok: true, mensaje: "Sesion cerrada correctamente" });
    } catch (error) {
      return enviarError(res, error, "No se pudo cerrar la sesion");
    }
  });

  app.post("/auth/biometric/register", requireAuth, async (req, res) => {
    try {
      const token = await createBiometricLoginToken(req.auth.userId, req);
      await logAuditEvent({
        idUsuario: req.auth.userId,
        entidad: "usuarios",
        entidadId: req.auth.userId,
        accion: "activar_huella",
        detalle: { via: "biometric_token" }
      });
      return res.json({ ok: true, token });
    } catch (error) {
      return enviarError(res, error, "No se pudo activar el ingreso con huella");
    }
  });

  app.post("/auth/biometric-login", async (req, res) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      const token = String(req.body?.token || "").trim();

      if (!isValidEmail(correo) || !token) {
        return res.status(400).json({ ok: false, mensaje: "Datos de huella invalidos" });
      }

      const credential = await findBiometricLoginToken(token, correo);
      if (!credential || !credential.email_verificado) {
        return res.status(401).json({ ok: false, mensaje: "No se pudo validar la huella para esta cuenta" });
      }

      await ensureDefaultCategoriesForUser(credential.id_usuario);
      await touchBiometricLoginToken(credential.id);

      const sessionToken = await createSession(credential.id_usuario, req);
      setSessionCookie(res, sessionToken);

      return res.json({
        ok: true,
        success: true,
        usuario: {
          id_usuario: credential.id_usuario,
          nombre: credential.nombre,
          correo: credential.correo,
          datos_autorizados: Number(credential.datos_autorizados) === 1,
          datos_autorizados_en: credential.datos_autorizados_en || null
        }
      });
    } catch (error) {
      return enviarError(res, error, "No se pudo iniciar sesion con huella");
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      const password = String(req.body?.password || "").trim();

      if (!correo || !password) {
        return res.status(400).json({ ok: false, mensaje: "Correo y clave son obligatorios" });
      }
      if (!isValidEmail(correo)) {
        return res.status(400).json({ ok: false, mensaje: "Ingresa un correo valido" });
      }
      if (!isValidPin(password)) {
        return res.status(400).json({ ok: false, mensaje: PIN_VALIDATION_MESSAGE });
      }

      const loginBlock = getActiveLoginBlock(req, correo);
      if (loginBlock?.blockedUntil && loginBlock.blockedUntil > Date.now()) {
        const minutos = Math.ceil((loginBlock.blockedUntil - Date.now()) / 60000);
        return res.status(429).json({ ok: false, mensaje: `Demasiados intentos fallidos. Intenta nuevamente en ${minutos} minuto(s).` });
      }

      const [results] = await pool.query(
        "SELECT id_usuario,nombre,correo,password,email_verificado,datos_autorizados,datos_autorizados_en FROM usuarios WHERE correo=? LIMIT 1",
        [correo]
      );

      if (results.length === 0) {
        registerFailedLogin(req, correo);
        return res.status(401).json({ ok: false, mensaje: "Credenciales incorrectas" });
      }

      const usuario = results[0];
      const passwordValido = await bcrypt.compare(password, usuario.password);
      if (!passwordValido) {
        registerFailedLogin(req, correo);
        return res.status(401).json({ ok: false, mensaje: "Credenciales incorrectas" });
      }

      if (!usuario.email_verificado) {
        return res.status(403).json({ ok: false, requiresVerification: true, mensaje: "Debes confirmar tu correo antes de iniciar sesion" });
      }

      clearLoginAttempts(req, correo);
      await ensureDefaultCategoriesForUser(usuario.id_usuario);

      const sessionToken = await createSession(usuario.id_usuario, req);
      setSessionCookie(res, sessionToken);

      return res.json({
        ok: true,
        success: true,
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          correo: usuario.correo,
          datos_autorizados: Number(usuario.datos_autorizados) === 1,
          datos_autorizados_en: usuario.datos_autorizados_en || null
        }
      });
    } catch (error) {
      return enviarError(res, error, "No se pudo iniciar sesion");
    }
  });

  app.post("/registro", async (req, res) => {
    try {
      const nombre = sanitizeText(req.body?.nombre, 80);
      const correo = normalizeEmail(req.body?.correo);
      const password = String(req.body?.password || "").trim();

      if (!nombre || !correo || !password) {
        return res.status(400).json({ ok: false, mensaje: "Todos los campos son obligatorios" });
      }
      if (!isValidName(nombre)) {
        return res.status(400).json({ ok: false, mensaje: "Ingresa un nombre valido" });
      }
      if (!isValidEmail(correo)) {
        return res.status(400).json({ ok: false, mensaje: "Ingresa un correo valido" });
      }
      if (!isValidPin(password)) {
        return res.status(400).json({ ok: false, mensaje: PIN_VALIDATION_MESSAGE });
      }

      const [existente] = await pool.query("SELECT id_usuario FROM usuarios WHERE correo=? LIMIT 1", [correo]);
      if (existente.length > 0) {
        return res.status(409).json({ ok: false, mensaje: "Ese correo ya esta registrado" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [resultado] = await pool.query(
        "INSERT INTO usuarios (nombre,correo,password,email_verificado) VALUES (?,?,?,0)",
        [nombre, correo, passwordHash]
      );
      await ensureDefaultCategoriesForUser(resultado.insertId);
      const token = await createEmailToken({ idUsuario: resultado.insertId, correo, tipo: "verify_email" });
      await sendVerificationEmail({ nombre, correo }, token, correo);
      return res.status(201).json({ ok: true, mensaje: "Cuenta creada. Revisa tu correo para confirmarla." });
    } catch (error) {
      return enviarError(res, error, "No se pudo registrar el usuario");
    }
  });

  app.post("/reenviar-verificacion", async (req, res) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      if (!isValidEmail(correo)) {
        return res.status(400).json({ ok: false, mensaje: "Debes ingresar un correo valido" });
      }

      const [users] = await pool.query(
        "SELECT id_usuario,nombre,correo,email_verificado FROM usuarios WHERE correo=? LIMIT 1",
        [correo]
      );

      if (users.length === 0 || users[0].email_verificado) {
        return res.json({ ok: true, mensaje: "Si el correo existe y aun no esta confirmado, enviaremos un nuevo enlace." });
      }

      const usuario = users[0];
      const token = await createEmailToken({ idUsuario: usuario.id_usuario, correo: usuario.correo, tipo: "verify_email" });
      await sendVerificationEmail(usuario, token, usuario.correo);
      return res.json({ ok: true, mensaje: "Si el correo existe y aun no esta confirmado, enviaremos un nuevo enlace." });
    } catch (error) {
      return enviarError(res, error, "No se pudo reenviar la confirmacion");
    }
  });

  app.post("/verificar-correo", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      if (!token) {
        return res.status(400).json({ ok: false, mensaje: "Token invalido" });
      }

      const verifyToken = await findValidToken(token, "verify_email");
      if (verifyToken) {
        await pool.query(
          "UPDATE usuarios SET email_verificado=1,email_verificado_en=NOW(),correo_pendiente=NULL WHERE id_usuario=?",
          [verifyToken.id_usuario]
        );
        await markTokenUsed(verifyToken.id);
        return res.json({ ok: true, mensaje: "Correo confirmado correctamente. Ya puedes iniciar sesion." });
      }

      const changeToken = await findValidToken(token, "email_change");
      if (!changeToken) {
        return res.status(400).json({ ok: false, mensaje: "El enlace no es valido o ya vencio" });
      }

      const nuevoCorreo = normalizeEmail(changeToken.correo);
      const [duplicate] = await pool.query(
        "SELECT id_usuario FROM usuarios WHERE correo=? AND id_usuario<>? LIMIT 1",
        [nuevoCorreo, changeToken.id_usuario]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ ok: false, mensaje: "Ese correo ya esta en uso por otra cuenta" });
      }

      await pool.query(
        "UPDATE usuarios SET correo=?,correo_pendiente=NULL,email_verificado=1,email_verificado_en=NOW() WHERE id_usuario=?",
        [nuevoCorreo, changeToken.id_usuario]
      );
      await markTokenUsed(changeToken.id);
      await logAuditEvent({
        idUsuario: changeToken.id_usuario,
        entidad: "usuarios",
        entidadId: changeToken.id_usuario,
        accion: "confirmar_cambio_correo",
        detalle: { nuevoCorreo }
      });
      return res.json({ ok: true, mensaje: "Tu nuevo correo quedo confirmado correctamente" });
    } catch (error) {
      return enviarError(res, error, "No se pudo confirmar el correo");
    }
  });

  app.post("/recuperar", async (req, res) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      if (!isValidEmail(correo)) {
        return res.status(400).json({ ok: false, mensaje: "Debes ingresar un correo valido" });
      }

      const [users] = await pool.query("SELECT id_usuario,nombre,correo FROM usuarios WHERE correo=? LIMIT 1", [correo]);
      if (users.length > 0) {
        const usuario = users[0];
        const token = await createEmailToken({ idUsuario: usuario.id_usuario, correo: usuario.correo, tipo: "password_reset" });
        await sendPasswordResetEmail(usuario, token);
      }
      return res.json({ ok: true, mensaje: "Si el correo existe, enviaremos instrucciones para restablecer la contrasena." });
    } catch (error) {
      return enviarError(res, error, "No se pudo procesar la solicitud");
    }
  });

  app.post("/restablecer-password", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const passwordNueva = String(req.body?.passwordNueva || "").trim();

      if (!token || !passwordNueva) {
        return res.status(400).json({ ok: false, mensaje: "Debes completar todos los campos" });
      }
      if (!isValidPin(passwordNueva)) {
        return res.status(400).json({ ok: false, mensaje: PIN_VALIDATION_MESSAGE });
      }

      const tokenData = await findValidToken(token, "password_reset");
      if (!tokenData) {
        return res.status(400).json({ ok: false, mensaje: "El enlace no es valido o ya vencio" });
      }

      const passwordHash = await bcrypt.hash(passwordNueva, 10);
      await pool.query("UPDATE usuarios SET password=? WHERE id_usuario=?", [passwordHash, tokenData.id_usuario]);
      await revokeTokens(tokenData.id_usuario, "password_reset");
      await revokeAllSessionsForUser(tokenData.id_usuario);
      await revokeBiometricTokensForUser(tokenData.id_usuario);
      await logAuditEvent({
        idUsuario: tokenData.id_usuario,
        entidad: "usuarios",
        entidadId: tokenData.id_usuario,
        accion: "restablecer_pin",
        detalle: { via: "email_token" }
      });
      await sendPasswordChangedEmail({ nombre: tokenData.nombre, correo: tokenData.correo_actual });
      return res.json({ ok: true, mensaje: "Tu clave fue restablecida correctamente" });
    } catch (error) {
      return enviarError(res, error, "No se pudo restablecer la contrasena");
    }
  });
}

module.exports = registerAuthRoutes;
