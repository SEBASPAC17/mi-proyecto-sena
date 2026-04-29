function registerGoalRoutes(app, deps) {
  const {
    pool,
    requireAuth,
    assertOwnUserId,
    ensureMetaCategory,
    enviarError,
    META_ICON,
    sanitizeText
  } = deps;

  app.get("/metas/:idUsuario", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;
      const [results] = await pool.query(
        `SELECT m.id,m.nombre,m.monto,m.fecha_limite,COALESCE(c.icono,?) AS icono
         FROM metas m
         LEFT JOIN categorias c ON c.id_usuario=m.id_usuario AND c.nombre=m.nombre
         WHERE m.id_usuario=?
         ORDER BY m.fecha_limite ASC,m.id DESC`,
        [META_ICON, req.auth.userId]
      );
      return res.json(results);
    } catch (error) {
      return enviarError(res, error, "No se pudieron cargar las metas");
    }
  });

  app.post("/metas", requireAuth, async (req, res) => {
    try {
      const nombre = sanitizeText(req.body?.nombre, 80);
      const montoNumero = Number(req.body?.monto);
      const fechaLimite = String(req.body?.fecha_limite || "").trim();

      if (!nombre || !montoNumero || !fechaLimite) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }
      if (Number.isNaN(montoNumero) || montoNumero <= 0) {
        return res.status(400).json({ ok: false, mensaje: "El monto debe ser mayor a cero" });
      }

      await ensureMetaCategory(req.auth.userId, nombre, META_ICON);
      const [resultado] = await pool.query(
        "INSERT INTO metas (nombre,monto,fecha_limite,id_usuario) VALUES (?,?,?,?)",
        [nombre, montoNumero, fechaLimite, req.auth.userId]
      );
      return res.status(201).json({ ok: true, mensaje: "Meta creada", id: resultado.insertId });
    } catch (error) {
      return enviarError(res, error, "No se pudo guardar la meta");
    }
  });

  app.put("/metas/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const nombre = sanitizeText(req.body?.nombre, 80);
      const montoNumero = Number(req.body?.monto);
      const fechaLimite = String(req.body?.fecha_limite || "").trim();

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, mensaje: "Meta invalida" });
      }
      if (!nombre || !montoNumero || !fechaLimite) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }
      if (Number.isNaN(montoNumero) || montoNumero <= 0) {
        return res.status(400).json({ ok: false, mensaje: "El monto debe ser mayor a cero" });
      }

      const [metaActual] = await pool.query(
        "SELECT id,nombre FROM metas WHERE id=? AND id_usuario=? LIMIT 1",
        [id, req.auth.userId]
      );
      if (metaActual.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Meta no encontrada" });
      }

      const nombreAnterior = metaActual[0].nombre;
      await ensureMetaCategory(req.auth.userId, nombre, META_ICON);
      await pool.query(
        "UPDATE metas SET nombre=?,monto=?,fecha_limite=? WHERE id=? AND id_usuario=?",
        [nombre, montoNumero, fechaLimite, id, req.auth.userId]
      );
      if (nombreAnterior !== nombre) {
        await pool.query(
          "UPDATE categorias SET nombre=?,icono=? WHERE id_usuario=? AND nombre=?",
          [nombre, META_ICON, req.auth.userId, nombreAnterior]
        );
      }
      return res.json({ ok: true, mensaje: "Meta actualizada" });
    } catch (error) {
      return enviarError(res, error, "No se pudo actualizar la meta");
    }
  });

  app.delete("/metas/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, mensaje: "Meta invalida" });
      }

      const [resultado] = await pool.query(
        "DELETE FROM metas WHERE id=? AND id_usuario=?",
        [id, req.auth.userId]
      );
      if (resultado.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Meta no encontrada" });
      }
      return res.json({ ok: true, mensaje: "Meta eliminada" });
    } catch (error) {
      return enviarError(res, error, "No se pudo eliminar la meta");
    }
  });
}

module.exports = registerGoalRoutes;
