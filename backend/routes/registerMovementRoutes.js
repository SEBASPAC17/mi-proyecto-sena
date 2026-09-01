function registerMovementRoutes(app, deps) {
  const {
    pool,
    requireAuth,
    assertOwnUserId,
    buildMovementFilters,
    DEFAULT_ICON,
    enviarError,
    isValidDateValue,
    logAuditEvent,
    sanitizeText,
    toMySqlDateTime
  } = deps;

  app.get("/movimientos/:idUsuario", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const tipo = sanitizeText(req.query.tipo || "todos", 20);
      const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : null;
      const filter = buildMovementFilters({
        idUsuario: req.auth.userId,
        startDate: startDate || null,
        endDate: endDate || null,
        tipo,
        categoriaId: Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : null
      });
      const [results] = await pool.query(
        `SELECT m.id,m.tipo,m.monto,m.descripcion,m.fecha,m.created_at,m.updated_at,
                m.categoria_id,c.nombre AS categoria,COALESCE(c.icono,?) AS icono
         FROM movimientos m
         LEFT JOIN categorias c ON c.id=m.categoria_id
         WHERE ${filter.whereSql}
         ORDER BY m.fecha DESC,m.id DESC`,
        [DEFAULT_ICON, ...filter.params]
      );
      return res.json(results);
    } catch (error) {
      return enviarError(res, error, "No se pudieron cargar los movimientos");
    }
  });

  app.post("/movimientos", requireAuth, async (req, res) => {
    try {
      const tipo = sanitizeText(req.body?.tipo, 20);
      const montoNumero = Number(req.body?.monto);
      const descripcion = sanitizeText(req.body?.descripcion, 255);
      const categoriaId = Number(req.body?.categoria_id);
      const fechaMovimiento = String(req.body?.fecha || "").trim();

      if (!tipo || !Number.isFinite(montoNumero) || !categoriaId) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }
      if (!["ingreso", "gasto"].includes(tipo)) {
        return res.status(400).json({ ok: false, mensaje: "El tipo de movimiento no es valido" });
      }
      if (Number.isNaN(montoNumero) || montoNumero <= 0) {
        return res.status(400).json({ ok: false, mensaje: "El monto debe ser mayor a cero" });
      }
      if (fechaMovimiento && !isValidDateValue(fechaMovimiento)) {
        return res.status(400).json({ ok: false, mensaje: "La fecha del movimiento no es valida" });
      }

      const [categoria] = await pool.query(
        "SELECT c.id,c.nombre,COALESCE(c.icono,?) AS icono FROM categorias c WHERE c.id=? AND c.id_usuario=? LIMIT 1",
        [DEFAULT_ICON, categoriaId, req.auth.userId]
      );
      if (categoria.length === 0) {
        return res.status(400).json({ ok: false, mensaje: "La categoria no es valida" });
      }

      const fechaSql = toMySqlDateTime(fechaMovimiento);
      const [resultado] = await pool.query(
        "INSERT INTO movimientos (tipo,monto,descripcion,id_usuario,categoria_id,fecha) VALUES (?,?,?,?,?,?)",
        [tipo, montoNumero, descripcion, req.auth.userId, categoriaId, fechaSql || toMySqlDateTime()]
      );
      await logAuditEvent({
        idUsuario: req.auth.userId,
        entidad: "movimientos",
        entidadId: resultado.insertId,
        accion: "crear_movimiento",
        detalle: { tipo, monto: montoNumero, descripcion, categoriaId, fecha: fechaSql || null }
      });
      return res.status(201).json({ ok: true, mensaje: "Movimiento guardado", id: resultado.insertId });
    } catch (error) {
      return enviarError(res, error, "No se pudo guardar el movimiento");
    }
  });

  app.put("/movimientos/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tipo = sanitizeText(req.body?.tipo, 20);
      const montoNumero = Number(req.body?.monto);
      const descripcion = sanitizeText(req.body?.descripcion, 255);
      const categoriaId = Number(req.body?.categoria_id);
      const fechaMovimiento = String(req.body?.fecha || "").trim();

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, mensaje: "Movimiento invalido" });
      }
      if (!tipo || !Number.isFinite(montoNumero) || !categoriaId) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }
      if (!["ingreso", "gasto"].includes(tipo)) {
        return res.status(400).json({ ok: false, mensaje: "El tipo de movimiento no es valido" });
      }
      if (Number.isNaN(montoNumero) || montoNumero <= 0) {
        return res.status(400).json({ ok: false, mensaje: "El monto debe ser mayor a cero" });
      }
      if (fechaMovimiento && !isValidDateValue(fechaMovimiento)) {
        return res.status(400).json({ ok: false, mensaje: "La fecha del movimiento no es valida" });
      }

      const [actual] = await pool.query(
        `SELECT id,tipo,monto,descripcion,categoria_id,fecha
         FROM movimientos
         WHERE id=? AND id_usuario=? AND deleted_at IS NULL
         LIMIT 1`,
        [id, req.auth.userId]
      );
      if (actual.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Movimiento no encontrado" });
      }

      const [categoria] = await pool.query(
        "SELECT c.id FROM categorias c WHERE c.id=? AND c.id_usuario=? LIMIT 1",
        [categoriaId, req.auth.userId]
      );
      if (categoria.length === 0) {
        return res.status(400).json({ ok: false, mensaje: "La categoria no es valida" });
      }

      await pool.query(
        `UPDATE movimientos
         SET tipo=?, monto=?, descripcion=?, categoria_id=?, fecha=?
         WHERE id=? AND id_usuario=? AND deleted_at IS NULL`,
        [tipo, montoNumero, descripcion, categoriaId, toMySqlDateTime(fechaMovimiento) || toMySqlDateTime(actual[0].fecha), id, req.auth.userId]
      );
      await logAuditEvent({
        idUsuario: req.auth.userId,
        entidad: "movimientos",
        entidadId: id,
        accion: "editar_movimiento",
        detalle: {
          antes: actual[0],
          despues: { tipo, monto: montoNumero, descripcion, categoriaId, fecha: fechaMovimiento || null }
        }
      });
      return res.json({ ok: true, mensaje: "Movimiento actualizado" });
    } catch (error) {
      return enviarError(res, error, "No se pudo actualizar el movimiento");
    }
  });

  app.delete("/movimientos/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, mensaje: "Movimiento invalido" });
      }

      const [actual] = await pool.query(
        `SELECT id,tipo,monto,descripcion,categoria_id,fecha
         FROM movimientos
         WHERE id=? AND id_usuario=? AND deleted_at IS NULL
         LIMIT 1`,
        [id, req.auth.userId]
      );
      if (actual.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Movimiento no encontrado" });
      }

      await pool.query(
        "UPDATE movimientos SET deleted_at=NOW() WHERE id=? AND id_usuario=? AND deleted_at IS NULL",
        [id, req.auth.userId]
      );
      await logAuditEvent({
        idUsuario: req.auth.userId,
        entidad: "movimientos",
        entidadId: id,
        accion: "eliminar_movimiento",
        detalle: actual[0]
      });
      return res.json({ ok: true, mensaje: "Movimiento eliminado" });
    } catch (error) {
      return enviarError(res, error, "No se pudo eliminar el movimiento");
    }
  });
}

module.exports = registerMovementRoutes;
