function registerCategoryRoutes(app, deps) {
  const {
    pool,
    requireAuth,
    assertOwnUserId,
    DEFAULT_ICON,
    ensureDefaultCategoriesForUser,
    enviarError,
    sanitizeText
  } = deps;

  app.get("/categorias/:idUsuario", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;
      await ensureDefaultCategoriesForUser(req.auth.userId);
      const [results] = await pool.query(
        `SELECT c.id,c.nombre,COALESCE(c.icono,?) AS icono,
                EXISTS(SELECT 1 FROM metas mt WHERE mt.id_usuario=c.id_usuario AND mt.nombre=c.nombre) AS es_meta
         FROM categorias c
         WHERE c.id_usuario=?
         ORDER BY es_meta DESC,c.nombre ASC`,
        [DEFAULT_ICON, req.auth.userId]
      );
      return res.json(results);
    } catch (error) {
      return enviarError(res, error, "No se pudieron cargar las categorias");
    }
  });

  app.post("/categorias", requireAuth, async (req, res) => {
    try {
      const nombre = sanitizeText(req.body?.nombre, 80);
      const icono = sanitizeText(req.body?.icono || DEFAULT_ICON, 10);
      if (!nombre) {
        return res.status(400).json({ ok: false, mensaje: "Nombre e id_usuario son obligatorios" });
      }

      const [existente] = await pool.query(
        "SELECT id FROM categorias WHERE id_usuario=? AND nombre=? LIMIT 1",
        [req.auth.userId, nombre]
      );
      if (existente.length > 0) {
        return res.status(409).json({ ok: false, mensaje: "La categoria ya existe" });
      }

      const [resultado] = await pool.query(
        "INSERT INTO categorias (nombre,icono,id_usuario) VALUES (?,?,?)",
        [nombre, icono || DEFAULT_ICON, req.auth.userId]
      );
      return res.status(201).json({
        ok: true,
        mensaje: "Categoria creada correctamente",
        categoria: { id: resultado.insertId, nombre, icono: icono || DEFAULT_ICON }
      });
    } catch (error) {
      return enviarError(res, error, "No se pudo crear la categoria");
    }
  });

  app.delete("/categorias/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, mensaje: "Categoria invalida" });
      }

      const [resultado] = await pool.query(
        "DELETE FROM categorias WHERE id=? AND id_usuario=?",
        [id, req.auth.userId]
      );
      if (resultado.affectedRows === 0) {
        return res.status(404).json({ ok: false, mensaje: "Categoria no encontrada" });
      }
      return res.json({ ok: true, mensaje: "Categoria eliminada" });
    } catch (error) {
      return enviarError(res, error, "No se pudo eliminar la categoria");
    }
  });
}

module.exports = registerCategoryRoutes;
