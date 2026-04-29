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

function calculateReportPayload({
  movimientos,
  defaultIcon,
  month = null,
  year = null,
  filtros,
  previousComparison = { ingresos: 0, gastos: 0, balance: 0 },
  previousLabel = "Mes anterior"
}) {
  let ingresos = 0;
  let gastos = 0;
  const categorias = new Map();
  const resumenMensual = new Map();

  for (const movimiento of movimientos) {
    const monto = Number(movimiento.monto) || 0;
    const fecha = new Date(movimiento.fecha);
    const periodKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    if (!resumenMensual.has(periodKey)) {
      resumenMensual.set(periodKey, { periodo: periodKey, ingresos: 0, gastos: 0, balance: 0 });
    }
    const monthly = resumenMensual.get(periodKey);

    if (movimiento.tipo === "ingreso") {
      ingresos += monto;
      monthly.ingresos += monto;
    } else {
      gastos += monto;
      monthly.gastos += monto;
      const categoryKey = movimiento.categoria || "Sin categoria";
      if (!categorias.has(categoryKey)) {
        categorias.set(categoryKey, {
          categoria: categoryKey,
          categoria_id: movimiento.categoria_id,
          icono: movimiento.icono || defaultIcon,
          total: 0
        });
      }
      categorias.get(categoryKey).total += monto;
    }
    monthly.balance = monthly.ingresos - monthly.gastos;
  }

  const categoriasOrdenadas = Array.from(categorias.values()).sort((a, b) => b.total - a.total);
  const meses = Array.from(resumenMensual.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const promedioMensual = meses.length ? gastos / meses.length : 0;
  const balance = ingresos - gastos;
  const capacidadAhorro = ingresos > 0 ? (balance / ingresos) * 100 : 0;

  return {
    ok: true,
    filtros,
    summary: {
      ingresos,
      gastos,
      balance,
      totalMovimientos: movimientos.length,
      promedioMensual,
      capacidadAhorro,
      categoriaMayorGasto: categoriasOrdenadas[0] || null
    },
    comparison: {
      current: { ingresos, gastos, balance },
      previous: previousComparison,
      currentLabel: month && year ? `${year}-${String(month).padStart(2, "0")}` : "Periodo actual",
      previousLabel
    },
    categories: categoriasOrdenadas,
    monthly: meses,
    movements: movimientos
  };
}

module.exports = {
  buildMovementFilters,
  calculateReportPayload,
  getMonthRange,
  getPreviousMonth
};
