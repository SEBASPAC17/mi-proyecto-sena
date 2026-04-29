function registerUserRoutes(app, deps) {
  const {
    bcrypt,
    pool,
    requireAuth,
    assertOwnUserId,
    createEmailToken,
    createSession,
    enviarError,
    isValidEmail,
    isValidName,
    isValidPin,
    logAuditEvent,
    normalizeEmail,
    PIN_VALIDATION_MESSAGE,
    revokeAllSessionsForUser,
    revokeTokens,
    sanitizeText,
    sendEmailChangeConfirmation,
    sendPasswordChangedEmail,
    setSessionCookie
  } = deps;

  app.put("/usuarios/:idUsuario", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;

      const nombre = sanitizeText(req.body?.nombre, 80);
      const correo = normalizeEmail(req.body?.correo);
      if (!nombre || !correo) {
        return res.status(400).json({ ok: false, mensaje: "Nombre y correo son obligatorios" });
      }
      if (!isValidName(nombre)) {
        return res.status(400).json({ ok: false, mensaje: "Ingresa un nombre valido" });
      }
      if (!isValidEmail(correo)) {
        return res.status(400).json({ ok: false, mensaje: "Ingresa un correo valido" });
      }

      const [actualResult] = await pool.query(
        "SELECT id_usuario,nombre,correo,correo_pendiente,email_verificado FROM usuarios WHERE id_usuario=? LIMIT 1",
        [req.auth.userId]
      );
      if (actualResult.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
      }

      const actual = actualResult[0];
      let mensaje = "Perfil actualizado correctamente";
      let verificacionPendiente = false;

      if (correo !== actual.correo) {
        const [existente] = await pool.query(
          "SELECT id_usuario FROM usuarios WHERE correo=? AND id_usuario<>? LIMIT 1",
          [correo, req.auth.userId]
        );
        if (existente.length > 0) {
          return res.status(409).json({ ok: false, mensaje: "Ese correo ya esta en uso" });
        }

        await pool.query("UPDATE usuarios SET nombre=?,correo_pendiente=? WHERE id_usuario=?", [nombre, correo, req.auth.userId]);
        const token = await createEmailToken({ idUsuario: req.auth.userId, correo, tipo: "email_change" });
        await sendEmailChangeConfirmation({ nombre, correo: actual.correo }, correo, token);
        await logAuditEvent({
          idUsuario: req.auth.userId,
          entidad: "usuarios",
          entidadId: req.auth.userId,
          accion: "solicitar_cambio_correo",
          detalle: { correoAnterior: actual.correo, correoNuevo: correo, nombre }
        });
        mensaje = "Perfil actualizado. Confirma el nuevo correo desde el enlace que te enviamos.";
        verificacionPendiente = true;
      } else {
        await pool.query("UPDATE usuarios SET nombre=? WHERE id_usuario=?", [nombre, req.auth.userId]);
        if (nombre !== actual.nombre) {
          await logAuditEvent({
            idUsuario: req.auth.userId,
            entidad: "usuarios",
            entidadId: req.auth.userId,
            accion: "actualizar_nombre",
            detalle: { nombreAnterior: actual.nombre, nombreNuevo: nombre }
          });
        }
      }

      return res.json({
        ok: true,
        mensaje,
        verificacionPendiente,
        usuario: {
          id_usuario: req.auth.userId,
          nombre,
          correo: actual.correo,
          correo_pendiente: verificacionPendiente ? correo : actual.correo_pendiente,
          email_verificado: actual.email_verificado
        }
      });
    } catch (error) {
      return enviarError(res, error, "No se pudo actualizar el perfil");
    }
  });

  app.put("/usuarios/:idUsuario/password", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;

      const passwordActual = String(req.body?.passwordActual || "").trim();
      const passwordNueva = String(req.body?.passwordNueva || "").trim();
      if (!passwordActual || !passwordNueva) {
        return res.status(400).json({ ok: false, mensaje: "Debes completar todos los campos" });
      }
      if (!isValidPin(passwordNueva)) {
        return res.status(400).json({ ok: false, mensaje: PIN_VALIDATION_MESSAGE });
      }

      const [resultado] = await pool.query(
        "SELECT id_usuario,nombre,correo,password FROM usuarios WHERE id_usuario=? LIMIT 1",
        [req.auth.userId]
      );
      if (resultado.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
      }

      const usuarioActual = resultado[0];
      const passwordValido = await bcrypt.compare(passwordActual, usuarioActual.password);
      if (!passwordValido) {
        return res.status(401).json({ ok: false, mensaje: "La clave actual no es correcta" });
      }

      const passwordHash = await bcrypt.hash(passwordNueva, 10);
      await pool.query("UPDATE usuarios SET password=? WHERE id_usuario=?", [passwordHash, req.auth.userId]);
      await revokeTokens(req.auth.userId, "password_reset");
      await revokeAllSessionsForUser(req.auth.userId);

      const replacementToken = await createSession(req.auth.userId, req);
      setSessionCookie(res, replacementToken);

      await logAuditEvent({
        idUsuario: req.auth.userId,
        entidad: "usuarios",
        entidadId: req.auth.userId,
        accion: "cambiar_pin",
        detalle: { via: "perfil" }
      });
      await sendPasswordChangedEmail(usuarioActual);
      return res.json({ ok: true, mensaje: "Clave actualizada correctamente. Tambien te enviamos una notificacion al correo." });
    } catch (error) {
      return enviarError(res, error, "No se pudo actualizar la contrasena");
    }
  });
}

module.exports = registerUserRoutes;
