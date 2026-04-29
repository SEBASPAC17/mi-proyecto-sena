function registerSupportRoutes(app, deps) {
  const {
    requireAuth,
    enviarError,
    sanitizeText,
    sendHelpEmails
  } = deps;

  app.post("/ayuda", requireAuth, async (req, res) => {
    try {
      const asunto = sanitizeText(req.body?.asunto || "general", 40);
      const mensaje = sanitizeText(req.body?.mensaje, 1000);
      if (!mensaje) {
        return res.status(400).json({ ok: false, mensaje: "Debes completar el mensaje de soporte" });
      }

      await sendHelpEmails({
        nombre: req.usuario.nombre,
        correo: req.usuario.correo,
        asunto,
        mensaje
      });
      return res.json({ ok: true, mensaje: "Solicitud recibida. Tambien te enviamos una confirmacion al correo." });
    } catch (error) {
      return enviarError(res, error, "No se pudo procesar la solicitud de ayuda");
    }
  });
}

module.exports = registerSupportRoutes;
