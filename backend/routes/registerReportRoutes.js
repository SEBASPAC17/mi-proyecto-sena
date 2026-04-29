function registerReportRoutes(app, deps) {
  const {
    pool,
    requireAuth,
    assertOwnUserId,
    buildMovementFilters,
    calculateReportPayload,
    DEFAULT_ICON,
    enviarError,
    getMonthRange,
    getPreviousMonth,
    getReportTotals,
    sanitizeText
  } = deps;

  app.get("/reportes/:idUsuario", requireAuth, async (req, res) => {
    try {
      if (!assertOwnUserId(req, res)) return;
      let startDate = String(req.query.startDate || "").trim();
      let endDate = String(req.query.endDate || "").trim();
      const tipo = sanitizeText(req.query.tipo || "todos", 20);
      const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : null;
      const month = req.query.month ? Number(req.query.month) : null;
      const year = req.query.year ? Number(req.query.year) : null;

      if (month && year) {
        const monthRange = getMonthRange(year, month);
        if (!monthRange) {
          return res.status(400).json({ ok: false, mensaje: "Mes o anio invalido" });
        }
        startDate = monthRange.startDate;
        endDate = monthRange.endDate;
      }

      const categoryFilter = Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : null;
      const filter = buildMovementFilters({
        idUsuario: req.auth.userId,
        startDate: startDate || null,
        endDate: endDate || null,
        tipo,
        categoriaId: categoryFilter
      });

      const [movimientos] = await pool.query(
        `SELECT m.id,m.tipo,m.monto,m.descripcion,m.fecha,m.created_at,m.updated_at,m.categoria_id,
                c.nombre AS categoria,COALESCE(c.icono,?) AS icono
         FROM movimientos m
         LEFT JOIN categorias c ON c.id=m.categoria_id
         WHERE ${filter.whereSql}
         ORDER BY m.fecha DESC,m.id DESC`,
        [DEFAULT_ICON, ...filter.params]
      );

      let previousComparison = { ingresos: 0, gastos: 0, balance: 0 };
      let previousLabel = "Mes anterior";
      if (month && year) {
        const previous = getPreviousMonth(year, month);
        const previousRange = getMonthRange(previous.year, previous.month);
        const previousTotals = await getReportTotals({
          idUsuario: req.auth.userId,
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
          tipo,
          categoriaId: categoryFilter
        });
        previousComparison = {
          ingresos: Number(previousTotals.ingresos) || 0,
          gastos: Number(previousTotals.gastos) || 0,
          balance: (Number(previousTotals.ingresos) || 0) - (Number(previousTotals.gastos) || 0)
        };
        previousLabel = `${previous.year}-${String(previous.month).padStart(2, "0")}`;
      }

      return res.json(calculateReportPayload({
        movimientos,
        defaultIcon: DEFAULT_ICON,
        month,
        year,
        filtros: {
          startDate: startDate || null,
          endDate: endDate || null,
          tipo,
          categoriaId: categoryFilter,
          month,
          year
        },
        previousComparison,
        previousLabel
      }));
    } catch (error) {
      return enviarError(res, error, "No se pudieron cargar los reportes");
    }
  });
}

module.exports = registerReportRoutes;
