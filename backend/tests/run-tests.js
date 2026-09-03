const assert = require("node:assert/strict");

const {
  isValidEmail,
  isValidPin,
  normalizeEmail,
  sanitizeText,
  toMySqlDateTime
} = require("../utils/common");
const {
  buildMovementFilters,
  calculateReportPayload,
  getMonthRange,
  getPreviousMonth
} = require("../utils/reporting");
const {
  DEFAULT_CATEGORIES,
  DEFAULT_ICON,
  META_ICON
} = require("../config/appConfig");
const WalleEngine = require("../../frontend/walle-engine.js");

const tests = [
  {
    name: "appConfig conserva iconos reales para categorias por defecto",
    run() {
      assert.equal(DEFAULT_ICON, "\u{1F4E6}");
      assert.equal(META_ICON, "\u{1F3AF}");
      assert.equal(DEFAULT_CATEGORIES.find((item) => item.nombre === "Ahorro").icono, "\u{1F4B0}");
      assert.equal(DEFAULT_CATEGORIES.find((item) => item.nombre === "Vivienda").icono, "\u{1F3E0}");
      assert.equal(DEFAULT_CATEGORIES.some((item) => /^\?+$/.test(item.icono)), false);
    }
  },
  {
    name: "normalizeEmail limpia espacios y normaliza a minusculas",
    run() {
      assert.equal(normalizeEmail("  Usuario@Correo.COM "), "usuario@correo.com");
    }
  },
  {
    name: "sanitizeText colapsa espacios y recorta longitud",
    run() {
      assert.equal(sanitizeText("  hola    mundo  ", 20), "hola mundo");
      assert.equal(sanitizeText("abcdefghijkl", 5), "abcde");
    }
  },
  {
    name: "isValidEmail valida correos comunes",
    run() {
      assert.equal(isValidEmail("demo@mail.com"), true);
      assert.equal(isValidEmail("demo@mail"), false);
      assert.equal(isValidEmail(""), false);
    }
  },
  {
    name: "isValidPin exige exactamente cuatro digitos",
    run() {
      assert.equal(isValidPin("1234"), true);
      assert.equal(isValidPin("123"), false);
      assert.equal(isValidPin("12a4"), false);
    }
  },
  {
    name: "toMySqlDateTime convierte una fecha ISO a formato MySQL",
    run() {
      assert.equal(toMySqlDateTime("2026-04-26T10:20:30Z"), "2026-04-26 10:20:30");
    }
  },
  {
    name: "buildMovementFilters arma condiciones seguras",
    run() {
      const result = buildMovementFilters({
        idUsuario: 4,
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        tipo: "gasto",
        categoriaId: 7
      });

      assert.equal(
        result.whereSql,
        "m.id_usuario=? AND m.deleted_at IS NULL AND DATE(m.fecha) >= ? AND DATE(m.fecha) <= ? AND m.tipo = ? AND m.categoria_id = ?"
      );
      assert.deepEqual(result.params, [4, "2026-04-01", "2026-04-30", "gasto", 7]);
    }
  },
  {
    name: "getMonthRange devuelve el rango correcto del mes",
    run() {
      assert.deepEqual(getMonthRange(2026, 2), {
        startDate: "2026-02-01",
        endDate: "2026-02-28"
      });
      assert.equal(getMonthRange(2026, 13), null);
    }
  },
  {
    name: "getPreviousMonth calcula el periodo anterior",
    run() {
      assert.deepEqual(getPreviousMonth(2026, 1), { year: 2025, month: 12 });
    }
  },
  {
    name: "calculateReportPayload resume ingresos, gastos y categorias",
    run() {
      const payload = calculateReportPayload({
        movimientos: [
          { tipo: "ingreso", monto: 2000000, fecha: "2026-04-05", categoria: "Salario", categoria_id: 1, icono: "💰" },
          { tipo: "gasto", monto: 300000, fecha: "2026-04-10", categoria: "Transporte", categoria_id: 2, icono: "🚗" },
          { tipo: "gasto", monto: 200000, fecha: "2026-04-15", categoria: "Comida", categoria_id: 3, icono: "🍽️" }
        ],
        defaultIcon: "📦",
        month: 4,
        year: 2026,
        filtros: { month: 4, year: 2026 },
        previousComparison: { ingresos: 1800000, gastos: 400000, balance: 1400000 },
        previousLabel: "2026-03"
      });

      assert.equal(payload.summary.ingresos, 2000000);
      assert.equal(payload.summary.gastos, 500000);
      assert.equal(payload.summary.balance, 1500000);
      assert.equal(payload.summary.categoriaMayorGasto.categoria, "Transporte");
      assert.equal(payload.comparison.currentLabel, "2026-04");
      assert.equal(payload.monthly.length, 1);
    }
  },
  {
    name: "Walle recuerda el ingreso y calcula ahorro con contexto",
    run() {
      const ingreso = WalleEngine.processMessage("gano 4 millones");
      assert.equal(ingreso.context.ingreso, 4000000);

      const ahorro = WalleEngine.processMessage("cuanto ahorro", {
        context: ingreso.context
      });

      assert.equal(ahorro.intent, "ahorro");
      assert.equal(ahorro.decision.data.monthlySavings, 400000);
      assert.equal(ahorro.decision.data.recommendedPercent, 0.1);
    }
  },
  {
    name: "Walle compara tasas y elige la mas baja",
    run() {
      const tasas = WalleEngine.processMessage("tengo tasas de 2% y 1.5%");
      assert.equal(tasas.intent, "tasas");
      assert.equal(tasas.decision.data.bestRate.percent, 1.5);
      assert.equal(tasas.decision.data.bestRate.period, "mensual");
    }
  },
  {
    name: "Walle evalua si conviene unificar deudas con una nueva tasa",
    run() {
      const base = WalleEngine.processMessage("tengo tasas de 2% y 1.5%");
      const unificacion = WalleEngine.processMessage("quiero unir mis deudas con 1.2%", {
        context: base.context
      });

      assert.equal(unificacion.intent, "unificacion");
      assert.equal(unificacion.decision.data.conviene, true);
    }
  },
  {
    name: "Walle detecta fugas de gasto en comida",
    run() {
      const gasto = WalleEngine.processMessage("gasto mucho en comida");
      assert.equal(gasto.intent, "gastos");
      assert.deepEqual(gasto.decision.data.fugas, ["comida"]);
    }
  },
  {
    name: "Walle calcula una cuota de credito con monto, tasa y plazo",
    run() {
      const credito = WalleEngine.processMessage("quiero un credito de 4 millones al 2% mensual a 24 meses");
      assert.equal(credito.intent, "credito");
      assert.ok(credito.decision.data.payment > 0);
      assert.ok(credito.decision.data.totalInterest > 0);
    }
  },
  {
    name: "Walle detecta una meta de ahorro sin confundirla con el ingreso",
    run() {
      const previo = WalleEngine.processMessage("gano 4 millones");
      const meta = WalleEngine.processMessage("cuanto debo ahorrar para 15 millones en 2 anos entonces", {
        context: previo.context
      });

      assert.equal(meta.intent, "meta");
      assert.equal(meta.passToLegacy, true);
      assert.equal(meta.context.ingreso, 4000000);
    }
  },
  {
    name: "Walle entiende el concepto de CDT y pide datos clave",
    run() {
      const ingreso = WalleEngine.processMessage("gano 4 millones");
      const inversion = WalleEngine.processMessage("y si invierto en CDT saldria mejor?", {
        context: ingreso.context
      });

      assert.equal(inversion.intent, "inversion");
      assert.ok(inversion.response.toLowerCase().includes("cdt"));
      assert.ok(inversion.response.toLowerCase().includes("liquidez") || inversion.response.toLowerCase().includes("plata quieta"));
    }
  },
  {
    name: "Walle aclara que no tiene el promedio de CDT de hoy en tiempo real",
    run() {
      const promedio = WalleEngine.processMessage("puedes saber el promedio de los CDT hoy?");

      assert.equal(promedio.intent, "inversion");
      assert.ok(promedio.response.toLowerCase().includes("no tengo el promedio"));
      assert.ok(promedio.response.toLowerCase().includes("calculo y comparo"));
    }
  },
  {
    name: "Walle calcula una inversion en CDT con monto, tasa y plazo",
    run() {
      const inversion = WalleEngine.processMessage("si meto 5 millones en un CDT al 10% anual por 12 meses", {
        context: WalleEngine.processMessage("gano 4 millones").context
      });

      assert.equal(inversion.intent, "inversion");
      assert.ok(inversion.decision.data.finalValue > 5000000);
      assert.ok(inversion.decision.data.earnings > 0);
      assert.ok(inversion.response.includes("10% anual"));
    }
  },
  {
    name: "Walle prioriza deuda cara sobre CDT",
    run() {
      const base = WalleEngine.processMessage("tengo una deuda de 5 millones al 2% mensual");
      const inversion = WalleEngine.processMessage("si meto 5 millones en un CDT al 10% anual por 12 meses saldria mejor?", {
        context: base.context
      });

      assert.equal(inversion.intent, "inversion");
      assert.ok(inversion.response.toLowerCase().includes("deuda"));
      assert.ok(inversion.response.toLowerCase().includes("no saldria mejor"));
    }
  },
  {
    name: "Walle orienta sobre bancos colombianos sin depender de APIs",
    run() {
      const bancos = WalleEngine.processMessage("que banco me conviene en Colombia para ahorrar?");

      assert.equal(bancos.intent, "bancos_colombia");
      assert.ok(bancos.response.toLowerCase().includes("colombia"));
      assert.ok(bancos.response.toLowerCase().includes("cuenta"));
    }
  },
  {
    name: "Walle aclara tasas colombianas sin datos en vivo",
    run() {
      const tasas = WalleEngine.processMessage("cuales son las tasas de credito actuales hoy en Colombia?");

      assert.equal(tasas.intent, "tasas");
      assert.ok(tasas.response.toLowerCase().includes("no tengo tasas"));
      assert.ok(tasas.response.toLowerCase().includes("superfinanciera"));
    }
  },
  {
    name: "Walle guia reclamos financieros en Colombia",
    run() {
      const reclamo = WalleEngine.processMessage("como hago una PQR contra un banco?");

      assert.equal(reclamo.intent, "tramites_colombia");
      assert.ok(reclamo.response.toLowerCase().includes("pqr"));
      assert.ok(reclamo.response.toLowerCase().includes("defensor"));
    }
  },
  {
    name: "Walle advierte sobre creditos faciles en Colombia",
    run() {
      const credito = WalleEngine.processMessage("donde puedo sacar credito facil en Colombia?");

      assert.equal(credito.intent, "credito");
      assert.ok(credito.response.toLowerCase().includes("facil"));
      assert.ok(credito.response.toLowerCase().includes("tasa"));
    }
  },
  {
    name: "Walle deja pasar preguntas desconocidas al asistente legado",
    run() {
      const result = WalleEngine.processMessage("como creo una categoria nueva");

      assert.equal(result.intent, null);
      assert.equal(result.passToLegacy, true);
      assert.equal(result.response, "");
    }
  },
  {
    name: "Walle calcula un fondo de emergencia con el ingreso conocido",
    run() {
      const base = WalleEngine.processMessage("gano 4 millones");
      const result = WalleEngine.processMessage("cuanto necesito de fondo de emergencia", { context: base.context });

      assert.equal(result.intent, "fondo_emergencia");
      assert.equal(result.decision.data.minimumFund, 7200000);
      assert.equal(result.decision.data.robustFund, 14400000);
      assert.equal(result.decision.data.isEstimate, true);
    }
  },
  {
    name: "Walle separa ingreso y gasto al calcular el fondo de emergencia",
    run() {
      const result = WalleEngine.processMessage("gano 4 millones y gasto 2 millones al mes, cuanto necesito de fondo de emergencia");

      assert.equal(result.context.ingreso, 4000000);
      assert.equal(result.context.gastoEsencialMensual, 2000000);
      assert.equal(result.decision.data.minimumFund, 6000000);
      assert.equal(result.decision.data.robustFund, 12000000);
      assert.equal(result.decision.data.isEstimate, false);
    }
  },
  {
    name: "Walle estima una cuota maxima prudente segun el ingreso",
    run() {
      const base = WalleEngine.processMessage("mi salario es 5 millones");
      const result = WalleEngine.processMessage("cuanto me puedo endeudar", { context: base.context });

      assert.equal(result.intent, "capacidad_pago");
      assert.equal(result.decision.data.maximumTotalPayment, 1500000);
      assert.equal(result.decision.data.comfortablePayment, 1000000);
    }
  },
  {
    name: "Walle convierte una tasa mensual a efectiva anual",
    run() {
      const result = WalleEngine.processMessage("cuanto es 2% mensual en EA");

      assert.equal(result.intent, "tasas");
      assert.ok(result.decision.data.annualDecimal > 0.26);
      assert.ok(result.response.includes("EA"));
    }
  },
  {
    name: "Walle pide el porcentaje al iniciar una conversion guiada",
    run() {
      const result = WalleEngine.processMessage("cuanto equivale una tasa mensual en EA");

      assert.equal(result.intent, "tasas");
      assert.equal(result.decision.type, "question");
      assert.ok(result.response.toLowerCase().includes("porcentaje"));
    }
  },
  {
    name: "Walle advierte cuando una cuota supera la capacidad prudente",
    run() {
      const base = WalleEngine.processMessage("gano 2 millones");
      const result = WalleEngine.processMessage("credito de 10 millones al 2% mensual a 12 meses", { context: base.context });

      assert.equal(result.intent, "credito");
      assert.equal(result.decision.data.affordable, false);
      assert.ok(result.decision.data.paymentToIncome > 0.30);
    }
  }
];

let failed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error.message);
  }
}

if (failed > 0) {
  console.error(`\n${failed} prueba(s) fallaron.`);
  process.exit(1);
}

console.log(`\n${tests.length} prueba(s) superadas.`);
