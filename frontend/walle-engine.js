(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WalleEngine = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const MONEY_HINTS = [
    "gano",
    "ganar",
    "ingreso",
    "ingresos",
    "salario",
    "sueldo",
    "me pagan",
    "me entra",
    "debo",
    "deuda",
    "cuota",
    "pago",
    "gasto",
    "gastos",
    "pagar",
    "credito",
    "prestamo",
    "ahorro",
    "meta",
    "viaje"
  ];

  const GREETINGS = ["hola", "buenas", "hey", "holi", "que mas", "que tal", "buen dia", "buenas tardes"];
  const CONTEXTUAL_TERMS = ["cuanto", "cuanto seria", "como asi", "y si", "entonces", "me conviene", "vale la pena", "eso", "que hago"];
  const DEBT_WORDS = ["deuda", "deudas", "debo", "credito", "creditos", "prestamo", "prestamos", "tarjeta", "cuota", "cuotas", "mora"];
  const CREDIT_WORDS = ["credito", "creditos", "prestamo", "prestamos", "me prestan", "me ofrecen", "financiar", "cuota", "cuotas"];
  const GOAL_WORDS = ["meta", "viaje", "quiero ahorrar para", "quiero juntar", "quiero reunir"];
  const INVESTMENT_WORDS = [
    "invertir",
    "inversion",
    "inversiones",
    "invertido",
    "rentabilidad",
    "rendimiento",
    "cdt",
    "plazo fijo",
    "fiducuenta",
    "fondo conservador",
    "fondo de inversion",
    "cuenta remunerada",
    "cuenta rentada",
    "bajo riesgo"
  ];
  const SNAPSHOT_WORDS = ["mis gastos", "mis ingresos", "mis finanzas", "analiza mis finanzas", "revisa mis gastos", "revisa mis finanzas", "en que gasto mas"];

  const KEYWORD_GROUPS = {
    ahorro: ["ahorro", "ahorrar", "guardar", "guardado", "fondo", "colchon"],
    deuda: DEBT_WORDS,
    gasto: ["gasto", "gastos", "compras", "se me va", "no me alcanza", "fuga", "fugas"],
    credito: CREDIT_WORDS,
    inversion: INVESTMENT_WORDS,
    ingreso: ["gano", "ganar", "ingreso", "ingresos", "salario", "sueldo", "me pagan"],
    tasa: ["tasa", "tasas", "interes", "intereses", "%"],
    unificacion: ["unificar", "unir", "consolidar", "refinanciar"],
    comida: ["comida", "mercado", "almuerzo", "desayuno", "cena", "restaurante", "domicilio", "cafecito", "cafe"],
    ocio: ["ocio", "salidas", "rumba", "cine", "fiesta", "entretenimiento", "suscripcion", "suscripciones", "netflix", "spotify"],
    transporte: ["transporte", "gasolina", "uber", "taxi", "bus", "pasajes"],
    vivienda: ["arriendo", "hipoteca", "vivienda", "casa"],
    servicios: ["servicios", "luz", "agua", "internet", "celular"],
    compras: ["compras", "ropa", "shopping", "impulso"],
    analisis: ["analiza", "analisis", "analizar", "revisa", "revisa mis finanzas"]
  };

  const EXPENSE_CATEGORY_HINTS = {
    comida: ["comida", "mercado", "almuerzo", "desayuno", "cena", "restaurante", "domicilio", "cafecito", "cafe"],
    ocio: ["ocio", "salidas", "rumba", "cine", "fiesta", "entretenimiento", "suscripcion", "suscripciones", "netflix", "spotify"],
    transporte: ["transporte", "gasolina", "uber", "taxi", "bus", "pasajes"],
    vivienda: ["arriendo", "hipoteca", "vivienda", "casa"],
    servicios: ["servicios", "luz", "agua", "internet", "celular"],
    compras: ["compras", "ropa", "shopping", "impulso"],
    salud: ["salud", "medico", "medicina", "farmacia"],
    educacion: ["educacion", "universidad", "colegio", "curso", "matricula"]
  };

  const AMOUNT_REGEX = /\$?\s*(\d[\d.,]*)\s*(millones?|millon|mill|m|palos?|palo|lucas?|luca|mil|k)?\b/gi;
  const RATE_REGEX = /(\d+(?:[.,]\d+)?)\s?%(?:\s*(mensual|anual|ea|e\.a\.?))?/gi;
  const DIRECT_DEBT_REGEX = /(\$?\s*\d[\d.,]*)\s*(millones?|millon|mill|m|palos?|palo|lucas?|luca|mil|k)?(?:\s+de)?[^%\n]{0,42}?(?:al|a la|con|tasa)\s*(\d+(?:[.,]\d+)?)\s?%(?:\s*(mensual|anual|ea|e\.a\.?))?/gi;

  function createEmptyContext() {
    return {
      intent: null,
      ingreso: null,
      gastos: [],
      deudas: [],
      tasas: [],
      ultimoTema: null,
      palabrasClave: [],
      ultimaPregunta: "",
      inversion: {
        product: null,
        amount: null,
        rate: null,
        months: null
      }
    };
  }

  function cloneContext(input = {}) {
    const base = createEmptyContext();
    return {
      ...base,
      ...(input || {}),
      gastos: Array.isArray(input.gastos) ? input.gastos.slice(-12) : [],
      deudas: Array.isArray(input.deudas) ? input.deudas.slice(-12) : [],
      tasas: Array.isArray(input.tasas) ? input.tasas.slice(-12) : [],
      palabrasClave: Array.isArray(input.palabrasClave) ? input.palabrasClave.slice(-20) : [],
      ultimaPregunta: input.ultimaPregunta || "",
      inversion: {
        ...(base.inversion || {}),
        ...((input && input.inversion) || {})
      }
    };
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizar(texto) {
    return normalizarTexto(texto).split(" ").filter(Boolean);
  }

  function tieneAlguno(normalized, terms) {
    return terms.some((term) => normalized.includes(normalizarTexto(term)));
  }

  function uniqueBy(items, buildKey) {
    const seen = new Set();
    return items.filter((item) => {
      const key = buildKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatPercent(value) {
    const number = Number(value) || 0;
    if (number % 1 === 0) {
      return `${Math.round(number)}%`;
    }
    return `${number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
  }

  function formatPercentFromDecimal(decimalValue) {
    return formatPercent((Number(decimalValue) || 0) * 100);
  }

  function formatPeriodLabel(period) {
    return period === "anual" ? "anual" : "mensual";
  }

  function getSnippet(text, index, before = 26, after = 34) {
    const raw = String(text || "").toLowerCase();
    return raw.slice(Math.max(0, index - before), Math.min(raw.length, index + after));
  }

  function parseNumericValue(rawNumber) {
    let raw = String(rawNumber || "")
      .replace(/\$/g, "")
      .replace(/\s+/g, "");
    if (!raw) return 0;

    const hasDot = raw.includes(".");
    const hasComma = raw.includes(",");

    if (hasDot && hasComma) {
      const lastDot = raw.lastIndexOf(".");
      const lastComma = raw.lastIndexOf(",");
      const decimalSeparator = lastDot > lastComma ? "." : ",";
      const decimalIndex = Math.max(lastDot, lastComma);
      const digitsAfter = raw.length - decimalIndex - 1;

      if (digitsAfter === 3 && /^(\d{1,3}([.,]\d{3})+)$/.test(raw)) {
        raw = raw.replace(/[.,]/g, "");
      } else {
        const parts = raw.split(decimalSeparator);
        const decimalPart = parts.pop();
        raw = `${parts.join("").replace(/[.,]/g, "")}.${decimalPart}`;
      }
    } else if (hasDot) {
      if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
        raw = raw.replace(/\./g, "");
      } else if (/^\d+\.\d{3}$/.test(raw)) {
        raw = raw.replace(/\./g, "");
      }
    } else if (hasComma) {
      if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
        raw = raw.replace(/,/g, "");
      } else if (/^\d+,\d{3}$/.test(raw)) {
        raw = raw.replace(/,/g, "");
      } else {
        raw = raw.replace(",", ".");
      }
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function getAmountMultiplier(unit = "") {
    const normalizedUnit = normalizarTexto(unit);
    if (!normalizedUnit) return 1;
    if (normalizedUnit === "m" || normalizedUnit.includes("mill") || normalizedUnit.includes("palo")) return 1000000;
    if (normalizedUnit === "k" || normalizedUnit.includes("mil") || normalizedUnit.includes("luca")) return 1000;
    return 1;
  }

  function parseAmountToken(rawNumber, suffix = "") {
    const baseValue = parseNumericValue(rawNumber);
    if (!baseValue) return 0;
    return Math.round(baseValue * getAmountMultiplier(suffix));
  }

  function looksLikeMoney(rawNumber, unit, snippet) {
    if (unit) return true;
    const digits = String(rawNumber || "").replace(/\D/g, "");
    if (digits.length >= 4) return true;
    return MONEY_HINTS.some((hint) => String(snippet || "").includes(hint));
  }

  function extraerMontos(texto) {
    const matches = [];
    let match;

    while ((match = AMOUNT_REGEX.exec(String(texto || ""))) !== null) {
      const raw = match[0];
      const rawNumber = match[1];
      const suffix = match[2] || "";
      const nextChar = String(texto || "").slice(match.index + raw.length, match.index + raw.length + 1);
      if (nextChar === "%") continue;

      const snippet = getSnippet(texto, match.index);
      if (!looksLikeMoney(rawNumber, suffix, snippet)) continue;

      const value = parseAmountToken(rawNumber, suffix);
      if (!value) continue;

      matches.push({
        raw: raw.trim(),
        value,
        unit: normalizarTexto(suffix),
        index: match.index
      });
    }

    return uniqueBy(matches, (item) => `${item.index}:${item.value}`);
  }

  function extraerMonto(texto) {
    return extraerMontos(texto)[0]?.value || null;
  }

  function normalizeRatePeriod(explicitPeriod = "", text = "", index = 0) {
    const normalizedExplicit = normalizarTexto(explicitPeriod);
    if (normalizedExplicit === "anual" || normalizedExplicit === "ea" || normalizedExplicit === "e a") return "anual";
    if (normalizedExplicit === "mensual") return "mensual";
    const snippet = getSnippet(text, index, 22, 28);
    if (/anual|ea|e\.a/.test(snippet)) return "anual";
    return "mensual";
  }

  function annualToMonthly(rateDecimal) {
    if (!Number.isFinite(rateDecimal)) return 0;
    return Math.pow(1 + rateDecimal, 1 / 12) - 1;
  }

  function monthlyToAnnual(rateDecimal) {
    if (!Number.isFinite(rateDecimal)) return 0;
    return Math.pow(1 + rateDecimal, 12) - 1;
  }

  function extraerTasas(texto) {
    const tasas = [];
    let match;

    while ((match = RATE_REGEX.exec(String(texto || ""))) !== null) {
      const percent = parseNumericValue(match[1]);
      if (!percent) continue;
      const period = normalizeRatePeriod(match[2], texto, match.index);
      const decimal = percent / 100;
      const monthlyDecimal = period === "anual" ? annualToMonthly(decimal) : decimal;
      const annualDecimal = period === "mensual" ? monthlyToAnnual(decimal) : decimal;

      tasas.push({
        raw: match[0],
        percent,
        period,
        explicitPeriod: Boolean(match[2]),
        decimal,
        monthlyDecimal,
        annualDecimal,
        index: match.index
      });
    }

    return uniqueBy(tasas, (item) => `${item.index}:${item.percent}:${item.period}`);
  }

  function extraerTasa(texto) {
    return extraerTasas(texto)[0] || null;
  }

  function detectarCategoriasGasto(normalizedText, index = null, rawText = "") {
    const target = index === null ? normalizedText : normalizarTexto(getSnippet(rawText, index, 20, 30));
    return Object.entries(EXPENSE_CATEGORY_HINTS)
      .filter(([, terms]) => terms.some((term) => target.includes(normalizarTexto(term))))
      .map(([category]) => category);
  }

  function extraerGastos(texto, montos = []) {
    const normalized = normalizarTexto(texto);
    const expenseWords = KEYWORD_GROUPS.gasto;
    const hasExpenseSignal = tieneAlguno(normalized, expenseWords) || detectarCategoriasGasto(normalized).length > 0;
    if (!hasExpenseSignal) return [];

    const categories = detectarCategoriasGasto(normalized);
    const gastos = [];

    montos.forEach((monto) => {
      const localCategories = detectarCategoriasGasto(normalized, monto.index, texto);
      const categoria = localCategories[0] || categories[0] || "otros";
      if (tieneAlguno(getSnippet(texto, monto.index), [...KEYWORD_GROUPS.ingreso, ...CREDIT_WORDS])) return;
      gastos.push({
        categoria,
        monto: monto.value,
        label: `${categoria} por ${formatCurrency(monto.value)}`
      });
    });

    if (!gastos.length && categories.length) {
      categories.forEach((categoria) => {
        gastos.push({
          categoria,
          monto: null,
          label: categoria
        });
      });
    }

    return uniqueBy(gastos, (item) => `${item.categoria}:${item.monto || 0}`);
  }

  function buildDebtEntry(monto, tasaPercent, period, explicitPeriod = false) {
    const decimal = (Number(tasaPercent) || 0) / 100;
    const monthlyRate = period === "anual" ? annualToMonthly(decimal) : decimal;
    const annualRate = period === "mensual" ? monthlyToAnnual(decimal) : decimal;
    return {
      monto,
      tasaPercent,
      tasaDecimal: decimal,
      period,
      explicitPeriod,
      monthlyRate,
      annualRate,
      label: `${formatCurrency(monto)} al ${formatPercent(tasaPercent)} ${formatPeriodLabel(period)}`
    };
  }

  function pairNearestRate(montoEntry, tasas) {
    let best = null;
    tasas.forEach((tasa) => {
      const distance = Math.abs((tasa.index || 0) - (montoEntry.index || 0));
      if (distance > 70) return;
      if (!best || distance < best.distance) {
        best = { tasa, distance };
      }
    });
    return best?.tasa || null;
  }

  function extraerDeudas(texto, montos = [], tasas = []) {
    const normalized = normalizarTexto(texto);
    const hasDebtSignal = tieneAlguno(normalized, DEBT_WORDS) || tieneAlguno(normalized, KEYWORD_GROUPS.unificacion);
    if (!hasDebtSignal) return [];

    const deudas = [];
    let match;

    while ((match = DIRECT_DEBT_REGEX.exec(String(texto || ""))) !== null) {
      const monto = parseAmountToken(match[1], match[2] || "");
      const tasaPercent = parseNumericValue(match[3]);
      if (!monto || !tasaPercent) continue;
      const period = normalizeRatePeriod(match[4], texto, match.index);
      deudas.push(buildDebtEntry(monto, tasaPercent, period, Boolean(match[4])));
    }

    if (!deudas.length) {
      montos.forEach((montoEntry) => {
        const snippet = getSnippet(texto, montoEntry.index);
        if (!tieneAlguno(normalizarTexto(snippet), DEBT_WORDS) && !tieneAlguno(normalized, DEBT_WORDS)) return;
        const nearestRate = pairNearestRate(montoEntry, tasas);
        if (nearestRate) {
          deudas.push(buildDebtEntry(montoEntry.value, nearestRate.percent, nearestRate.period, nearestRate.explicitPeriod));
        }
      });
    }

    if (!deudas.length && montos.length) {
      montos.forEach((montoEntry) => {
        const snippet = getSnippet(texto, montoEntry.index);
        if (!tieneAlguno(normalizarTexto(snippet), DEBT_WORDS) && !tieneAlguno(normalized, DEBT_WORDS)) return;
        deudas.push({
          monto: montoEntry.value,
          tasaPercent: null,
          tasaDecimal: null,
          period: null,
          explicitPeriod: false,
          monthlyRate: null,
          annualRate: null,
          label: formatCurrency(montoEntry.value)
        });
      });
    }

    return uniqueBy(deudas, (item) => `${item.monto}:${item.tasaPercent || 0}:${item.period || "na"}`);
  }

  function extraerPalabrasClave(normalizedText) {
    return uniqueBy(
      Object.entries(KEYWORD_GROUPS)
        .filter(([, terms]) => terms.some((term) => normalizedText.includes(normalizarTexto(term))))
        .map(([group]) => group),
      (value) => value
    );
  }

  function detectIncomeAmount(normalizedText, montos, context) {
    if (!montos.length) return null;
    if (isGoalPlanRequest(normalizedText) && !tieneAlguno(normalizedText, KEYWORD_GROUPS.ingreso)) {
      return null;
    }
    if (tieneAlguno(normalizedText, KEYWORD_GROUPS.ingreso)) {
      return montos[0].value;
    }
    if (montos.length === 1 && ["ahorro", "credito"].includes(context.ultimoTema || context.intent)) {
      return montos[0].value;
    }
    return null;
  }

  function detectCreditAmount(normalizedText, montos, ingresoDetectado) {
    if (!montos.length) return null;
    const candidates = montos.filter((item) => item.value !== ingresoDetectado);
    if (tieneAlguno(normalizedText, CREDIT_WORDS)) {
      return (candidates[0] || montos[0]).value;
    }
    return null;
  }

  function detectInvestmentProduct(normalizedText, context) {
    if (normalizedText.includes("cdt")) return "cdt";
    if (normalizedText.includes("cuenta remunerada") || normalizedText.includes("cuenta rentada")) return "cuenta_remunerada";
    if (normalizedText.includes("fiducuenta")) return "fiducuenta";
    if (normalizedText.includes("fondo conservador")) return "fondo_conservador";
    if (normalizedText.includes("fondo de inversion")) return "fondo_inversion";
    if (tieneAlguno(normalizedText, INVESTMENT_WORDS)) return "inversion";
    return context?.inversion?.product || null;
  }

  function detectInvestmentAmount(normalizedText, montos, ingresoDetectado, context) {
    if (!montos.length) return null;
    const isInvestmentContext = tieneAlguno(normalizedText, INVESTMENT_WORDS) || (context?.ultimoTema === "inversion");
    if (!isInvestmentContext) return null;

    const candidates = montos.filter((item) => item.value !== ingresoDetectado);
    return (candidates[0] || null)?.value || null;
  }

  function extraerPlazoMeses(texto) {
    const normalized = normalizarTexto(texto);
    const monthMatch = normalized.match(/(\d+)\s*(mes|meses)\b/);
    if (monthMatch) return Number(monthMatch[1]);

    const yearMatch = normalized.match(/(\d+)\s*(ano|anos)\b/);
    if (yearMatch) return Number(yearMatch[1]) * 12;

    return 0;
  }

  function extractEntities(texto, context) {
    const normalized = normalizarTexto(texto);
    const montos = extraerMontos(texto);
    const tasas = extraerTasas(texto);
    const deudas = extraerDeudas(texto, montos, tasas);
    const gastos = extraerGastos(texto, montos);
    const palabrasClave = extraerPalabrasClave(normalized);
    const categoriasGasto = uniqueBy(gastos.map((item) => item.categoria), (value) => value);
    const ingresoDetectado = detectIncomeAmount(normalized, montos, context);
    const montoCredito = detectCreditAmount(normalized, montos, ingresoDetectado);
    const investmentProduct = detectInvestmentProduct(normalized, context);
    const montoInversion = detectInvestmentAmount(normalized, montos, ingresoDetectado, context);

    return {
      normalized,
      montos,
      tasas,
      deudas,
      gastos,
      categoriasGasto,
      palabrasClave,
      ingresoDetectado,
      montoCredito,
      montoInversion,
      investmentProduct,
      plazoMeses: extraerPlazoMeses(texto)
    };
  }

  function isGoalPlanRequest(normalizedText) {
    if (tieneAlguno(normalizedText, GOAL_WORDS)) {
      return true;
    }

    if (/(cuanto|como|que)\s+(debo|tengo que|podria)?\s*ahorrar\s+para/.test(normalizedText)) {
      return true;
    }

    if (normalizedText.includes("ahorrar para") && /(\d+)\s*(mes|meses|ano|anos)\b/.test(normalizedText)) {
      return true;
    }

    return false;
  }

  function isSnapshotRequest(normalizedText) {
    return tieneAlguno(normalizedText, SNAPSHOT_WORDS);
  }

  function isInterestSimulationRequest(normalizedText) {
    return normalizedText.includes("interes compuesto") || normalizedText.includes("interes simple");
  }

  function isContextualFollowUp(normalizedText) {
    return CONTEXTUAL_TERMS.some((term) => normalizedText.includes(normalizarTexto(term)));
  }

  function isLiveRateQuestion(normalizedText) {
    return (
      /(hoy|actual|ahora|vigente|en este momento)/.test(normalizedText) &&
      /(promedio|tasa|tasas|rentabilidad|rendimiento|cdt)/.test(normalizedText)
    ) || /promedio de los cdt|como estan los cdt|en cuanto estan los cdt/.test(normalizedText);
  }

  function detectarIntento(texto, entities, context) {
    const normalized = entities.normalized;
    const tokens = tokenizar(normalized);
    if (!normalized) return null;

    if (tokens.length <= 4 && tieneAlguno(normalized, GREETINGS)) {
      return "saludo";
    }

    if (isGoalPlanRequest(normalized)) {
      return "meta";
    }

    if (isSnapshotRequest(normalized) || isInterestSimulationRequest(normalized)) {
      return "analisis";
    }

    if (entities.ingresoDetectado && montosSinOtroTema(normalized, entities, context)) {
      return context.ultimoTema === "ahorro" ? "ahorro" : "ingresos";
    }

    const scores = {
      ahorro: 0,
      deudas: 0,
      unificacion: 0,
      credito: 0,
      inversion: 0,
      gastos: 0,
      ingresos: 0,
      tasas: 0
    };

    Object.entries(KEYWORD_GROUPS).forEach(([group, terms]) => {
      terms.forEach((term) => {
        if (!normalized.includes(normalizarTexto(term))) return;
        if (group === "ahorro") scores.ahorro += 2;
        if (group === "deuda") scores.deudas += 2;
        if (group === "credito") scores.credito += 2;
        if (group === "inversion") scores.inversion += 2;
        if (group === "ingreso") scores.ingresos += 2;
        if (group === "tasa") scores.tasas += 2;
        if (["gasto", "comida", "ocio", "transporte", "vivienda", "servicios", "compras"].includes(group)) scores.gastos += 2;
        if (group === "unificacion") scores.unificacion += 4;
      });
    });

    if (/cuanto ahorro|cuanto deberia ahorrar|debo ahorrar/.test(normalized)) scores.ahorro += 4;
    if (entities.deudas.length) scores.deudas += 3;
    if (entities.tasas.length >= 2) scores.tasas += 3;
    if (entities.categoriasGasto.length) scores.gastos += 3;
    if (entities.montoCredito && scores.credito > 0) scores.credito += 2;
    if (entities.investmentProduct) scores.inversion += 4;
    if (entities.montoInversion && (scores.inversion > 0 || context.ultimoTema === "inversion")) scores.inversion += 3;
    if (entities.plazoMeses && context.ultimoTema === "inversion") scores.inversion += 2;
    if (entities.tasas.length && context.ultimoTema === "inversion") scores.inversion += 2;
    if (/(quiero|necesito|busco|me ofrecen).{0,20}(credito|prestamo)/.test(normalized)) scores.credito += 4;
    if (/(quiero|pienso|estoy pensando|me conviene|vale la pena).{0,28}(invertir|cdt|fiducuenta)/.test(normalized)) scores.inversion += 5;
    if ((normalized.includes("credito") || normalized.includes("prestamo")) && !normalized.includes("deuda")) scores.credito += 2;
    if (entities.montoCredito && entities.plazoMeses && entities.tasas.length) scores.credito += 4;
    if (scores.unificacion > 0 && (entities.tasas.length || context.tasas.length || entities.deudas.length || context.deudas.length)) scores.unificacion += 3;
    if (normalized.includes("no me alcanza")) scores.gastos += 2;
    if (normalized.includes("me conviene") && context.ultimoTema === "unificacion") scores.unificacion += 2;
    if (normalized.includes("me conviene") && context.ultimoTema === "credito") scores.credito += 2;
    if (normalized.includes("me conviene") && context.ultimoTema === "inversion") scores.inversion += 2;

    const best = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    if (best) return best;
    if (isContextualFollowUp(normalized) && context.ultimoTema) return context.ultimoTema;
    if (context.ultimoTema === "inversion" && (entities.montoInversion || entities.plazoMeses || entities.tasas.length)) return "inversion";
    if (entities.ingresoDetectado) return context.ultimoTema === "ahorro" ? "ahorro" : "ingresos";
    if (entities.tasas.length >= 2) return "tasas";
    if (entities.deudas.length) return "deudas";
    if (entities.categoriasGasto.length) return "gastos";
    return null;
  }

  function montosSinOtroTema(normalized, entities, context) {
    if (!entities.ingresoDetectado) return false;
    if (entities.tasas.length || entities.deudas.length || entities.categoriasGasto.length) return false;
    if (tieneAlguno(normalized, CREDIT_WORDS) && context.ultimoTema !== "ahorro") return false;
    return true;
  }

  function mergeRates(existingRates, newRates) {
    return uniqueBy([...(existingRates || []), ...(newRates || [])], (item) => `${item.percent}:${item.period}`);
  }

  function mergeDebts(existingDebts, newDebts) {
    return uniqueBy([...(existingDebts || []), ...(newDebts || [])], (item) => `${item.monto}:${item.tasaPercent || 0}:${item.period || "na"}`);
  }

  function mergeExpenses(existingExpenses, newExpenses) {
    return uniqueBy([...(existingExpenses || []), ...(newExpenses || [])], (item) => `${item.categoria}:${item.monto || 0}`);
  }

  function updateContext(currentContext, analysis) {
    const next = cloneContext(currentContext);
    if (analysis.intent) {
      next.intent = analysis.intent;
      if (analysis.intent !== "saludo") {
        next.ultimoTema = analysis.intent;
      }
    }

    if (analysis.entities.ingresoDetectado) {
      next.ingreso = analysis.entities.ingresoDetectado;
    }

    next.tasas = mergeRates(next.tasas, analysis.entities.tasas).slice(-8);
    next.deudas = mergeDebts(next.deudas, analysis.entities.deudas).slice(-8);
    next.gastos = mergeExpenses(next.gastos, analysis.entities.gastos).slice(-10);
    next.palabrasClave = uniqueBy([...(next.palabrasClave || []), ...analysis.entities.palabrasClave], (value) => value).slice(-20);
    next.ultimaPregunta = analysis.rawText;

    if (analysis.intent === "inversion" || next.ultimoTema === "inversion") {
      next.inversion = {
        ...(next.inversion || {}),
        product: analysis.entities.investmentProduct || next.inversion?.product || null,
        amount: analysis.entities.montoInversion || next.inversion?.amount || null,
        rate: analysis.entities.tasas[0] || next.inversion?.rate || null,
        months: analysis.entities.plazoMeses || next.inversion?.months || null
      };
    }

    return next;
  }

  function buildDecision(type, rule, direct, explanation, suggestion = "", data = {}) {
    return {
      type,
      rule,
      direct,
      explanation,
      suggestion,
      data
    };
  }

  function renderDecision(decision) {
    return [decision.direct, decision.explanation, decision.suggestion]
      .filter(Boolean)
      .join("\n");
  }

  function getSavingsBand(ingreso, hasDebts) {
    if (hasDebts) {
      return {
        percent: 0.05,
        bandLabel: "baja por deudas"
      };
    }

    if (ingreso <= 2000000) {
      return { percent: 0.05, bandLabel: "baja" };
    }
    if (ingreso <= 5000000) {
      return { percent: 0.10, bandLabel: "media" };
    }
    if (ingreso <= 8000000) {
      return { percent: 0.15, bandLabel: "media alta" };
    }
    return { percent: 0.20, bandLabel: "alta" };
  }

  function buildSavingsDecision(updatedContext) {
    if (!updatedContext.ingreso) {
      return buildDecision(
        "question",
        "ahorro",
        "Cuanto ganas al mes mas o menos?",
        "Con ese dato te calculo un ahorro realista y no una respuesta generica."
      );
    }

    const hasDebts = updatedContext.deudas.length > 0;
    const band = getSavingsBand(updatedContext.ingreso, hasDebts);
    const monthlySavings = Math.round(updatedContext.ingreso * band.percent);
    const starterSavings = Math.round(updatedContext.ingreso * 0.05);

    if (hasDebts) {
      return buildDecision(
        "direct",
        "ahorro",
        `Con un ingreso de ${formatCurrency(updatedContext.ingreso)}, yo arrancaria con ${formatCurrency(monthlySavings)} al mes para ahorro y priorizaria el resto del extra a tus deudas.`,
        `Te recomiendo ese 5% porque primero conviene frenar intereses. Cuando limpies deudas, puedes subir a 10% o mas sin ahorcarte.`,
        "Si quieres, te digo cual deuda atacar primero.",
        {
          income: updatedContext.ingreso,
          recommendedPercent: band.percent,
          monthlySavings,
          starterSavings,
          hasDebts
        }
      );
    }

    return buildDecision(
      "direct",
      "ahorro",
      `Si ganas ${formatCurrency(updatedContext.ingreso)}, un ahorro sano hoy seria ${formatCurrency(monthlySavings)} al mes.`,
      `Eso es el ${formatPercent(band.percent * 100)} de tu ingreso y encaja en una recomendacion de ${formatPercent(5)} a ${formatPercent(20)} segun capacidad.`,
      monthlySavings !== starterSavings
        ? `Si quieres empezar mas suave, prueba con ${formatCurrency(starterSavings)} y subelo despues.`
        : "Si quieres, te lo divido por semana o quincena.",
      {
        income: updatedContext.ingreso,
        recommendedPercent: band.percent,
        monthlySavings,
        starterSavings,
        hasDebts
      }
    );
  }

  function estimateDebtInterest(debt, months = 12) {
    if (!debt?.monto || !debt?.monthlyRate) return 0;
    return debt.monto * debt.monthlyRate * months;
  }

  function sortDebtsByPriority(debts) {
    return debts
      .filter((debt) => Number.isFinite(debt.monthlyRate))
      .map((debt) => ({
        ...debt,
        estimatedInterest12m: estimateDebtInterest(debt, 12)
      }))
      .sort((a, b) => b.monthlyRate - a.monthlyRate || b.estimatedInterest12m - a.estimatedInterest12m);
  }

  function buildDebtDecision(updatedContext) {
    const ratedDebts = sortDebtsByPriority(updatedContext.deudas);
    if (ratedDebts.length >= 2) {
      const target = ratedDebts[0];
      return buildDecision(
        "direct",
        "deudas",
        `Tu prioridad deberia ser la deuda de ${formatCurrency(target.monto)} al ${formatPercent(target.tasaPercent)} ${formatPeriodLabel(target.period)}.`,
        `Es la tasa mas alta, asi que es la que mas rapido encarece tus pagos. En 12 meses podria comerte aprox ${formatCurrency(target.estimatedInterest12m)} en interes simple.`,
        "Manten el minimo en las otras y manda todo el extra a esa primero.",
        {
          orderedDebts: ratedDebts,
          topDebt: target
        }
      );
    }

    if (ratedDebts.length === 1) {
      const target = ratedDebts[0];
      return buildDecision(
        "direct",
        "deudas",
        `Por ahora tu deuda mas urgente es ${formatCurrency(target.monto)} al ${formatPercent(target.tasaPercent)} ${formatPeriodLabel(target.period)}.`,
        `La prioridad sale de la tasa: entre mas alta, mas caro te resulta seguirla arrastrando.`,
        "Si tienes otras deudas, pasamelas con monto y tasa y te las ordeno.",
        {
          orderedDebts: ratedDebts,
          topDebt: target
        }
      );
    }

    if (updatedContext.deudas.length === 1) {
      return buildDecision(
        "question",
        "deudas",
        `Ya tengo registrada una deuda de ${formatCurrency(updatedContext.deudas[0].monto)}. A que tasa va?`,
        "Con la tasa la puedo comparar y decirte si conviene priorizarla o refinanciarla."
      );
    }

    if (updatedContext.tasas.length >= 2) {
      const sortedRates = [...updatedContext.tasas].sort((a, b) => b.monthlyDecimal - a.monthlyDecimal);
      const highest = sortedRates[0];
      return buildDecision(
        "direct",
        "deudas",
        `Si tus deudas estan entre ${sortedRates.map((rate) => formatPercent(rate.percent)).join(" y ")}, paga primero la que este al ${formatPercent(highest.percent)} ${formatPeriodLabel(highest.period)}.`,
        "La razon es simple: es la que mas intereses te cobra mes a mes.",
        "Si me das los montos, te digo cuanto te cuesta cada una."
      );
    }

    return buildDecision(
      "question",
      "deudas",
      "Pasame cada deuda con monto y tasa.",
      "Con eso te las ordeno de la mas urgente a la menos costosa."
    );
  }

  function averageMonthlyRate(rateEntries) {
    if (!rateEntries.length) return 0;
    return rateEntries.reduce((sum, rate) => sum + rate.monthlyDecimal, 0) / rateEntries.length;
  }

  function buildUnificationDecision(analysis, updatedContext, previousContext) {
    const currentDebtRates = previousContext.deudas
      .filter((debt) => Number.isFinite(debt.monthlyRate))
      .map((debt) => ({
        percent: debt.tasaPercent,
        period: debt.period,
        monthlyDecimal: debt.monthlyRate,
        annualDecimal: debt.annualRate
      }));

    const currentRates = analysis.entities.tasas.length > 1
      ? analysis.entities.tasas.slice(0, -1)
      : currentDebtRates.length
        ? currentDebtRates
        : previousContext.tasas;

    const nuevaTasa = analysis.entities.tasas.length
      ? analysis.entities.tasas[analysis.entities.tasas.length - 1]
      : null;

    if (!currentRates.length) {
      return buildDecision(
        "question",
        "unificacion",
        "Necesito las tasas actuales de tus deudas para compararlas.",
        "La nueva tasa solo tiene sentido si baja el promedio real que hoy estas pagando."
      );
    }

    if (!nuevaTasa) {
      return buildDecision(
        "question",
        "unificacion",
        "Cual seria la nueva tasa de la deuda unificada?",
        "Con eso la comparo contra tu promedio actual y te digo si conviene o no."
      );
    }

    const averageMonthly = averageMonthlyRate(currentRates);
    const conviene = nuevaTasa.monthlyDecimal < averageMonthly;
    const averageAnnual = monthlyToAnnual(averageMonthly);

    return buildDecision(
      "direct",
      "unificacion",
      conviene
        ? `Si te ofrecen ${formatPercent(nuevaTasa.percent)} ${formatPeriodLabel(nuevaTasa.period)}, si conviene unificar.`
        : `Con ${formatPercent(nuevaTasa.percent)} ${formatPeriodLabel(nuevaTasa.period)}, no te conviene unificar.`,
      `Tu promedio actual ronda ${formatPercentFromDecimal(averageMonthly)} mensual, o aprox ${formatPercentFromDecimal(averageAnnual)} EA. La nueva tasa queda en aprox ${formatPercentFromDecimal(nuevaTasa.annualDecimal)} EA.`,
      conviene
        ? "Solo valida que no te alarguen demasiado el plazo ni te cobren costos extras."
        : "Solo tendria sentido si, ademas de bajar cuota, tambien baja el costo total.",
      {
        conviene,
        averageMonthlyRate: averageMonthly,
        newRate: nuevaTasa
      }
    );
  }

  function chooseBestRate(rateEntries) {
    return [...rateEntries].sort((a, b) => a.annualDecimal - b.annualDecimal || a.monthlyDecimal - b.monthlyDecimal)[0] || null;
  }

  function buildRateComparisonDecision(rateEntries, rule = "tasas") {
    const best = chooseBestRate(rateEntries);
    const worst = [...rateEntries].sort((a, b) => b.annualDecimal - a.annualDecimal)[0] || null;

    if (!best) {
      return buildDecision(
        "question",
        rule,
        "Pasame al menos dos tasas para compararlas.",
        "Las convierto al mismo periodo para decirte cual es mejor."
      );
    }

    return buildDecision(
      "direct",
      rule,
      `La tasa mas conveniente es ${formatPercent(best.percent)} ${formatPeriodLabel(best.period)}.`,
      worst
        ? `Comparando en tasa efectiva anual, esa opcion queda cerca de ${formatPercentFromDecimal(best.annualDecimal)} EA frente a ${formatPercentFromDecimal(worst.annualDecimal)} EA de la mas cara.`
        : `La convierto a tasa efectiva anual para compararla en igualdad de condiciones.`,
      rule === "credito"
        ? "Si quieres, ahora te calculo la cuota con monto y plazo."
        : "Entre menor tasa efectiva, menos interes terminas pagando.",
      {
        bestRate: best,
        worstRate: worst
      }
    );
  }

  function calcularCuota(monto, tasaMensual, meses) {
    if (!monto || !meses) return 0;
    if (!tasaMensual) return monto / meses;
    return monto * (tasaMensual * Math.pow(1 + tasaMensual, meses)) / (Math.pow(1 + tasaMensual, meses) - 1);
  }

  function buildCreditDecision(analysis, updatedContext) {
    const rateEntries = analysis.entities.tasas.length ? analysis.entities.tasas : updatedContext.tasas;
    if (!rateEntries.length) {
      return buildDecision(
        "question",
        "credito",
        "A que tasa te ofrecen el credito?",
        "Con la tasa puedo decirte si esta caro, barato o compararlo con otra opcion."
      );
    }

    if (analysis.entities.tasas.length >= 2) {
      return buildRateComparisonDecision(analysis.entities.tasas, "credito");
    }

    const rateEntry = rateEntries[0];
    const monto = analysis.entities.montoCredito;
    const meses = analysis.entities.plazoMeses;

    if (!monto) {
      return buildDecision(
        "question",
        "credito",
        `Ya tengo la tasa: ${formatPercent(rateEntry.percent)} ${formatPeriodLabel(rateEntry.period)}. Cuanto quieres pedir?`,
        "Con el monto te puedo aterrizar la recomendacion a una cuota real."
      );
    }

    if (!meses) {
      return buildDecision(
        "question",
        "credito",
        `Para ${formatCurrency(monto)} al ${formatPercent(rateEntry.percent)} ${formatPeriodLabel(rateEntry.period)}, a cuantos meses lo quieres?`,
        "El plazo cambia mucho la cuota y el interes total."
      );
    }

    const tasaMensual = rateEntry.monthlyDecimal;
    const cuota = calcularCuota(monto, tasaMensual, meses);
    const totalPagado = cuota * meses;
    const interesTotal = totalPagado - monto;

    return buildDecision(
      "direct",
      "credito",
      `Para ${formatCurrency(monto)} al ${formatPercent(rateEntry.percent)} ${formatPeriodLabel(rateEntry.period)} a ${meses} meses, la cuota seria aprox ${formatCurrency(cuota)}.`,
      `Ese credito terminaria costandote cerca de ${formatCurrency(interesTotal)} en intereses. La tasa equivale a aprox ${formatPercentFromDecimal(rateEntry.annualDecimal)} EA.`,
      "Menor tasa siempre es mejor, pero bajar plazo tambien reduce bastante el costo total.",
      {
        amount: monto,
        months: meses,
        payment: cuota,
        totalInterest: interesTotal,
        rate: rateEntry
      }
    );
  }

  function summarizeLeakCategories(categories) {
    if (!categories.length) return "";
    if (categories.length === 1) return categories[0];
    if (categories.length === 2) return `${categories[0]} y ${categories[1]}`;
    return `${categories[0]}, ${categories[1]} y ${categories[2]}`;
  }

  function buildExpenseSuggestion(primaryCategory) {
    if (primaryCategory === "comida") {
      return "Separala en mercado, restaurantes y domicilios para ver donde recortar primero.";
    }
    if (primaryCategory === "ocio") {
      return "Pon un tope semanal a salidas y revisa suscripciones para cortar lo mas facil.";
    }
    if (primaryCategory === "transporte") {
      return "Separa gasolina, transporte publico y apps para detectar que te dispara mas el mes.";
    }
    return "Si quieres, te propongo categorias concretas para ordenarlo mejor.";
  }

  function buildExpenseDecision(analysis, updatedContext) {
    const categoryCount = {};
    updatedContext.gastos.forEach((gasto) => {
      categoryCount[gasto.categoria] = (categoryCount[gasto.categoria] || 0) + 1;
    });

    const fugaCategorias = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
      .slice(0, 3);

    if (!fugaCategorias.length && analysis.entities.categoriasGasto.length) {
      fugaCategorias.push(...analysis.entities.categoriasGasto);
    }

    if (fugaCategorias.length) {
      const primaryCategory = fugaCategorias[0];
      return buildDecision(
        "direct",
        "gastos",
        fugaCategorias.length === 1
          ? `La fuga que veo mas clara esta en ${primaryCategory}.`
          : `Veo fugas probables en ${summarizeLeakCategories(fugaCategorias)}.`,
        primaryCategory === "comida"
          ? "Comida y domicilios suelen desordenar el mes por frecuencia, aunque cada gasto parezca pequeno."
          : primaryCategory === "ocio"
            ? "Ocio y suscripciones se acumulan facil porque son gastos pequenos pero repetidos."
            : "La mejor pista sale de categorizar y medir frecuencia, no solo de mirar un gasto suelto.",
        buildExpenseSuggestion(primaryCategory),
        {
          fugas: fugaCategorias
        }
      );
    }

    if (analysis.entities.normalized.includes("no me alcanza")) {
      return buildDecision(
        "question",
        "gastos",
        updatedContext.ingreso
          ? `Con un ingreso de ${formatCurrency(updatedContext.ingreso)}, cuales son tus 3 gastos mas pesados?`
          : "Cuales son tus 3 gastos mas pesados?",
        "Con eso detecto si el problema es una fuga de gasto, una deuda cara o falta de ingreso."
      );
    }

    return buildDecision(
      "question",
      "gastos",
      "En que sientes que se te va mas la plata: comida, transporte, arriendo u ocio?",
      "Con una categoria concreta te doy una recomendacion mucho mas util."
    );
  }

  function buildIncomeDecision(updatedContext) {
    if (!updatedContext.ingreso) {
      return buildDecision(
        "question",
        "ingresos",
        "Cuanto ganas al mes mas o menos?",
        "Con eso puedo ayudarte con ahorro, deuda o capacidad de pago."
      );
    }

    return buildDecision(
      "direct",
      "ingresos",
      `Listo, tomo tu ingreso mensual como ${formatCurrency(updatedContext.ingreso)}.`,
      "Ya lo guarde en el contexto para no volver a preguntartelo en el siguiente calculo.",
      "Si quieres, ahora dime 'cuanto ahorro' y te lo respondo directo.",
      {
        income: updatedContext.ingreso
      }
    );
  }

  function getInvestmentProductLabel(product) {
    if (product === "cdt") return "un CDT";
    if (product === "cuenta_remunerada") return "una cuenta remunerada";
    if (product === "fiducuenta") return "una fiducuenta";
    if (product === "fondo_conservador") return "un fondo conservador";
    if (product === "fondo_inversion") return "un fondo de inversion";
    return "una inversion de bajo riesgo";
  }

  function isLowLiquidityProduct(product) {
    return ["cdt"].includes(product);
  }

  function futureValue(amount, rateEntry, months) {
    if (!amount || !rateEntry || !months) return 0;
    if (rateEntry.period === "anual") {
      return amount * Math.pow(1 + rateEntry.decimal, months / 12);
    }
    return amount * Math.pow(1 + rateEntry.decimal, months);
  }

  function buildInvestmentDecision(analysis, updatedContext) {
    const investmentState = {
      ...(updatedContext.inversion || {}),
      product: analysis.entities.investmentProduct || updatedContext.inversion?.product || "inversion",
      amount: analysis.entities.montoInversion || updatedContext.inversion?.amount || null,
      rate: analysis.entities.tasas[0] || updatedContext.inversion?.rate || null,
      months: analysis.entities.plazoMeses || updatedContext.inversion?.months || null
    };
    const normalized = analysis.entities.normalized;
    const productLabel = getInvestmentProductLabel(investmentState.product);
    const topDebt = sortDebtsByPriority(updatedContext.deudas)[0] || null;

    if (isLiveRateQuestion(normalized) && !analysis.entities.tasas.length) {
      return buildDecision(
        "direct",
        "inversion",
        investmentState.product === "cdt"
          ? "No tengo el promedio de los CDT de hoy en tiempo real."
          : `No tengo la tasa promedio actual de ${productLabel} en tiempo real.`,
        "Yo solo calculo y comparo la informacion que me des para ayudarte a tomar una mejor decision.",
        investmentState.product === "cdt"
          ? "Si me pasas tasas, plazos o las ofertas que te dieron, te digo cual te conviene mas."
          : `Si me pasas tasas, plazos o las opciones que estas viendo para ${productLabel}, te las comparo.`
      );
    }

    if (!investmentState.amount && !investmentState.rate && !investmentState.months) {
      return buildDecision(
        "direct",
        "inversion",
        `${productLabel.charAt(0).toUpperCase() + productLabel.slice(1)} puede salir mejor que dejar la plata quieta, pero no siempre es mejor que ahorrar o pagar deuda.`,
        isLowLiquidityProduct(investmentState.product)
          ? "La clave del CDT es que te da una tasa definida, pero te quita liquidez: normalmente dejas esa plata quieta hasta el vencimiento."
          : "La clave es balancear tres cosas: rendimiento, liquidez y riesgo. Productos parecidos al CDT suelen dar mas rendimiento que dejar la plata quieta, pero no siempre la puedes mover igual de facil.",
        topDebt
          ? `Si tienes deudas caras, primero compara su tasa con la del producto. Si la deuda cuesta mas, normalmente gana pagar deuda primero. ¿Que monto, plazo y tasa te ofrecen?`
          : `Si quieres, te comparo ${productLabel} contra ahorrar normal. Pasame monto, plazo y tasa.`
      );
    }

    if (investmentState.rate && !investmentState.rate.explicitPeriod) {
      return buildDecision(
        "question",
        "inversion",
        `Ya tengo el monto, pero me falta una aclaracion de tasa para ${productLabel}.`,
        "En productos como CDT lo correcto es comparar con la tasa efectiva anual o aclarar si la tasa es mensual.",
        "Esa tasa es anual/EA o mensual?"
      );
    }

    if (!investmentState.amount) {
      return buildDecision(
        "question",
        "inversion",
        `Si quieres comparar ${productLabel}, cuanto pondrias a invertir?`,
        "Con el monto te puedo calcular cuanto ganarias realmente."
      );
    }

    if (!investmentState.rate) {
      return buildDecision(
        "question",
        "inversion",
        `Ya tengo ${formatCurrency(investmentState.amount)} como monto para ${productLabel}. A que tasa te lo ofrecen?`,
        "Sin tasa no puedo decirte si realmente te conviene."
      );
    }

    if (!investmentState.months) {
      return buildDecision(
        "question",
        "inversion",
        `Para ${formatCurrency(investmentState.amount)} en ${productLabel}, a cuanto tiempo lo dejarias?`,
        "El plazo cambia mucho la ganancia y tambien tu liquidez.",
        "Dime el plazo en meses o anos."
      );
    }

    const finalValue = futureValue(investmentState.amount, investmentState.rate, investmentState.months);
    const earnings = finalValue - investmentState.amount;
    const annualYield = investmentState.rate.annualDecimal;

    if (topDebt?.annualRate && topDebt.annualRate > annualYield) {
      return buildDecision(
        "direct",
        "inversion",
        `Para ti, hoy no saldria mejor ${productLabel} que bajar tu deuda mas cara.`,
        `Tu deuda prioritaria ronda ${formatPercentFromDecimal(topDebt.annualRate)} EA, mientras ${productLabel} va cerca de ${formatPercentFromDecimal(annualYield)} EA. Financiera y matematicamente gana pagar la deuda primero.`,
        `Si aun asi metieras ${formatCurrency(investmentState.amount)} por ${investmentState.months} meses, terminarias con aprox ${formatCurrency(finalValue)} y ganarias ${formatCurrency(earnings)}.`,
        {
          product: investmentState.product,
          amount: investmentState.amount,
          months: investmentState.months,
          finalValue,
          earnings,
          annualYield
        }
      );
    }

    return buildDecision(
      "direct",
      "inversion",
      `Si metes ${formatCurrency(investmentState.amount)} en ${productLabel} al ${formatPercent(investmentState.rate.percent)} ${formatPeriodLabel(investmentState.rate.period)} por ${investmentState.months} meses, terminarias con aprox ${formatCurrency(finalValue)}.`,
      `Eso te dejaria una ganancia cercana a ${formatCurrency(earnings)}. Frente a dejar la plata quieta, si puede salir mejor.`,
      isLowLiquidityProduct(investmentState.product)
        ? "Te conviene si no vas a necesitar esa plata antes del vencimiento y ya tienes cubierto tu colchon basico."
        : "Te conviene si el nivel de liquidez y riesgo del producto si encaja con tu objetivo.",
      {
        product: investmentState.product,
        amount: investmentState.amount,
        months: investmentState.months,
        finalValue,
        earnings,
        annualYield
      }
    );
  }

  function buildGreetingDecision() {
    return buildDecision(
      "direct",
      "saludo",
      "Hola, soy Walle.",
      "Si me dices tu ingreso, tus deudas, tus tasas o tus gastos, te respondo con calculo y contexto.",
      "Por ejemplo: 'gano 4 millones' o 'tengo una deuda de 2 palos al 2% mensual'."
    );
  }

  function buildUnknownDecision() {
    return buildDecision(
      "question",
      "desconocido",
      "No me alcanza con eso para darte una recomendacion seria.",
      "Puedo ayudarte con ahorro, gastos, deudas, unificacion o creditos usando tus numeros.",
      "Prueba con algo como: 'gano 4 millones', 'gasto mucho en comida' o 'tengo dos tasas de 2% y 1.5%'."
    );
  }

  function shouldPassToLegacy(intent, analysis) {
    if (intent === "meta") return true;
    if (intent === "analisis") return true;
    if (isInterestSimulationRequest(analysis.entities.normalized)) return true;
    return false;
  }

  function applyRules(analysis, updatedContext, previousContext) {
    switch (analysis.intent) {
      case "saludo":
        return buildGreetingDecision();
      case "ingresos":
        return buildIncomeDecision(updatedContext);
      case "ahorro":
        return buildSavingsDecision(updatedContext);
      case "deudas":
        return buildDebtDecision(updatedContext);
      case "unificacion":
        return buildUnificationDecision(analysis, updatedContext, previousContext);
      case "credito":
        return buildCreditDecision(analysis, updatedContext);
      case "inversion":
        return buildInvestmentDecision(analysis, updatedContext);
      case "gastos":
        return buildExpenseDecision(analysis, updatedContext);
      case "tasas":
        return buildRateComparisonDecision(updatedContext.tasas.length ? updatedContext.tasas : analysis.entities.tasas);
      default:
        return buildUnknownDecision();
    }
  }

  function processMessage(texto, options = {}) {
    const previousContext = cloneContext(options.context || {});
    const entities = extractEntities(texto, previousContext);
    const intent = detectarIntento(texto, entities, previousContext);
    const analysis = {
      rawText: texto,
      intent,
      entities
    };
    const updatedContext = updateContext(previousContext, analysis);

    if (!intent) {
      const decision = buildUnknownDecision();
      return {
        intent: null,
        entities,
        context: updatedContext,
        decision,
        response: renderDecision(decision),
        passToLegacy: false
      };
    }

    if (shouldPassToLegacy(intent, analysis)) {
      return {
        intent,
        entities,
        context: updatedContext,
        decision: null,
        response: "",
        passToLegacy: true
      };
    }

    const decision = applyRules(analysis, updatedContext, previousContext);
    return {
      intent,
      entities,
      context: updatedContext,
      decision,
      response: renderDecision(decision),
      passToLegacy: false
    };
  }

  return {
    createEmptyContext,
    normalizarTexto,
    extraerMonto,
    extraerMontos,
    extraerTasa,
    extraerTasas,
    extraerDeudas,
    extraerPalabrasClave,
    extraerPlazoMeses,
    detectarIntento,
    processMessage,
    formatCurrency,
    formatPercent
  };
});
