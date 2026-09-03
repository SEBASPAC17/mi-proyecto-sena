let API_URL = window.DinamicashApi?.getBaseUrl?.() || "http://localhost:3000";
let usuario = null;
let metaEnEdicion = null;
let movimientoEnEdicion = null;
let loaderTipInterval = null;
let volverAMovimiento = false;
let localeActual = "es-CO";
let chartTextColor = "#ffffff";
let ultimaSimulacionRenta = null;
let ultimoReporte = null;
let lastIntent = null;
let lastSubintent = null;
let lastTopicDetail = null;
let wallePdfLogoDataUrl = null;
let lastWalleResponseSignature = null;
let walleFinancialSnapshot = null;
let walleFinancialSnapshotAt = 0;
let inactivityTimerId = null;
let sessionClosingForInactivity = false;
const MAX_WALLE_HISTORY = 20;
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const walleConversationState = {
  followUpDepth: 0,
  lastQuestion: "",
  messages: [],
  guidedModule: ""
};

const WALLE_QUICK_PROMPTS = [
  { key: "ahorro", number: "1", label: "Ahorro", prompt: "Ahorro" },
  { key: "movimientos", number: "2", label: "Movimientos", prompt: "Movimientos" },
  { key: "diagnostico", number: "3", label: "Mi diagnóstico", prompt: "analiza mis finanzas", direct: true },
  { key: "deudas", number: "4", label: "Deudas", prompt: "Deudas" },
  { key: "credito", number: "5", label: "Crédito", prompt: "Crédito" },
  { key: "tarjetas", number: "6", label: "Tarjetas", prompt: "Tarjetas" }
];

const WALLE_GUIDED_MODULES = {
  ahorro: {
    aliases: ["1", "ahorro", "ahorrar", "quiero ahorrar", "meta de ahorro"],
    buttons: [
      { number: "1", label: "Nueva meta", action: { type: "open_goal" } },
      { number: "2", label: "Ver progreso", prompt: "analiza mis metas" },
      { number: "3", label: "Cuánto ahorrar", prompt: "cuanto debo ahorrar al mes" },
      { number: "4", label: "Fondo de emergencia", prompt: "cuanto necesito de fondo de emergencia" }
    ],
    response: [
      "¡Excelente! Vamos a trabajar en tus ahorros.",
      "¿Deseas:",
      "1. Crear una meta en la app",
      "2. Revisar el progreso de tus metas",
      "3. Calcular cuánto ahorrar al mes",
      "4. Calcular tu fondo de emergencia"
    ].join("\n")
  },
  movimientos: {
    aliases: ["2", "movimiento", "movimientos", "gastos e ingresos"],
    buttons: [
      { number: "1", label: "Registrar gasto", action: { type: "open_movement", movementType: "gasto" } },
      { number: "2", label: "Registrar ingreso", action: { type: "open_movement", movementType: "ingreso" } },
      { number: "3", label: "Resumen mensual", prompt: "analiza mis finanzas" },
      { number: "4", label: "Categorías", action: { type: "open_categories" } }
    ],
    response: [
      "Registra o revisa el dinero que entra y sale.",
      "¿Deseas:",
      "1. Registrar gasto",
      "2. Registrar ingreso",
      "3. Ver tu resumen mensual",
      "4. Gestionar categorías"
    ].join("\n")
  },
  deudas: {
    aliases: ["4", "deuda", "deudas", "tengo deudas", "tengo muchas deudas"],
    buttons: [
      { number: "1", label: "Ordenar deudas", prompt: "quiero ordenar mis deudas" },
      { number: "2", label: "Unificar deudas", prompt: "quiero saber si me conviene unificar mis deudas" },
      { number: "3", label: "Capacidad de pago", prompt: "cuanto me puedo endeudar" },
      { number: "4", label: "Plan para pagarlas", prompt: "como puedo salir de mis deudas" }
    ],
    response: [
      "Vamos a tomar una decisión concreta sobre tus deudas.",
      "¿Deseas:",
      "1. Ordenarlas por costo",
      "2. Evaluar una unificación",
      "3. Calcular tu capacidad de pago",
      "4. Armar un plan para pagarlas"
    ].join("\n")
  },
  credito: {
    aliases: ["5", "credito", "crédito", "prestamo", "préstamo"],
    buttons: [
      { number: "1", label: "Calcular cuota", prompt: "quiero calcular la cuota de un credito" },
      { number: "2", label: "Comparar tasas", prompt: "quiero comparar tasas de credito" },
      { number: "3", label: "Cuánto puedo pagar", prompt: "cuanto me puedo endeudar" },
      { number: "4", label: "Convertir tasa", prompt: "cuanto equivale una tasa mensual en EA" }
    ],
    response: [
      "Revisemos el crédito antes de aceptarlo.",
      "¿Deseas:",
      "1. Calcular cuota e intereses",
      "2. Comparar dos tasas",
      "3. Estimar una cuota prudente",
      "4. Convertir tasa mensual a EA"
    ].join("\n")
  },
  tarjetas: {
    aliases: ["6", "tarjeta", "tarjetas", "tarjeta de credito", "tarjetas de credito"],
    buttons: [
      { number: "1", label: "Uso responsable", prompt: "como usar bien una tarjeta de credito" },
      { number: "2", label: "Pago mínimo", prompt: "que pasa si pago solo el minimo de la tarjeta" },
      { number: "3", label: "Registrar compra", action: { type: "open_movement", movementType: "gasto" } },
      { number: "4", label: "Corte y pago", prompt: "cual es la diferencia entre fecha de corte y fecha limite de pago" }
    ],
    response: [
      "Usa tu tarjeta sin perder el control.",
      "¿Deseas:",
      "1. Revisar buenas prácticas",
      "2. Entender el pago mínimo",
      "3. Registrar una compra",
      "4. Entender corte y fecha límite"
    ].join("\n")
  }
};

const STORAGE_KEYS = {
  config: "dinamicash_config",
  notifications: "dinamicash_notifications",
  appLanguage: "dinamicash_language",
  onboardingSeen: "dinamicash_onboarding_seen",
  walleMemory: "dinamicash_walle_memory"
};

const DEFAULT_CONFIG = { theme: "dark", language: "es" };
const DEFAULT_NOTIFICATIONS = { metas: true, resumen: true, seguridad: true };

const UI_TEXT = {
  es: {
    loader: "Cargando tu mejor versión financiera...",
    loaderLabel: "Walle está contigo",
    ultimo30: "Últimos 30 días",
    nuevoMovimiento: "Nuevo movimiento",
    all: "Todos",
    income: "Ingresos",
    expense: "Gastos",
    home: "Inicio",
    reports: "Reportes",
    goals: "Metas",
    tax: "Renta",
    profile: "Perfil",
    settings: "Configuración",
    settingsSaved: "Configuración guardada correctamente.",
    notificationsSaved: "Preferencias guardadas correctamente.",
    profileSaved: "Perfil actualizado correctamente.",
    passwordSaved: "PIN actualizado correctamente.",
    helpSaved: "Solicitud enviada correctamente.",
    logoutConfirm: "¿Quieres cerrar sesión ahora?",
    profileNameRequired: "Completa nombre y correo",
    securityRequired: "Completa todos los campos de seguridad",
    securityMatch: "El nuevo PIN y la confirmacion deben coincidir",
    securityPinInvalid: "El PIN debe tener exactamente 4 digitos numericos",
    helpRequired: "Completa el mensaje de soporte",
    categoryRequired: "Selecciona una categoría",
    amountInvalid: "Ingresa un monto válido",
    categoryNameRequired: "Debes escribir una categoría",
    categoriesError: "No se pudieron cargar las categorías",
    configQuickAria: "Abrir configuración",
    helpAria: "Abrir ayuda y soporte",
    tourAria: "Ver recorrido guiado",
    notificationsSummaryAll: "Todas tus notificaciones están activas.",
    notificationsSummarySome: "Tienes {count} preferencia(s) activas.",
    movement: "Movimiento",
    save: "Guardar",
    cancel: "Cancelar",
    newCategory: "Nueva categoría",
    close: "Cerrar",
    incomeOption: "Ingreso",
    expenseOption: "Gasto",
    editProfile: "Editar perfil",
    notifications: "Notificaciones",
    security: "Seguridad",
    help: "Ayuda y soporte",
    manageCategories: "Gestionar categorías",
    logout: "Cerrar sesión",
    progressTotal: "Progreso Total",
    resultEstimated: "Resultado estimado",
    simpleSimulator: "Simulador simple",
    annualIncome: "Ingresos anuales",
    grossAssets: "Patrimonio bruto",
    estimatedDeductions: "Deducciones estimadas",
    withholdings: "Retenciones ya practicadas",
    simulate: "Simular declaración",
    downloadPdf: "Descargar PDF",
    reportsTitle: "Reportes",
    goalsTitle: "Metas de Ahorro",
    taxTitle: "Declarar Renta",
    profileTitle: "Perfil",
    categoryExpensesTitle: "Gastos por categoría",
    topCategoriesTitle: "Categorías que más gastan",
    profileEditText: "Consulta y actualiza tus datos básicos",
    profileNotificationsText: "Revisa avisos y recordatorios de tu cuenta",
    profileSecurityText: "Administra acceso y protección de tu sesión",
    profileConfigText: "Personaliza apariencia, idioma y preferencias",
    profileHelpText: "Envía una solicitud si necesitas acompañamiento",
    customCategories: "Categorías personalizadas",
    customCategoriesText: "Las categorías principales ya vienen listas. Si necesitas una propia, créala aquí.",
    theme: "Apariencia",
    themeText: "Elige entre modo oscuro o claro.",
    language: "Idioma",
    languageText: "Selecciona cómo quieres ver la interfaz.",
    mobileServer: "Servidor para celular",
    mobileServerText: "URL HTTPS del backend que usará la APK.",
    saveSettings: "Guardar configuración",
    editProfileText: "Actualiza tus datos básicos como en otras apps: nombre y correo.",
    saveChanges: "Guardar cambios",
    goalReminders: "Recordatorios de metas",
    goalRemindersText: "Avisos para no perder de vista tus objetivos.",
    weeklySummary: "Resumen semanal",
    weeklySummaryText: "Una vista rápida de ingresos, gastos y balance.",
    securityAlerts: "Alertas de seguridad",
    securityAlertsText: "Mensajes cuando haya cambios sensibles en la cuenta.",
    savePreferences: "Guardar preferencias",
    updatePin: "Actualizar PIN",
    securityNote: "Usa un PIN numérico de 4 dígitos y evita repetir el anterior.",
    sendRequest: "Enviar solicitud",
    taxNote: "Ingresa los datos de forma aproximada. Si no tienes un valor, puedes dejarlo en cero.",
    estimatedBase: "Base estimada",
    estimatedTax: "Impuesto estimado",
    estimatedBalance: "Saldo estimado",
    taxGuide: "Guía rápida Colombia",
    walleWelcome: "¡Hola! Soy Walle 👋, tu compañero financiero",
    walleGoodJob: "Buen trabajo 💚",
    walleWatchExpense: "Ojo con ese gasto 👀",
    walleSaveToday: "Ahorra un poco hoy 💸",
    walleOpenAssistant: "¡Hola! Soy Walle 👋, listo para ayudarte con tus finanzas.",
    askWalle: "Pregúntale a Walle",
    walleChatTitle: "Pregúntale a Walle",
    walleChatSubtitle: "Respuestas rápidas para tus finanzas en Colombia",
    wallePlaceholder: "Escribe tu pregunta...",
    walleSend: "Enviar",
    walleGreeting: "¡Hola! Pregúntame sobre:\nAhorro\nDeudas\nGastos\nTarjetas\nIngresos\n\nTambién puedes escribir tu propia pregunta.",
    walleUnknown: "No estoy seguro de entenderte 🤔 ¿puedes darme un poco más de detalle?",
    loaderStatus: "Cargando datos...",
    walleLoaderMessages: [
      "Preparando tus finanzas 💚",
      "Organizando tus gastos...",
      "Casi listo 👀"
    ]
  },
  en: {
    loader: "Loading your best financial self...",
    loaderLabel: "Walle is with you",
    ultimo30: "Last 30 days",
    nuevoMovimiento: "New entry",
    all: "All",
    income: "Income",
    expense: "Expenses",
    home: "Home",
    reports: "Reports",
    goals: "Goals",
    tax: "Tax",
    profile: "Profile",
    settings: "Settings",
    settingsSaved: "Settings saved successfully.",
    notificationsSaved: "Preferences saved successfully.",
    profileSaved: "Profile updated successfully.",
    passwordSaved: "PIN updated successfully.",
    helpSaved: "Request sent successfully.",
    logoutConfirm: "Do you want to log out now?",
    profileNameRequired: "Complete name and email",
    securityRequired: "Complete all security fields",
    securityMatch: "The new PIN and confirmation must match",
    securityPinInvalid: "PIN must be exactly 4 numeric digits",
    helpRequired: "Complete the support message",
    categoryRequired: "Choose a category",
    amountInvalid: "Enter a valid amount",
    categoryNameRequired: "You need to enter a category",
    categoriesError: "Could not load categories",
    configQuickAria: "Open settings",
    helpAria: "Open help and support",
    tourAria: "View guided tour",
    notificationsSummaryAll: "All your notifications are active.",
    notificationsSummarySome: "You have {count} active preference(s).",
    movement: "Entry",
    save: "Save",
    cancel: "Cancel",
    newCategory: "New category",
    close: "Close",
    incomeOption: "Income",
    expenseOption: "Expense",
    editProfile: "Edit profile",
    notifications: "Notifications",
    security: "Security",
    help: "Help and support",
    manageCategories: "Manage categories",
    logout: "Log out",
    progressTotal: "Total progress",
    resultEstimated: "Estimated result",
    simpleSimulator: "Simple simulator",
    annualIncome: "Annual income",
    grossAssets: "Gross assets",
    estimatedDeductions: "Estimated deductions",
    withholdings: "Withholding applied",
    simulate: "Run simulation",
    downloadPdf: "Download PDF",
    reportsTitle: "Reports",
    goalsTitle: "Savings Goals",
    taxTitle: "Income Tax",
    profileTitle: "Profile",
    categoryExpensesTitle: "Spending by category",
    topCategoriesTitle: "Top spending categories",
    profileEditText: "View and update your basic information",
    profileNotificationsText: "Review account alerts and reminders",
    profileSecurityText: "Manage access and session protection",
    profileConfigText: "Customize appearance, language, and preferences",
    profileHelpText: "Send a request if you need support",
    customCategories: "Custom categories",
    customCategoriesText: "Main categories are ready. Create your own here if you need one.",
    theme: "Appearance",
    themeText: "Choose dark or light mode.",
    language: "Language",
    languageText: "Select how you want to view the interface.",
    mobileServer: "Mobile server",
    mobileServerText: "HTTPS backend URL used by the APK.",
    saveSettings: "Save settings",
    editProfileText: "Update your basic details: name and email.",
    saveChanges: "Save changes",
    goalReminders: "Goal reminders",
    goalRemindersText: "Alerts to keep your goals in sight.",
    weeklySummary: "Weekly summary",
    weeklySummaryText: "A quick view of income, expenses, and balance.",
    securityAlerts: "Security alerts",
    securityAlertsText: "Messages when sensitive account changes happen.",
    savePreferences: "Save preferences",
    updatePin: "Update PIN",
    securityNote: "Use a 4-digit numeric PIN and avoid reusing the previous one.",
    sendRequest: "Send request",
    taxNote: "Enter approximate values. If you do not have a value, you can leave it at zero.",
    estimatedBase: "Estimated base",
    estimatedTax: "Estimated tax",
    estimatedBalance: "Estimated balance",
    taxGuide: "Quick Colombia guide",
    walleWelcome: "Hi! I'm Walle 👋, your financial buddy",
    walleGoodJob: "Nice job 💚",
    walleWatchExpense: "Watch that expense 👀",
    walleSaveToday: "Save a little today 💸",
    walleOpenAssistant: "Hi! I'm Walle 👋, ready to help with your finances.",
    askWalle: "Ask Walle",
    walleChatTitle: "Ask Walle",
    walleChatSubtitle: "Quick answers for your finances in Colombia",
    wallePlaceholder: "Type your question...",
    walleSend: "Send",
    walleGreeting: "Hi! Ask me about saving, spending, debt, cards or income. You can also type your own question.",
    walleUnknown: "I'm not fully sure I understood 🤔 can you give me a bit more detail?",
    loaderStatus: "Loading data...",
    walleLoaderMessages: [
      "Getting your finances ready 💚",
      "Sorting your expenses...",
      "Almost there 👀"
    ]
  },
  pt: {
    loader: "Carregando sua melhor versão financeira...",
    loaderLabel: "Walle está com você",
    ultimo30: "Últimos 30 dias",
    nuevoMovimiento: "Novo movimento",
    all: "Todos",
    income: "Entradas",
    expense: "Gastos",
    home: "Início",
    reports: "Relatórios",
    goals: "Metas",
    tax: "Renda",
    profile: "Perfil",
    settings: "Configuração",
    settingsSaved: "Configuração salva com sucesso.",
    notificationsSaved: "Preferências salvas com sucesso.",
    profileSaved: "Perfil atualizado com sucesso.",
    passwordSaved: "PIN atualizado com sucesso.",
    helpSaved: "Solicitação enviada com sucesso.",
    logoutConfirm: "Deseja encerrar a sessão agora?",
    profileNameRequired: "Preencha nome e e-mail",
    securityRequired: "Preencha todos os campos de segurança",
    securityMatch: "O novo PIN e a confirmacao precisam ser iguais",
    securityPinInvalid: "O PIN deve ter exatamente 4 digitos numericos",
    helpRequired: "Preencha a mensagem de suporte",
    categoryRequired: "Selecione uma categoria",
    amountInvalid: "Digite um valor válido",
    categoryNameRequired: "Você precisa escrever uma categoria",
    categoriesError: "Não foi possível carregar as categorias",
    configQuickAria: "Abrir configuração",
    helpAria: "Abrir ajuda e suporte",
    tourAria: "Ver tour guiado",
    notificationsSummaryAll: "Todas as suas notificações estão ativas.",
    notificationsSummarySome: "Você tem {count} preferência(s) ativa(s).",
    movement: "Movimento",
    save: "Salvar",
    cancel: "Cancelar",
    newCategory: "Nova categoria",
    close: "Fechar",
    incomeOption: "Entrada",
    expenseOption: "Saída",
    editProfile: "Editar perfil",
    notifications: "Notificações",
    security: "Segurança",
    help: "Ajuda e suporte",
    manageCategories: "Gerenciar categorias",
    logout: "Encerrar sessão",
    progressTotal: "Progresso total",
    resultEstimated: "Resultado estimado",
    simpleSimulator: "Simulador simples",
    annualIncome: "Renda anual",
    grossAssets: "Patrimônio bruto",
    estimatedDeductions: "Deduções estimadas",
    withholdings: "Retenções realizadas",
    simulate: "Simular declaração",
    downloadPdf: "Baixar PDF",
    reportsTitle: "Relatórios",
    goalsTitle: "Metas de Poupança",
    taxTitle: "Declarar Renda",
    profileTitle: "Perfil",
    categoryExpensesTitle: "Gastos por categoria",
    topCategoriesTitle: "Categorias com mais gastos",
    profileEditText: "Consulte e atualize seus dados básicos",
    profileNotificationsText: "Revise avisos e lembretes da sua conta",
    profileSecurityText: "Gerencie acesso e proteção da sessão",
    profileConfigText: "Personalize aparência, idioma e preferências",
    profileHelpText: "Envie uma solicitação se precisar de suporte",
    customCategories: "Categorias personalizadas",
    customCategoriesText: "As categorias principais já estão prontas. Crie a sua aqui se precisar.",
    theme: "Aparência",
    themeText: "Escolha modo escuro ou claro.",
    language: "Idioma",
    languageText: "Selecione como deseja ver a interface.",
    mobileServer: "Servidor para celular",
    mobileServerText: "URL HTTPS do backend usada pelo APK.",
    saveSettings: "Salvar configuração",
    editProfileText: "Atualize seus dados básicos: nome e e-mail.",
    saveChanges: "Salvar alterações",
    goalReminders: "Lembretes de metas",
    goalRemindersText: "Avisos para manter seus objetivos em vista.",
    weeklySummary: "Resumo semanal",
    weeklySummaryText: "Uma visão rápida de entradas, gastos e saldo.",
    securityAlerts: "Alertas de segurança",
    securityAlertsText: "Mensagens quando houver alterações sensíveis na conta.",
    savePreferences: "Salvar preferências",
    updatePin: "Atualizar PIN",
    securityNote: "Use um PIN numérico de 4 dígitos e evite repetir o anterior.",
    sendRequest: "Enviar solicitação",
    taxNote: "Digite valores aproximados. Se não tiver um valor, pode deixar em zero.",
    estimatedBase: "Base estimada",
    estimatedTax: "Imposto estimado",
    estimatedBalance: "Saldo estimado",
    taxGuide: "Guia rápido Colômbia",
    walleWelcome: "Olá! Eu sou o Walle 👋, seu companheiro financeiro",
    walleGoodJob: "Bom trabalho 💚",
    walleWatchExpense: "Olho nesse gasto 👀",
    walleSaveToday: "Guarde um pouco hoje 💸",
    walleOpenAssistant: "Olá! Eu sou o Walle 👋, pronto para ajudar nas suas finanças.",
    askWalle: "Pergunte ao Walle",
    walleChatTitle: "Pergunte ao Walle",
    walleChatSubtitle: "Respostas rápidas para suas finanças na Colômbia",
    wallePlaceholder: "Escreva sua pergunta...",
    walleSend: "Enviar",
    walleGreeting: "Olá! Pergunte sobre economia, gastos, dívidas, cartões ou renda. Você também pode escrever sua própria pergunta.",
    walleUnknown: "Nao tenho certeza se entendi 🤔 pode me dar um pouco mais de detalhe?",
    loaderStatus: "Carregando dados...",
    walleLoaderMessages: [
      "Preparando suas finanças 💚",
      "Organizando seus gastos...",
      "Quase pronto 👀"
    ]
  }
};

const ICONOS_CATEGORIA = [
  { icono: "🍽️", nombre: "Alimentación" },
  { icono: "🚗", nombre: "Transporte" },
  { icono: "🏠", nombre: "Vivienda" },
  { icono: "💡", nombre: "Servicios" },
  { icono: "🩺", nombre: "Salud" },
  { icono: "📚", nombre: "Educación" },
  { icono: "🎬", nombre: "Entretenimiento" },
  { icono: "🛍️", nombre: "Compras" },
  { icono: "💳", nombre: "Deudas" },
  { icono: "💰", nombre: "Ahorro" },
  { icono: "🎁", nombre: "Regalos" },
  { icono: "✈️", nombre: "Viajes" },
  { icono: "🐾", nombre: "Mascotas" },
  { icono: "👕", nombre: "Ropa" },
  { icono: "📦", nombre: "Otros" }
];

const consejosFinancieros = [
  "Haz un presupuesto mensual antes de empezar a gastar.",
  "Págate a ti primero: ahorra apenas recibas tus ingresos.",
  "Construye un fondo de emergencia de al menos 3 meses.",
  "Si puedes, lleva tu fondo de emergencia a 6 meses.",
  "Diferencia siempre entre necesidades y gustos.",
  "Evita financiar compras pequeñas con tarjeta de crédito.",
  "Paga primero las deudas con intereses más altos.",
  "Si te motiva más, usa el método bola de nieve para tus deudas.",
  "No uses todo el cupo de tu tarjeta de crédito.",
  "Revisa tus extractos bancarios cada mes.",
  "Automatiza el ahorro para no depender de la disciplina diaria.",
  "Ten metas claras: viaje, vivienda, estudio o emergencia.",
  "Pon fecha y monto a cada meta financiera.",
  "No inviertas dinero que puedas necesitar pronto.",
  "Antes de invertir, entiende el producto y sus riesgos.",
  "Diversificar ayuda a reducir riesgos.",
  "No tomes decisiones financieras solo por moda o presión social.",
  "Evita comprar por impulso; espera 24 horas antes de decidir.",
  "Compara precios antes de hacer compras grandes.",
  "Negocia tarifas, comisiones y tasas cuando sea posible.",
  "Ten cuidado con créditos que prometen aprobación instantánea.",
  "Si una rentabilidad parece demasiado buena, sospecha.",
  "Guarda un registro simple de ingresos y gastos.",
  "Usa categorías para identificar en qué se te va el dinero.",
  "Reduce gastos fijos antes de recortar los importantes.",
  "No descuides tu historial crediticio.",
  "Paga tus obligaciones a tiempo para evitar intereses y reportes.",
  "Lee siempre la letra pequeña antes de firmar un crédito.",
  "Ahorra para gastos previsibles como matrículas o impuestos.",
  "Revisa cada año si tu banco sigue siendo la mejor opción para ti.",
  "No mezcles dinero personal con dinero destinado a metas específicas.",
  "Usa cuentas separadas para organizar mejor tus objetivos.",
  "Empieza a invertir temprano para aprovechar el interés compuesto.",
  "Incrementa tu ahorro cuando aumenten tus ingresos.",
  "Evita subir tu estilo de vida al mismo ritmo que tu salario.",
  "Ten un plan para gastos médicos y contingencias.",
  "La liquidez importa: no pongas todo tu dinero en productos inmovilizados.",
  "Aprender finanzas personales también es una inversión.",
  "Tener seguro adecuado puede proteger tu patrimonio.",
  "Define un límite de gasto semanal para no desordenarte.",
  "Cocinar más en casa suele ayudar bastante al ahorro.",
  "Cancela suscripciones que no uses con frecuencia.",
  "Compra con lista para evitar gastos innecesarios.",
  "Evalúa el costo total de una deuda, no solo la cuota mensual.",
  "Ahorra antes de endeudarte para compras no urgentes.",
  "Mantén una reserva para mantenimiento del hogar o vehículo.",
  "Invierte con objetivos claros y horizonte de tiempo definido.",
  "Rebalancea tus metas financieras cuando cambien tus prioridades.",
  "Hablar de dinero con honestidad mejora decisiones en pareja o familia.",
  "La constancia suele ganar más que los cambios drásticos temporales."
];

const ONBOARDING_COPY = {
  es: {
    kicker: "Guía inicial",
    skip: "Omitir",
    next: "Siguiente",
    previous: "Atrás",
    finish: "Finalizar",
    progress: "Paso {current} de {total}",
    steps: [
      {
        title: "Bienvenido a Dinamicash Wallet",
        body: "",
        walleMessage: "¡Hola! Soy Walle 👋, tu compañero financiero",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#inicio .filtro-rango",
        title: "Aquí filtras tu información",
        body: "",
        walleMessage: "Usa estos filtros para encontrar tus movimientos rápido 👀",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#btnNuevoMovimiento",
        title: "Crea ingresos o gastos",
        body: "",
        walleMessage: "Aquí registras la plata que entra o sale para tener todo bajo control 💸",
        walleMood: "happy"
      },
      {
        screen: "reportes",
        selector: "#reportes .contenedor-reportes",
        title: "Tus reportes viven aquí",
        body: "",
        walleMessage: "Aquí ves dónde se te va el dinero y qué tan bien vas 💚",
        walleMood: "guide"
      },
      {
        screen: "metas",
        selector: "#btnNuevaMeta",
        title: "Crea metas de ahorro",
        body: "",
        walleMessage: "Crea metas pequeñas y verás cómo ahorrar se vuelve más fácil ✨",
        walleMood: "motivate"
      },
      {
        screen: "renta",
        selector: "#renta .renta-card",
        title: "Simula tu declaración",
        body: "",
        walleMessage: "Esta guía te orienta con renta en Colombia sin complicarte tanto 📘",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfil .perfil-menu",
        title: "Administra tu cuenta",
        body: "",
        walleMessage: "Desde perfil ajustas tu cuenta, tu seguridad y cómo quieres usar la app ⚙️",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfilCategoriasBtn",
        title: "Personaliza categorías",
        body: "",
        walleMessage: "Si tus gastos no encajan, crea tus propias categorías y organízate mejor 🧠",
        walleMood: "happy"
      },
      {
        screen: "inicio",
        selector: "#quickConfigFab",
        title: "Accesos rápidos siempre visibles",
        body: "",
        walleMessage: "Desde aquí me abres, repites la guía o entras a configuración en un toque 🚀",
        walleMood: "motivate"
      }
    ]
  },
  en: {
    kicker: "Quick guide",
    skip: "Skip",
    next: "Next",
    previous: "Back",
    finish: "Finish",
    progress: "Step {current} of {total}",
    steps: [
      {
        title: "Welcome to Dinamicash Wallet",
        body: "",
        walleMessage: "Hi! I'm Walle 👋, your financial buddy",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#inicio .filtro-rango",
        title: "Filter your information here",
        body: "",
        walleMessage: "Use these filters to find your entries faster 👀",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#btnNuevoMovimiento",
        title: "Add income or expenses",
        body: "",
        walleMessage: "Here you log money in and out so everything stays clear 💸",
        walleMood: "happy"
      },
      {
        screen: "reportes",
        selector: "#reportes .contenedor-reportes",
        title: "Reports in one place",
        body: "",
        walleMessage: "This area shows where your money goes and how you're doing 💚",
        walleMood: "guide"
      },
      {
        screen: "metas",
        selector: "#btnNuevaMeta",
        title: "Create savings goals",
        body: "",
        walleMessage: "Small goals make saving feel easier and more real ✨",
        walleMood: "motivate"
      },
      {
        screen: "renta",
        selector: "#renta .renta-card",
        title: "Run a tax estimate",
        body: "",
        walleMessage: "This helps you understand a simple tax estimate for Colombia 📘",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfil .perfil-menu",
        title: "Manage your account",
        body: "",
        walleMessage: "Profile is where you adjust your account, security and preferences ⚙️",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfilCategoriasBtn",
        title: "Create custom categories",
        body: "",
        walleMessage: "Create your own categories when the default ones are not enough 🧠",
        walleMood: "happy"
      },
      {
        screen: "inicio",
        selector: "#quickConfigFab",
        title: "Quick access buttons",
        body: "",
        walleMessage: "From here you can open me, repeat the guide or jump to settings fast 🚀",
        walleMood: "motivate"
      }
    ]
  },
  pt: {
    kicker: "Guia inicial",
    skip: "Pular",
    next: "Próximo",
    previous: "Voltar",
    finish: "Finalizar",
    progress: "Passo {current} de {total}",
    steps: [
      {
        title: "Bem-vindo ao Dinamicash Wallet",
        body: "",
        walleMessage: "Olá! Eu sou o Walle 👋, seu companheiro financeiro",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#inicio .filtro-rango",
        title: "Filtre suas informações aqui",
        body: "",
        walleMessage: "Use estes filtros para achar seus movimentos mais rápido 👀",
        walleMood: "guide"
      },
      {
        screen: "inicio",
        selector: "#btnNuevoMovimiento",
        title: "Registre entradas ou saídas",
        body: "",
        walleMessage: "Aqui você registra o dinheiro que entra e sai para manter tudo em ordem 💸",
        walleMood: "happy"
      },
      {
        screen: "reportes",
        selector: "#reportes .contenedor-reportes",
        title: "Relatórios em um só lugar",
        body: "",
        walleMessage: "Aqui você vê para onde seu dinheiro está indo e como está seu ritmo 💚",
        walleMood: "guide"
      },
      {
        screen: "metas",
        selector: "#btnNuevaMeta",
        title: "Crie metas de economia",
        body: "",
        walleMessage: "Metas pequenas deixam o hábito de guardar dinheiro muito mais fácil ✨",
        walleMood: "motivate"
      },
      {
        screen: "renta",
        selector: "#renta .renta-card",
        title: "Simule a declaração",
        body: "",
        walleMessage: "Esta parte ajuda você a entender uma simulação simples de renda na Colômbia 📘",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfil .perfil-menu",
        title: "Gerencie sua conta",
        body: "",
        walleMessage: "No perfil você ajusta conta, segurança e preferências rapidinho ⚙️",
        walleMood: "guide"
      },
      {
        screen: "perfil",
        selector: "#perfilCategoriasBtn",
        title: "Personalize categorias",
        body: "",
        walleMessage: "Crie categorias próprias quando quiser organizar tudo do seu jeito 🧠",
        walleMood: "happy"
      },
      {
        screen: "inicio",
        selector: "#quickConfigFab",
        title: "Acessos rápidos",
        body: "",
        walleMessage: "Daqui você me abre, repete o guia e entra nas configurações rapidinho 🚀",
        walleMood: "motivate"
      }
    ]
  }
};

const onboardingState = {
  active: false,
  currentStep: 0,
  steps: [],
  highlightedElement: null,
  renderTimeoutId: null,
  requestId: 0
};

const walleIntents = [
  {
    intent: "saludo",
    topics: ["saludo", "bienvenida"],
    keywords: [
      "hola",
      "hola walle",
      "buenas",
      "buenas walle",
      "hello",
      "hi",
      "hey",
      "que tal",
      "q tal",
      "holi",
      "buen dia",
      "buenas tardes",
      "buenas noches"
    ],
    responses: [
      "¡Hola! 👋 ¿En qué te ayudo con tus finanzas hoy? 💚",
      "¡Hey! 😄 ¿Quieres mejorar tus gastos o ahorrar más?",
      "¡Hola! 👀 Pregúntame lo que quieras sobre tu dinero",
      "¡Buenas! 💸 Estoy aquí para ayudarte con tus finanzas"
    ],
    scoreWords: ["hola", "buenas", "hello", "hi", "hey", "holi", "tal"]
  },
  {
    intent: "ahorro",
    topics: ["ahorro", "guardar", "meta", "separar plata"],
    keywords: [
      "ahorrar",
      "como hago para ahorrar",
      "como ahorro",
      "quiero ahorrar",
      "guardar dinero",
      "formas de ahorrar dinero",
      "como empezar a ahorrar",
      "como ahorrar en colombia",
      "ahorrar con salario minimo",
      "separar plata",
      "no puedo ahorrar",
      "quiero guardar plata"
    ],
    ambiguity: [
      "cuanto ahorro",
      "cuanto deberia ahorrar",
      "que ahorro",
      "ahorro?"
    ],
    clarification: "¿Te refieres a qué porcentaje ahorrar o a cuánto guardar según tus ingresos? 👀",
    responses: [
      "Para empezar a ahorrar, separa una parte apenas recibas ingresos 💚. Si puedes, arranca con 10%; si estás apretado, empieza con menos, pero hazlo fijo cada mes.",
      "Ahorrar funciona mejor cuando lo haces apenas te entra plata 👀. No importa si comienzas con poco; lo importante es volverlo costumbre.",
      "Empieza por una meta simple y sostenible 💸. Un ahorro pequeño pero constante vale más que esperar el momento perfecto para guardar mucho."
    ],
    subintents: [
      {
        intent: "porcentaje_ahorro",
        keywords: [
          "porcentaje",
          "cuanto porcentaje",
          "que porcentaje ahorro",
          "cuanto debo ahorrar",
          "10 por ciento",
          "20 por ciento"
        ],
        responses: [
          "Una meta saludable es ahorrar al menos el 10% de tus ingresos 💚. Si ganas 1 millón, serían unos 100 mil al mes.",
          "Si puedes, intenta moverte entre el 10% y el 20% según tu realidad 👀. Con 2 millones, ese rango sería entre 200 mil y 400 mil.",
          "Si hoy estás justo, arranca con 5% y luego súbelo poco a poco 💸. Por ejemplo, con 800 mil serían 40 mil para empezar."
        ],
        scoreWords: ["porcentaje", "porciento", "10", "20"]
      },
      {
        intent: "cuanto_ahorrar",
        keywords: [
          "cuanto ahorrar",
          "cuanto guardo",
          "que cantidad ahorro",
          "cuanta plata ahorro",
          "cuanto separo"
        ],
        responses: [
          "Puedes empezar separando una cantidad fija que sí puedas sostener cada mes 💚. Si ganas 1 millón, 100 mil sería una referencia simple.",
          "Más que un monto perfecto, te conviene una cifra realista que no abandones al segundo mes 👀. Incluso 50 mil fijos pueden servir si hoy estás ajustado.",
          "Si no sabes por dónde arrancar, define una cantidad pequeña semanal y vuelve eso automático 💸. Por ejemplo, 25 mil por semana ya suman 100 mil al mes."
        ],
        scoreWords: ["cuanto", "cantidad", "plata", "monto", "guardo"]
      },
      {
        intent: "cuanto_ahorrar_dinero",
        keywords: [
          "cuanto seria",
          "cuanto es eso",
          "cuanto ahorro en dinero",
          "cuanto seria eso",
          "y cuanto seria",
          "eso cuanto es"
        ],
        responses: [
          "Depende de cuánto ganes 💚, pero si ganas $1.000.000, ahorrar el 10% serían $100.000.",
          "Si ganas $2.000.000, un 10% serían $200.000 👀. Si quieres, lo ajustamos a tu ingreso real.",
          "Para verlo fácil 💸: con $800.000 serían $80.000 y con $1.500.000 serían $150.000. ¿Quieres que te lo calcule exacto?"
        ],
        scoreWords: ["cuanto", "seria", "eso", "dinero"]
      },
      {
        intent: "ahorro_segun_ingreso",
        keywords: [
          "segun mi ingreso",
          "segun lo que gano",
          "de acuerdo a mi sueldo",
          "cuanto ahorro si gano",
          "si gano"
        ],
        responses: [
          "Depende mucho de lo que ganes y de tus gastos fijos 👀. Una guía simple es empezar con 10% y ajustar si tu mes está muy apretado.",
          "Si tu ingreso todavía no te da mucho margen 💚, puedes comenzar con 5% y subirlo cuando te estabilices. Lo importante es que sí lo sostengas.",
          "No siempre conviene forzarte al 20% 💸. A veces es mejor ahorrar menos, pero sin romper tu presupuesto del mes."
        ],
        scoreWords: ["ingreso", "gano", "sueldo"]
      },
      {
        intent: "ahorro_bajo_ingreso",
        keywords: [
          "gano poco para ahorrar",
          "no me alcanza para ahorrar",
          "con sueldo bajo se puede ahorrar",
          "si gano poco como ahorro",
          "ahorro con ingresos bajos"
        ],
        responses: [
          "Sí se puede ahorrar con ingreso bajo, pero el enfoque cambia 💚. En vez de pensar en una cifra alta, conviene arrancar con algo pequeño y fijo como 10 mil o 20 mil por semana.",
          "Si hoy ganas poco, no te castigues con metas irreales 👀. A veces ahorrar poco pero constante vale más que intentar mucho y abandonar al mes siguiente.",
          "Cuando el ingreso es ajustado 💸, conviene atacar fugas de gasto y construir el hábito primero. Luego ya subes el monto cuando tengas más aire."
        ],
        scoreWords: ["gano", "poco", "bajo", "alcanza"]
      },
      {
        intent: "donde_ahorrar",
        keywords: [
          "donde ahorrar",
          "donde guardo el dinero",
          "donde guardo la plata",
          "nequi",
          "daviplata",
          "cuenta ahorro",
          "cuenta para ahorrar",
          "billetera digital ahorrar"
        ],
        responses: [
          "Puedes usar Nequi, Daviplata o una cuenta de ahorro separada 💚",
          "Lo más útil es guardar ese dinero en un lugar distinto al que usas para tus gastos diarios 👀",
          "Más que la app o la cuenta, lo importante es no mezclar ese ahorro con la plata del mes 💸"
        ],
        scoreWords: ["nequi", "daviplata", "cuenta", "guardar", "donde"]
      }
    ],
    scoreWords: ["ahorro", "ahorrar", "guardar", "meta", "separar"]
  },
  {
    intent: "gastos",
    topics: ["gastos", "plata no alcanza", "consumo"],
    keywords: [
      "gasto mucho dinero",
      "estoy gastando mucho",
      "gasto mucho",
      "no me alcanza la plata",
      "no me alcanza el sueldo",
      "la plata no me alcanza",
      "como controlar mis gastos",
      "controlar gastos",
      "como gasto menos",
      "en que se me va la plata",
      "gasto demasiada plata",
      "se me va la plata"
    ],
    responses: [
      "Si sientes que gastas mucho, primero identifica en qué categoría se te va más plata 👀. Cuando ves el gasto fuerte, ya puedes recortarlo sin adivinar.",
      "Antes de recortar, necesitas ver con claridad en qué se te está yendo el dinero 💸",
      "Tus gastos mejoran más rápido cuando detectas el patrón, no solo cuando te propones gastar menos 💚"
    ],
    subintents: [
      {
        intent: "reducir_gastos",
        keywords: [
          "reducir gastos",
          "como gastar menos",
          "como bajo mis gastos",
          "ahorrar gastos"
        ],
        responses: [
          "Empieza por los gastos que repites seguido y casi no notas 👀",
          "Reducir gastos funciona mejor cuando cortas uno o dos hábitos caros, no todo de golpe 💸",
          "Antes de comprar, pregúntate si eso te resuelve algo importante o solo fue impulso 💚"
        ],
        scoreWords: ["reducir", "menos", "bajar", "recortar"]
      },
      {
        intent: "organizar_gastos",
        keywords: [
          "como organizo mis gastos",
          "como organizo dinero",
          "organizar gastos",
          "como dividir gastos",
          "como ordenar mis gastos",
          "como separar mis gastos"
        ],
        responses: [
          "Hazlo así 👇\n1. Fijos: arriendo, servicios\n2. Variables: comida, transporte\n3. Extras: salidas, compras\n\nEmpieza por revisar los extras, ahí suele irse más plata 💸",
          "Divide tus gastos en 3 grupos 👀\n1. Fijos\n2. Variables\n3. Opcionales\n\nLos opcionales son los que puedes recortar primero 💚",
          "Primero anota todo lo que gastas 🔍\n1. Sepáralo por categorías\n2. Suma cada grupo\n3. Mira qué gasto pesa más\n\nAhí verás rápido dónde ajustar 💸"
        ],
        scoreWords: ["organizar", "dividir", "ordenar", "separar", "gastos"]
      },
      {
        intent: "gastos_hormiga",
        keywords: [
          "gastos hormiga",
          "compras pequeñas",
          "se me va en cositas",
          "gastos pequenos",
          "gastos diarios pequenos",
          "antojitos",
          "cafecito diario"
        ],
        responses: [
          "Los gastos hormiga parecen pequeños, pero juntos pueden desordenarte el mes 👀. Primero mídelo una semana y luego decide qué sí vale la pena dejar.",
          "No se trata de quitarte todo 💚, sino de detectar qué compras repetidas no te aportan mucho. Si recortas 2 o 3 hábitos, ya puedes notar diferencia.",
          "Puede parecer poca plata 💸, pero cuando se vuelve diario pesa bastante. Agrúpalos en una sola categoría y ponles un tope semanal."
        ],
        scoreWords: ["hormiga", "cositas", "pequenas", "antojitos", "cafecito"]
      },
      {
        intent: "gasto_comida",
        keywords: [
          "gasto mucho en comida",
          "gasto mucho en almuerzos",
          "se me va la plata en comida",
          "gasto en comida",
          "gasto mucho comiendo fuera",
          "pido mucha comida"
        ],
        responses: [
          "Gastar en comida es normal, pero si casi siempre compras por fuera puede subirte mucho el gasto 👀. Mezclar comida preparada con algunas comidas hechas en casa suele ayudar bastante.",
          "No siempre conviene recortar comida al extremo 💚, pero sí revisar frecuencia, domicilios y compras impulsivas. A veces el problema no es comer, sino cómo y dónde compras.",
          "Si se te va mucha plata en comida 💸, prueba planear 3 o 4 comidas base por semana. Eso te baja improvisación y también te reduce pedidos por impulso."
        ],
        scoreWords: ["comida", "almuerzos", "domicilios", "pido"]
      },
      {
        intent: "gasto_arriendo",
        keywords: [
          "gasto mucho en arriendo",
          "pago mucho de arriendo",
          "arriendo muy caro",
          "se me va mucho en arriendo",
          "arriendo me consume",
          "alquiler muy caro"
        ],
        responses: [
          "Si el arriendo te consume mucho, el margen de maniobra suele ser pequeño ⚠️. Ahí conviene revisar si puedes renegociar, compartir gasto o compensarlo bajando otros costos fijos.",
          "El arriendo no siempre se puede bajar rápido 💚, pero sí puedes medir cuánto porcentaje se está llevando. Si te está ahogando, vale la pena evaluar cambios de vivienda o zona.",
          "No es un gasto fácil de mover 👀, así que la decisión debe verse con calma: costo, transporte, seguridad y calidad de vida. A veces bajar arriendo sale caro por otro lado."
        ],
        scoreWords: ["arriendo", "alquiler", "caro"]
      }
    ],
    scoreWords: ["gasto", "gastos", "plata", "alcanz", "consume"]
  },
  {
    intent: "deudas",
    topics: ["deudas", "pagar obligaciones"],
    keywords: [
      "como salir de deudas",
      "tengo muchas deudas",
      "como pagar deudas rapido",
      "deudas",
      "pagar deudas",
      "estoy endeudado",
      "no puedo con mis deudas",
      "muchas cuotas",
      "debo mucha plata",
      "me ahogan las deudas"
    ],
    responses: [
      "Si tienes varias deudas, ordénalas por interés y ataca primero la más cara 💳. Intenta no abrir nuevas deudas mientras estabilizas las que ya tienes.",
      "Salir de deudas empieza por tenerlas claras y priorizadas 👀",
      "Necesitas un plan simple: pagar con orden, dejar de sumar deuda nueva y sostener el ritmo 💚"
    ],
    subintents: [
      {
        intent: "pagar_deudas",
        keywords: [
          "como pagar deudas",
          "pagar rapido",
          "salir rapido de deudas",
          "metodo para pagar deudas"
        ],
        responses: [
          "Puedes probar el método bola de nieve: cierras primero las deudas pequeñas para ganar impulso 💚",
          "Si quieres ahorrar más en intereses, enfócate primero en la deuda más cara 👀",
          "El mejor método es el que de verdad puedas sostener mes tras mes 💸"
        ],
        scoreWords: ["pagar", "rapido", "metodo", "salir"]
      },
      {
        intent: "unificar_deudas",
        keywords: [
          "unificar deudas",
          "unir deudas",
          "juntar deudas",
          "consolidar deudas",
          "pasar todo a un solo credito",
          "pasar todo a un solo préstamo",
          "pasar todo a un solo prestamo",
          "una sola deuda",
          "quiero unir mis deudas",
          "quiero juntar mis deudas"
        ],
        responses: [
          "Unificar deudas puede ayudarte a organizarte mejor 💚, pero ojo: revisa que el nuevo crédito tenga menor interés, no te alargue demasiado el plazo y no te deje con cuota engañosamente baja.",
          "Consolidar deudas puede darte más control 👀, pero no siempre significa pagar menos. Si bajas la cuota pero subes mucho el tiempo, terminas entregando más intereses.",
          "Puede ser buena idea 💸 si mejoras tasa, orden y flujo de caja. Pero si solo cambias una deuda por otra sin corregir el hábito, el alivio puede durar poco."
        ],
        scoreWords: ["unificar", "unir", "juntar", "consolidar", "solo"]
      },
      {
        intent: "no_puedo_pagar",
        keywords: [
          "no puedo pagar",
          "no me alcanza para pagar",
          "no tengo para pagar deudas",
          "estoy colgado con pagos",
          "me atrase con las cuotas",
          "no alcanzo a pagar",
          "no me da para pagar"
        ],
        responses: [
          "Si no puedes pagar, muévete antes de atrasarte más ⚠️. Hablar con la entidad para reestructurar o negociar suele ser mejor que dejar crecer mora e intereses.",
          "No siempre conviene seguir pagando todo igual si ya no te alcanza 👀. Prioriza vivienda, comida y deudas más sensibles, y luego busca acuerdo con las demás.",
          "La clave es actuar rápido 💚: revisa cuál cuota sí puedes sostener, evita nuevas deudas y deja registro de cualquier negociación que hagas con la entidad."
        ],
        scoreWords: ["alcanz", "pagar", "colgado", "atrase", "cuotas"]
      },
      {
        intent: "muchas_deudas",
        keywords: [
          "tengo muchas deudas",
          "varias deudas",
          "muchas cuotas",
          "muchos creditos",
          "demasiadas deudas",
          "estoy lleno de deudas"
        ],
        responses: [
          "Si tienes muchas deudas, lo primero es ordenarlas por tasa, cuota y atraso 💚. Sin ese mapa, es muy fácil pagar por impulso y no avanzar de verdad.",
          "Tener varias deudas no siempre significa que debas cerrar la más pequeña primero 👀. A veces conviene atacar la de interés más alto y sostener mínimos en las demás.",
          "Haz una lista simple con saldo, tasa y fecha de pago 💸. Cuando lo ves claro, ya puedes decidir si te conviene bola de nieve, avalancha o negociación."
        ],
        scoreWords: ["muchas", "varias", "cuotas", "creditos"]
      },
      {
        intent: "pagar_minimos",
        keywords: [
          "pago minimo",
          "pagar minimo",
          "solo pago el minimo",
          "estoy pagando el minimo",
          "minimo tarjeta",
          "pago minimos"
        ],
        responses: [
          "Pagar mínimos te puede dar aire este mes, pero suele salir caro ⚠️. La deuda baja muy lento y gran parte del pago se va en intereses.",
          "A veces pagar el mínimo evita caer en mora 👀, así que no siempre es una mala decisión puntual. El problema es volverlo costumbre durante muchos meses.",
          "Si hoy solo puedes pagar mínimo, intenta que sea temporal 💚. Apenas tengas margen, sube el pago para cortar intereses más rápido."
        ],
        scoreWords: ["minimo", "minimos", "tarjeta"]
      },
      {
        intent: "deudas_con_intereses",
        keywords: [
          "me cobran mucho interes",
          "mucho interes",
          "intereses muy altos",
          "la deuda sube mucho",
          "me estan cobrando mucho interes",
          "interes muy caro",
          "tasa muy alta"
        ],
        responses: [
          "Si te están cobrando mucho interés, revisa si esa deuda puede renegociarse o sustituirse por una más barata 👀. No siempre se puede, pero vale la pena comparar.",
          "La tasa alta sí cambia mucho el resultado final 💸. A veces una cuota aparentemente cómoda termina siendo mala si el interés se come todo el avance.",
          "Antes de refinanciar o comprar cartera 💚, compara tasa efectiva, plazo y costo total. No te fijes solo en si la cuota mensual baja."
        ],
        scoreWords: ["interes", "tasa", "alta", "caro"]
      },
      {
        intent: "refinanciar_deuda",
        keywords: [
          "refinanciar deuda",
          "refinanciar",
          "reestructurar deuda",
          "restructurar deuda",
          "comprar cartera",
          "negociar deuda con el banco"
        ],
        responses: [
          "Refinanciar puede ser útil si te baja presión mensual o interés 💚, pero no conviene hacerlo a ciegas. Revisa cuánto terminas pagando al final, no solo la cuota nueva.",
          "Puede ser buena idea 👀 si evita mora o te ordena mejor, pero si extiendes demasiado el plazo podrías terminar pagando más por el mismo problema.",
          "Antes de aceptar una refinanciación 💸, pregunta por tasa, plazo, seguros y costo total. Ahí es donde realmente se ve si te conviene."
        ],
        scoreWords: ["refinanciar", "reestructurar", "cartera", "negociar"]
      },
      {
        intent: "centrales_riesgo",
        keywords: [
          "centrales de riesgo",
          "datacredito",
          "reportado",
          "me reportaron",
          "estoy en datacredito",
          "centrales"
        ],
        responses: [
          "Si ya estás reportado en centrales, lo más importante es entender qué obligación te llevó allá y cómo regularizarla ⚠️. Ignorarlo suele empeorar el historial.",
          "No siempre salir de centrales es inmediato 👀, incluso después de pagar. Por eso conviene pedir soporte del acuerdo o del pago y hacer seguimiento.",
          "Si puedes negociar, hazlo por escrito 💚. Tener evidencia te ayuda a defenderte mejor si luego hay demoras en la actualización del reporte."
        ],
        scoreWords: ["datacredito", "reportado", "centrales"]
      }
    ],
    scoreWords: ["deuda", "deudas", "cuota", "endeud", "debo"]
  },
  {
    intent: "tarjeta_credito",
    topics: ["tarjeta", "intereses", "fecha de pago"],
    keywords: [
      "como usar tarjeta de credito",
      "tarjeta de credito",
      "intereses tarjeta credito colombia",
      "cuando pagar tarjeta",
      "pagar tarjeta",
      "me conviene usar tarjeta",
      "avance tarjeta de credito",
      "corte de la tarjeta",
      "fecha limite tarjeta",
      "tarjeta me cobra mucho"
    ],
    responses: [
      "La tarjeta sirve si la usas con control 💳. Lo mejor es pagar el total antes de la fecha límite; si solo pagas el mínimo, los intereses te pueden golpear fuerte.",
      "La tarjeta puede ayudarte, pero solo si no gastas más de lo que ya puedes pagar 👀",
      "Trátala como medio de pago, no como plata extra 💸"
    ],
    subintents: [
      {
        intent: "intereses",
        keywords: [
          "intereses",
          "cuanto cobra",
          "tasa",
          "porque cobra tanto",
          "interes tarjeta"
        ],
        responses: [
          "Los intereses de tarjeta pueden ser altos si dejas saldo pendiente ⚠️",
          "Revisa siempre la tasa y evita financiar compras si no es necesario 👀",
          "Pagar solo el mínimo suele salir caro porque la deuda se alarga mucho 💸"
        ],
        scoreWords: ["interes", "tasa", "cobra"]
      }
    ],
    scoreWords: ["tarjeta", "credito", "interes", "corte", "limite"]
  },
  {
    intent: "ingresos",
    topics: ["ganar mas", "extra", "trabajos"],
    keywords: [
      "como ganar mas dinero",
      "ingresos extra colombia",
      "ideas para generar dinero",
      "ingresos extra",
      "ganar mas dinero",
      "necesito mas plata",
      "quiero ganar un extra",
      "trabajo extra",
      "como generar ingresos",
      "como hacer plata"
    ],
    responses: [
      "Para ganar más dinero, busca algo que ya sepas hacer bien y puedas repetir 🚀. Un ingreso extra pequeño pero constante suele ser mejor que una idea grande que nunca arranca.",
      "Si quieres ingresos extra, empieza por una habilidad o servicio que ya puedas ofrecer hoy 👀",
      "Ganar más no siempre empieza con algo enorme; muchas veces empieza con algo simple y constante 💚"
    ],
    subintents: [
      {
        intent: "no_gano_suficiente",
        keywords: [
          "no gano suficiente",
          "gano muy poco",
          "mi sueldo no alcanza",
          "no me alcanza lo que gano",
          "gano poco",
          "mi salario no alcanza"
        ],
        responses: [
          "Si no ganas suficiente, no todo se resuelve recortando más ⚠️. A veces sí toca combinar orden en gastos con búsqueda de ingreso adicional o mejora laboral.",
          "Puede sonar duro, pero cuando el ingreso base no alcanza de forma constante 👀, el problema no siempre es gastar mal. También hay que revisar cómo aumentar entrada de dinero.",
          "Empieza por separar lo urgente de lo ajustable 💚: cuánto te falta cada mes, qué gastos no puedes mover y qué habilidad podrías monetizar para cerrar esa brecha."
        ],
        scoreWords: ["gano", "suficiente", "sueldo", "salario", "alcanza"]
      },
      {
        intent: "ingresos_extra",
        keywords: [
          "quiero ingresos extra",
          "necesito ingresos extra",
          "quiero ganar un extra",
          "como generar ingresos extra",
          "trabajo extra",
          "hacer plata extra"
        ],
        responses: [
          "Para ingresos extra, suele funcionar mejor algo que ya sabes hacer bien 💚 que lanzarte a una idea enorme desde cero. Lo importante es que puedas repetirlo y cobrarlo.",
          "No todo ingreso extra vale la pena 👀. Si te exige mucho tiempo, inversión o riesgo, revisa si realmente mejora tu situación o solo te desgasta.",
          "Prueba empezar con algo simple: ventas, apoyo académico, diseño, domicilios o servicios digitales 💸. Primero valida demanda y luego decides si escalar."
        ],
        scoreWords: ["extra", "trabajo", "generar", "plata"]
      }
    ],
    scoreWords: ["ingreso", "extra", "ganar", "plata", "dinero"]
  },
  {
    intent: "organizacion",
    topics: ["organizar", "finanzas", "orden"],
    keywords: [
      "que hacer con mi dinero",
      "como organizar mis finanzas",
      "como mejorar habitos financieros",
      "organizar mis finanzas",
      "mi dinero",
      "no se que hacer con la plata",
      "como me organizo",
      "ordenar mis finanzas",
      "como manejar mi plata"
    ],
    responses: [
      "Para organizar tus finanzas, divide tu dinero en gastos fijos, ahorro y metas 🎯. Si decides eso apenas entra la plata, te será mucho más fácil sostener el orden.",
      "El orden financiero mejora mucho cuando decides el destino de tu dinero antes de gastarlo 👀",
      "Una estructura simple de gastos, ahorro y metas ya te da bastante claridad 💚"
    ],
    scoreWords: ["organizar", "finanzas", "orden", "plata", "dinero"]
  },
  {
    intent: "emergencia",
    topics: ["fondo", "imprevistos"],
    keywords: [
      "emergencia",
      "fondo de emergencia",
      "ahorro de emergencia",
      "imprevistos",
      "colchon financiero",
      "plata para emergencias"
    ],
    responses: [
      "Tu fondo de emergencia es un colchón para no endeudarte cuando algo se daña o se complica 🛟. Empieza con la meta de reunir un mes de gastos y luego súbelo poco a poco.",
      "El fondo de emergencia te da aire cuando aparece un gasto inesperado 👀",
      "Si construyes ese colchón poco a poco, evitas resolver urgencias con deuda 💚"
    ],
    scoreWords: ["emergencia", "fondo", "imprevisto", "colchon"]
  },
  {
    intent: "inversion",
    topics: ["invertir", "rentabilidad"],
    keywords: [
      "invertir",
      "quiero invertir",
      "como invertir en colombia",
      "en que invierto",
      "invertir plata",
      "invertir dinero"
    ],
    ambiguity: [
      "quiero invertir",
      "invertir",
      "en que invierto"
    ],
    clarification: "¿Quieres invertir para corto plazo, largo plazo o simplemente empezar sin mucho riesgo? 📘",
    responses: [
      "Antes de invertir, asegúrate de tener tus gastos ordenados y algo de ahorro base 📘. Invertir sin colchón puede hacerte vender mal o endeudarte si sale un imprevisto.",
      "Invertir tiene más sentido cuando ya tienes algo de orden y un pequeño respaldo 👀",
      "No empieces por rentabilidad; empieza por entender tu plazo y tu tolerancia al riesgo 💚"
    ],
    scoreWords: ["invertir", "inversion", "rentabilidad", "riesgo"]
  },
  {
    intent: "presupuesto",
    topics: ["presupuesto", "plan mensual"],
    keywords: [
      "presupuesto",
      "hacer presupuesto",
      "como hago un presupuesto",
      "como hacer un presupuesto",
      "plan de gastos",
      "presupuesto mensual"
    ],
    responses: [
      "Haz un presupuesto sencillo: cuánto entra, cuánto sale y cuánto quieres guardar ✍️. Si es claro y realista, será más fácil cumplirlo cada mes.",
      "Un presupuesto útil no tiene que ser complicado; solo debe mostrarte qué entra y qué sale 👀",
      "Si tu presupuesto es realista, tendrás más chance de sostenerlo sin frustrarte 💚"
    ],
    scoreWords: ["presupuesto", "plan", "mensual", "gastos"]
  },
  {
    intent: "salario_minimo",
    topics: ["ingresos bajos", "alcance"],
    keywords: [
      "salario minimo",
      "gano poco",
      "me gano el minimo",
      "gano un minimo",
      "mi sueldo es poco",
      "me gano poquito"
    ],
    responses: [
      "Si ganas poco, no te exijas ahorrar grande desde el inicio 💚. Empieza con metas pequeñas y enfócate mucho en controlar fugas de gasto.",
      "Cuando el ingreso es ajustado, el objetivo no es ahorrar perfecto sino sostener pequeños avances 👀",
      "Si hoy ganas poco, cuida mucho tus gastos hormiga y arma metas pequeñas que sí puedas cumplir 💸"
    ],
    scoreWords: ["minimo", "sueldo", "gano", "poco"]
  }
];

async function apiFetch(url, options = {}) {
  const { redirectOnAuthFailure = true, headers, ...rest } = options;
  const response = await fetch(url, {
    credentials: "include",
    ...rest,
    headers
  });

  if (response.status === 401 && redirectOnAuthFailure) {
    window.location = "login.html";
    throw new Error("AUTH_REQUIRED");
  }

  return response;
}

async function obtenerSesionUsuario() {
  try {
    const res = await apiFetch(`${API_URL}/auth/session`, { redirectOnAuthFailure: false });
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.usuario || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function storageKey(base) {
  return `${base}_${usuario?.id_usuario || "guest"}`;
}

function usuarioAutorizoDatos() {
  return usuario?.datos_autorizados === true || usuario?.datos_autorizados === 1 || usuario?.datos_autorizados === "1";
}

function mostrarConsentimientoDatosSiHaceFalta() {
  if (usuarioAutorizoDatos()) return;
  const check = document.getElementById("checkConsentimientoDatos");
  if (check) check.checked = false;
  openModal("modalConsentimientoDatos");
}

async function aceptarConsentimientoDatos() {
  const check = document.getElementById("checkConsentimientoDatos");
  const button = document.getElementById("btnAceptarConsentimiento");
  if (!check?.checked) {
    showBanner("consentimientoBanner", "Marca la casilla para autorizar el uso de datos.");
    return;
  }

  try {
    if (button) button.disabled = true;
    const res = await apiFetch(`${API_URL}/usuarios/${usuario.id_usuario}/consentimiento-datos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acepta: true })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showBanner("consentimientoBanner", data.mensaje || "No se pudo registrar la autorizacion.");
      return;
    }

    usuario = {
      ...usuario,
      ...(data.usuario || {}),
      datos_autorizados: true
    };
    cerrarModalGenerico("modalConsentimientoDatos");
    showToast("Autorización registrada correctamente.", "success");
  } catch (error) {
    console.error(error);
    showBanner("consentimientoBanner", "No se pudo registrar la autorizacion.");
  } finally {
    if (button) button.disabled = false;
  }
}

function resetInactivityTimer() {
  if (!usuario?.id_usuario || sessionClosingForInactivity) return;
  clearTimeout(inactivityTimerId);
  inactivityTimerId = setTimeout(cerrarSesionPorInactividad, INACTIVITY_LIMIT_MS);
}

async function cerrarSesionPorInactividad() {
  if (sessionClosingForInactivity) return;
  sessionClosingForInactivity = true;
  showToast("Sesión cerrada por 10 minutos de inactividad.", "info", 1800);
  await logout({ skipConfirm: true, reason: "inactivity" });
}

function setupInactivityLogout() {
  const events = ["click", "keydown", "touchstart", "mousemove", "scroll", "input"];
  events.forEach((eventName) => {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function getConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.config)) || "{}") };
  } catch (error) {
    console.error(error);
    return { ...DEFAULT_CONFIG };
  }
}

function getNotifications() {
  try {
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.notifications)) || "{}") };
  } catch (error) {
    console.error(error);
    return { ...DEFAULT_NOTIFICATIONS };
  }
}

function saveConfig(config) {
  localStorage.setItem(storageKey(STORAGE_KEYS.config), JSON.stringify(config));
  localStorage.setItem(STORAGE_KEYS.appLanguage, config.language);
}

function saveNotifications(config) {
  localStorage.setItem(storageKey(STORAGE_KEYS.notifications), JSON.stringify(config));
}

function getWalleMemory() {
  try {
    return {
      lastRecommendation: "",
      lastProblemCategory: "",
      incomeAmount: 0,
      goalAmount: 0,
      knownDebts: [],
      lastInsightAt: 0,
      history: [],
      financialContext: null,
      ...JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.walleMemory)) || "{}")
    };
  } catch (error) {
    console.error(error);
    return {
      lastRecommendation: "",
      lastProblemCategory: "",
      incomeAmount: 0,
      goalAmount: 0,
      knownDebts: [],
      lastInsightAt: 0,
      history: [],
      financialContext: null
    };
  }
}

function saveWalleMemory(partial) {
  const nextMemory = {
    ...getWalleMemory(),
    ...(partial || {})
  };
  localStorage.setItem(storageKey(STORAGE_KEYS.walleMemory), JSON.stringify(nextMemory));
  return nextMemory;
}

function resetWalleConversationState() {
  lastIntent = null;
  lastSubintent = null;
  lastTopicDetail = null;
  lastWalleResponseSignature = null;
  walleFinancialSnapshot = null;
  walleFinancialSnapshotAt = 0;
  walleConversationState.followUpDepth = 0;
  walleConversationState.lastQuestion = "";
  walleConversationState.messages = [];
  walleConversationState.guidedModule = "";
}

function resetWalleConversationForUser() {
  resetWalleConversationState();
  localStorage.removeItem(storageKey(STORAGE_KEYS.walleMemory));

  const messages = document.getElementById("walleChatMessages");
  if (messages) {
    messages.innerHTML = "";
    delete messages.dataset.initialized;
  }

  const input = document.getElementById("walleQuestionInput");
  if (input) {
    input.value = "";
  }
}

function getDefaultWalleFinancialContext() {
  if (window.WalleEngine?.createEmptyContext) {
    return window.WalleEngine.createEmptyContext();
  }

  return {
    intent: null,
    ingreso: null,
    gastos: [],
    deudas: [],
    tasas: [],
    ultimoTema: null,
    palabrasClave: [],
    ultimaPregunta: ""
  };
}

function getRememberedFinancialContext() {
  const defaults = getDefaultWalleFinancialContext();
  const stored = getWalleMemory().financialContext || {};
  return {
    ...defaults,
    ...stored,
    gastos: Array.isArray(stored.gastos) ? stored.gastos : [],
    deudas: Array.isArray(stored.deudas) ? stored.deudas : [],
    tasas: Array.isArray(stored.tasas) ? stored.tasas : [],
    palabrasClave: Array.isArray(stored.palabrasClave) ? stored.palabrasClave : [],
    ultimaPregunta: stored.ultimaPregunta || ""
  };
}

function syncWalleEngineLegacyState(context, question, rule = "") {
  if (!context) return;

  if (context.intent) {
    lastIntent = { intent: context.intent };
  }

  lastSubintent = rule ? { intent: rule } : null;
  lastTopicDetail = {
    ...(lastTopicDetail || {}),
    incomeAmount: Number(context.ingreso || lastTopicDetail?.incomeAmount || 0),
    question: question || lastTopicDetail?.question || "",
    debtCount: Array.isArray(context.deudas) ? context.deudas.length : 0,
    financialContext: context
  };
  walleConversationState.lastQuestion = question || walleConversationState.lastQuestion;
}

function persistWalleEngineContext(context, question, response, rule = "", intent = "") {
  if (!context) return null;

  const nextContext = {
    ...getDefaultWalleFinancialContext(),
    ...context,
    gastos: Array.isArray(context.gastos) ? context.gastos : [],
    deudas: Array.isArray(context.deudas) ? context.deudas : [],
    tasas: Array.isArray(context.tasas) ? context.tasas : [],
    palabrasClave: Array.isArray(context.palabrasClave) ? context.palabrasClave : []
  };

  saveWalleMemory({
    financialContext: nextContext,
    incomeAmount: Number(nextContext.ingreso || 0),
    knownDebts: nextContext.deudas,
    lastRecommendation: response || getWalleMemory().lastRecommendation,
    lastProblemCategory: intent || nextContext.ultimoTema || ""
  });
  syncWalleEngineLegacyState(nextContext, question, rule);
  return nextContext;
}

function processWalleWithEngine(question) {
  if (!window.WalleEngine?.processMessage) return "";

  const previousContext = getRememberedFinancialContext();
  const result = window.WalleEngine.processMessage(question, {
    context: previousContext,
    history: getWalleHistory()
  });

  if (!result) return "";

  persistWalleEngineContext(
    result.context || previousContext,
    question,
    result.response || "",
    result.decision?.rule || "",
    result.intent || ""
  );

  if (result.passToLegacy) {
    return "";
  }

  return result.response || "";
}

function getWalleHistory() {
  const memory = getWalleMemory();
  const history = Array.isArray(memory.history) ? memory.history : [];
  return history.slice(-MAX_WALLE_HISTORY);
}

function getWalleConversationHistorySnapshot() {
  return walleConversationState.messages.length ? walleConversationState.messages : getWalleHistory();
}

function getLastWalleHistoryEntry(role) {
  const history = getWalleConversationHistorySnapshot();
  return [...history].reverse().find((entry) => entry.role === role) || null;
}

function buildWalleNoRepeatResponse(question) {
  const normalizedQuestion = normalizeWalleText(question);
  const financialContext = getRememberedFinancialContext();

  if (
    /cdt|invert|inversion|rentabilidad|rendimiento|promedio/.test(normalizedQuestion) ||
    financialContext.ultimoTema === "inversion"
  ) {
    return [
      "No tengo ese dato en tiempo real.",
      "Yo calculo y comparo la informacion que me des para ayudarte a tomar una mejor decision.",
      "Si me compartes tasas, plazos o las ofertas que viste, te digo cual te conviene mas."
    ].join("\n");
  }

  if (/ahorr|meta|viaje/.test(normalizedQuestion)) {
    return [
      "Para no repetirte lo mismo, mejor aterrizamos el calculo con tus datos.",
      "Yo te respondo mejor si me das el monto, el plazo o la meta exacta.",
      "Si quieres, te lo saco de una con numeros."
    ].join("\n");
  }

  if (/deuda|credito|prestamo|tasa/.test(normalizedQuestion)) {
    return [
      "Para no devolverte la misma respuesta, mejor hagamos la comparacion con tus numeros.",
      "Yo te ayudo mas si me pasas monto, tasa y plazo.",
      "Con eso te digo que opcion te conviene mas."
    ].join("\n");
  }

  return "";
}

function finalizeWalleOutgoingResponse(question, response) {
  if (!response) return response;

  const lastBotEntry = getLastWalleHistoryEntry("bot");
  const lastUserEntry = getLastWalleHistoryEntry("user");
  if (!lastBotEntry?.message) {
    return response;
  }

  const sameResponse = normalizeWalleText(lastBotEntry.message) === normalizeWalleText(response);
  const sameQuestion = normalizeWalleText(lastUserEntry?.message || "") === normalizeWalleText(question);

  if (sameResponse && !sameQuestion) {
    return buildWalleNoRepeatResponse(question) || response;
  }

  return response;
}

function saveWalleHistoryEntry(role, message, meta = {}) {
  const history = getWalleHistory();
  history.push({
    role,
    message,
    intent: meta.intent || null,
    subintent: meta.subintent || null,
    incomeAmount: meta.incomeAmount || 0,
    at: Date.now()
  });
  const trimmed = history.slice(-MAX_WALLE_HISTORY);
  walleConversationState.messages = trimmed;
  saveWalleMemory({ history: trimmed });
  return trimmed;
}

function currentText() {
  return UI_TEXT[getConfig().language] || UI_TEXT.es;
}

function tx(key, vars = {}) {
  let text = currentText()[key] || UI_TEXT.es[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value);
  });
  return text;
}

function onboardingText() {
  return ONBOARDING_COPY[getConfig().language] || ONBOARDING_COPY.es;
}

function getWalleMessages() {
  return {
    welcome: tx("walleWelcome"),
    goodJob: tx("walleGoodJob"),
    watchExpense: tx("walleWatchExpense"),
    saveToday: tx("walleSaveToday"),
    openAssistant: tx("walleOpenAssistant")
  };
}

function getWalleLoaderMessages() {
  const texts = currentText();
  return texts.walleLoaderMessages || UI_TEXT.es.walleLoaderMessages;
}

function normalizeWalleText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeWalleText(text) {
  return normalizeWalleText(text).split(" ").filter(Boolean);
}

function keywordMatchesQuestion(question, keyword) {
  const normalizedQuestion = normalizeWalleText(question);
  const normalizedKeyword = normalizeWalleText(keyword);
  if (!normalizedQuestion || !normalizedKeyword) return false;
  return normalizedQuestion.includes(normalizedKeyword);
}

function scoreWalleIntent(question, intent) {
  const normalizedQuestion = normalizeWalleText(question);
  const tokens = tokenizeWalleText(question);
  let score = 0;

  intent.keywords.forEach((keyword) => {
    if (keywordMatchesQuestion(normalizedQuestion, keyword)) {
      const keywordLength = tokenizeWalleText(keyword).length;
      score += keywordLength >= 4 ? 7 : keywordLength > 1 ? 5 : 2;
    }
  });

  (intent.scoreWords || []).forEach((word) => {
    if (tokens.some((token) => token.includes(normalizeWalleText(word)))) {
      score += 1;
    }
  });

  return score;
}

function getWalleGeneralOrientation(intent) {
  const orientationMap = {
    deudas: "No estoy completamente seguro, pero si estás hablando de deudas puedo orientarte con pagos, intereses, refinanciación o centrales de riesgo 👀",
    gastos: "No lo capté del todo, pero si va por el lado de gastos puedo ayudarte a revisar gastos hormiga, comida, arriendo o cómo recortar sin desordenarte 💚",
    ingresos: "No estoy del todo seguro, pero si tu tema es ingresos puedo ayudarte a pensar en ingresos extra o en qué hacer cuando el sueldo no alcanza 💸",
    ahorro: "No lo entendí por completo, pero si quieres puedo ayudarte con ahorro, porcentaje recomendado o dónde separar tu dinero 💚",
    tarjeta_credito: "No estoy totalmente seguro, pero si el tema es tarjeta puedo ayudarte con pagos mínimos, intereses o uso responsable 👀"
  };

  return orientationMap[intent?.intent] || tx("walleUnknown");
}

function detectNearbyWalleIntent(question) {
  const normalizedQuestion = normalizeWalleText(question);
  const tokens = tokenizeWalleText(normalizedQuestion);
  if (!tokens.length) return null;

  const nearbyMatches = walleIntents
    .map((intent) => {
      let score = 0;
      const vocabulary = [
        ...(intent.scoreWords || []),
        ...(intent.topics || []),
        ...((intent.subintents || []).flatMap((subintent) => subintent.scoreWords || []))
      ];

      vocabulary.forEach((word) => {
        const normalizedWord = normalizeWalleText(word);
        if (normalizedWord && tokens.some((token) => token.includes(normalizedWord) || normalizedWord.includes(token))) {
          score += 1;
        }
      });

      return { intent, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return nearbyMatches[0] || null;
}

function getRandomResponse(intent) {
  const responses = Array.isArray(intent?.responses) && intent.responses.length
    ? intent.responses
    : intent?.response
      ? [intent.response]
      : [];

  if (!responses.length) {
    return tx("walleUnknown");
  }

  let randomIndex = Math.floor(Math.random() * responses.length);
  const responseKey = intent?.intent || intent?.topic || "default";

  if (responses.length > 1 && lastWalleResponseSignature?.key === responseKey && lastWalleResponseSignature.index === randomIndex) {
    randomIndex = (randomIndex + 1) % responses.length;
  }

  lastWalleResponseSignature = { key: responseKey, index: randomIndex };
  return responses[randomIndex];
}

function detectWalleIntent(question) {
  const scored = walleIntents
    .map((intent) => ({ intent, score: scoreWalleIntent(question, intent) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

function detectWalleSubintent(question, parentIntent) {
  const subintents = parentIntent?.subintents || [];
  const scored = subintents
    .map((subintent) => ({ subintent, score: scoreWalleIntent(question, subintent) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

function detectWalleIntentFromSubintents(question) {
  const matches = walleIntents
    .flatMap((intent) =>
      (intent.subintents || []).map((subintent) => ({
        intent,
        subintent,
        score: scoreWalleIntent(question, subintent)
      }))
    )
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0] || null;
}

function isWalleContextualQuestion(question) {
  const normalizedQuestion = normalizeWalleText(question);
  const tokens = tokenizeWalleText(normalizedQuestion);
  const contextualKeywords = [
    "porcentaje",
    "cantidad",
    "cuanto",
    "como",
    "donde",
    "cual",
    "eso",
    "esa",
    "ahi",
    "seria",
    "como asi"
  ];

  return tokens.length <= 4 || contextualKeywords.some((keyword) => normalizedQuestion.includes(keyword));
}

function isPureGreeting(question) {
  const normalizedQuestion = normalizeWalleText(question);
  if (!normalizedQuestion) return false;

  const pureGreetingKeywords = [
    "hola",
    "hola walle",
    "buenas",
    "buenas walle",
    "hello",
    "hi",
    "hey",
    "que tal",
    "q tal",
    "holi",
    "buen dia",
    "buenas tardes",
    "buenas noches"
  ];

  return pureGreetingKeywords.some((keyword) => normalizedQuestion === normalizeWalleText(keyword));
}

function buildGreetingResponse(baseResponse, question) {
  if (!isPureGreeting(question)) {
    return baseResponse;
  }

  return `${baseResponse}\n\nPuedes tocar un tema del cuadro o escribir tu pregunta. Te puedo guiar sobre ahorro, deudas, gastos, tarjetas, ingresos, creditos, bancos y tramites financieros en Colombia.`;
}

function isWalleFollowUpQuestion(question) {
  const normalizedQuestion = normalizeWalleText(question);
  const followUpPhrases = [
    "eso",
    "y eso",
    "cuanto seria",
    "cuanto es eso",
    "como asi",
    "y como asi",
    "explicame",
    "y cuanto",
    "como seria"
  ];

  return followUpPhrases.some((phrase) => normalizedQuestion.includes(phrase));
}

function matchesShortReply(text, phrases) {
  const normalized = normalizeWalleText(text);
  const tokens = tokenizeWalleText(normalized);
  return phrases.some((item) => {
    const normalizedItem = normalizeWalleText(item);
    const itemTokens = tokenizeWalleText(normalizedItem);
    if (itemTokens.length <= 1) {
      return tokens.includes(normalizedItem);
    }
    return normalized === normalizedItem || normalized.includes(normalizedItem);
  });
}

function esConfirmacion(texto) {
  const confirmaciones = ["si", "sí", "claro", "dale", "ok", "listo", "de una", "hagale", "hágale", "obvio", "yes"];
  return matchesShortReply(texto, confirmaciones);
}

function esNegacion(texto) {
  const negativas = ["no", "despues", "después", "luego", "mas luego", "ahorita no", "no gracias", "luego vemos"];
  return matchesShortReply(texto, negativas);
}

function isHowQuestion(question) {
  const normalizedQuestion = normalizeWalleText(question);
  return normalizedQuestion.includes("como") || normalizedQuestion.includes("cómo hago") || normalizedQuestion.includes("como lo hago");
}

function extraerMonto(texto) {
  if (window.WalleEngine?.extraerMonto) {
    return window.WalleEngine.extraerMonto(texto);
  }

  const regex = /(\d+(?:[\.,]\d+)?)\s*(millones|m|mil|palos|palo|lucas|luca)?/gi;
  const match = regex.exec(String(texto || ""));

  if (!match) return null;

  let valor = parseFloat(String(match[1]).replace(",", "."));
  if (!Number.isFinite(valor)) return null;

  if (match[2]) {
    const unidad = match[2].toLowerCase();
    if (unidad === "m" || unidad.includes("mill") || unidad.includes("palo")) valor *= 1000000;
    if (unidad.includes("mil") || unidad.includes("luca")) valor *= 1000;
  } else if (String(match[1]).replace(/\D/g, "").length >= 4) {
    valor = parseNumeroInput(match[1]);
  }

  return Math.round(valor);
}

function extractWalleIncomeAmount(question) {
  const amount = extraerMonto(question) || 0;
  if (!amount) return 0;

  const normalizedQuestion = normalizeWalleText(question);
  const explicitIncomeCues = [
    "gano",
    "ganar",
    "ingreso",
    "ingresos",
    "salario",
    "sueldo",
    "me pagan",
    "me entra"
  ];

  const wasIncomePrompt = normalizeWalleText(walleConversationState.lastQuestion || "").includes("cuanto ganas");
  const shortAmountReply = tokenizeWalleText(normalizedQuestion).length <= 6;

  if (explicitIncomeCues.some((term) => normalizedQuestion.includes(normalizeWalleText(term)))) {
    return amount;
  }

  if (wasIncomePrompt && shortAmountReply) {
    return amount;
  }

  if (isGoalSavingsContext(question)) {
    return 0;
  }

  if (lastIntent?.intent === "ahorro" && shortAmountReply) {
    return amount;
  }

  return 0;
}

function buildSavingsExamples(amount) {
  const referenceAmount = amount > 0 ? amount : 1000000;
  const tenPercent = Math.round(referenceAmount * 0.10);
  const fivePercent = Math.round(referenceAmount * 0.05);

  return {
    referenceAmount,
    tenPercent,
    fivePercent
  };
}

function getRememberedIncome() {
  return Number(lastTopicDetail?.incomeAmount || getWalleMemory().incomeAmount || 0);
}

function getRememberedGoalAmount() {
  return Number(lastTopicDetail?.goalAmount || getWalleMemory().goalAmount || 0);
}

function rememberWalleIncome(amount, question = "") {
  if (!amount || amount <= 0) return;
  saveWalleMemory({ incomeAmount: amount });
  lastTopicDetail = {
    ...(lastTopicDetail || {}),
    incomeAmount: amount,
    question: question || lastTopicDetail?.question || ""
  };
}

function rememberWalleGoal(amount, question = "") {
  if (!amount || amount <= 0) return;
  saveWalleMemory({ goalAmount: amount });
  lastTopicDetail = {
    ...(lastTopicDetail || {}),
    goalAmount: amount,
    question: question || lastTopicDetail?.question || ""
  };
}

function isSavingsContext(question) {
  const normalizedQuestion = normalizeWalleText(question);
  return [
    "ahorros",
    "ahorrar",
    "ahorro",
    "cuanto deberia ahorrar",
    "cuanto debería ahorrar",
    "cuanto ahorro",
    "si gano",
    "si me gano"
  ].some((term) => normalizedQuestion.includes(normalizeWalleText(term)));
}

function buildSavingsAmountResponse(amount) {
  const examples = buildSavingsExamples(amount);
  return buildWalleStructuredResponse(
    `Si ganas ${formatoCOP(examples.referenceAmount)} 👇\nAhorrar el 10% serían ${formatoCOP(examples.tenPercent)} 💚`,
    `Puedes empezar incluso con 5% (${formatoCOP(examples.fivePercent)}) si quieres ir más suave 👀`,
    "Si quieres, también te lo divido por semana o por quincena."
  );
}

function isGoalSavingsContext(question) {
  const normalizedQuestion = normalizeWalleText(question);
  return [
    "meta",
    "viaje",
    "quiero ahorrar para",
    "ahorrar para",
    "lograr esa meta",
    "porcentaje mensual",
    "ahorrar mensualmente",
    "cuanto deberia ahorrar mensualmente",
    "cuanto debería ahorrar mensualmente",
    "cuanto debo ahorrar para",
    "cuanto tengo que ahorrar para",
    "cuanto ahorrar para",
    "juntar para",
    "reunir para"
  ].some((term) => normalizedQuestion.includes(normalizeWalleText(term)));
}

function isCorrectionMessage(question) {
  const normalizedQuestion = normalizeWalleText(question);
  return [
    "era bromeando",
    "olvida eso",
    "ignore eso",
    "más bien",
    "mas bien",
    "mejor dicho"
  ].some((term) => normalizedQuestion.includes(normalizeWalleText(term)));
}

function extractGoalTargetAmount(question, incomeAmount = 0) {
  const montos = extraerMontos(question).map((item) => item.value);
  if (!montos.length) return 0;
  const candidates = montos.filter((value) => value !== incomeAmount);
  return candidates[candidates.length - 1] || 0;
}

function buildGoalSavingsNeedResponse(incomeAmount, goalAmount, months) {
  const monthlyRequired = goalAmount / months;
  const monthlyPercent = incomeAmount > 0 ? (monthlyRequired / incomeAmount) * 100 : 0;
  return buildWalleStructuredResponse(
    `Para una meta de ${formatoCOP(goalAmount)} en ${months} meses 👇\nTendrías que ahorrar aprox ${formatoCOP(monthlyRequired)} al mes 💚`,
    `Eso equivale a guardar cerca del ${monthlyPercent.toFixed(1)}% de un ingreso mensual de ${formatoCOP(incomeAmount)} 👀`,
    monthlyPercent > 30
      ? "Está pesado. Si quieres, te ayudo a recalcularla a más meses para que sea más realista."
      : "Se ve alcanzable si lo vuelves fijo cada mes. Si quieres, te lo bajo a valor semanal."
  );
}

function updateWalleContext(intent, subintent, detail = null) {
  lastIntent = intent || lastIntent;
  if (subintent === null) {
    lastSubintent = null;
  } else {
    lastSubintent = subintent || lastSubintent;
  }
  lastTopicDetail = detail || lastTopicDetail;
  walleConversationState.lastQuestion = detail?.question || walleConversationState.lastQuestion;
}

function getWalleFollowUp(intentName, subintentName) {
  const followUps = {
    ahorro: "¿Quieres que te ayude a calcularlo con tu ingreso? 👀",
    porcentaje_ahorro: "¿Cuánto ganas más o menos? 💚",
    cuanto_ahorrar: "¿Quieres que te lo baje a un ejemplo mensual o semanal? 👀",
    cuanto_ahorrar_dinero: "¿Quieres que lo calcule con tu ingreso? 💸",
    ahorro_bajo_ingreso: "¿Quieres que te ayude a organizar tus gastos primero? 👀",
    deudas: "¿Quieres que revisemos intereses, cuotas o si te conviene refinanciar? 👀",
    unificar_deudas: "¿Quieres que te explique cómo saber si sí te conviene? 💚",
    no_puedo_pagar: "¿Quieres que te ayude a priorizar qué pagar primero? ⚠️",
    pagar_minimos: "¿Quieres que te muestre por qué eso puede alargar tanto la deuda? 👀",
    gastos: "¿Quieres organizar tus gastos por categorías? 💚",
    organizar_gastos: "¿Quieres organizar tus gastos por categorías? 💚",
    gastos_hormiga: "¿Quieres que te muestre cómo detectarlos rápido? 👀",
    gasto_comida: "¿Quieres que te proponga una forma simple de bajarlo sin sufrirlo? 💸",
    gasto_arriendo: "¿Quieres revisar cuánto porcentaje de tu ingreso se te va ahí? 👀",
    ingresos: "¿Quieres que pensemos opciones de ingreso extra según lo que sabes hacer? 💚",
    ingresos_extra: "¿Quieres que te dé ideas más realistas para empezar? 🚀",
    no_gano_suficiente: "¿Quieres que te ayude a revisar si el problema es más de ingreso o de gasto? 👀"
  };

  return followUps[subintentName] || followUps[intentName] || "";
}

function buildContextualWalleResponse(question) {
  const normalizedQuestion = normalizeWalleText(question);
  const incomeAmount = extractWalleIncomeAmount(question);
  const savedIncome = getRememberedIncome();
  const referenceIncome = incomeAmount || savedIncome;

  if (incomeAmount && lastIntent?.intent === "ahorro") {
    rememberWalleIncome(incomeAmount, question);
    return buildSavingsAmountResponse(incomeAmount);
  }

  if (lastIntent?.intent === "ahorro" && (lastSubintent?.intent === "porcentaje_ahorro" || lastSubintent?.intent === "cuanto_ahorrar" || lastSubintent?.intent === "cuanto_ahorrar_dinero")) {
    const examples = buildSavingsExamples(referenceIncome);

    if (normalizedQuestion.includes("cuanto") || normalizedQuestion.includes("seria") || normalizedQuestion.includes("eso")) {
      updateWalleContext(lastIntent, { intent: "cuanto_ahorrar_dinero" }, {
        incomeAmount: examples.referenceAmount,
        percent: 10,
        question
      });
      return `Si ganas ${formatoCOP(examples.referenceAmount)}, ahorrar el 10% serían ${formatoCOP(examples.tenPercent)} 💚. Si prefieres empezar más suave, un 5% serían ${formatoCOP(examples.fivePercent)}.\n\n¿Quieres que te lo calcule con otro ingreso? 👀`;
    }

    if (normalizedQuestion.includes("como asi") || normalizedQuestion.includes("explicame")) {
      updateWalleContext(lastIntent, lastSubintent, {
        incomeAmount: examples.referenceAmount,
        percent: 10,
        question
      });
      return `La idea es separar una parte apenas recibes tu ingreso 👀. Por ejemplo, si ganas ${formatoCOP(examples.referenceAmount)}, podrías mover ${formatoCOP(examples.tenPercent)} a ahorro y dejar el resto para tus gastos del mes.\n\n¿Quieres que te proponga una meta según lo que ganas? 💚`;
    }
  }

  if (lastIntent?.intent === "deudas" && lastSubintent?.intent === "unificar_deudas" && isWalleFollowUpQuestion(normalizedQuestion)) {
    updateWalleContext(lastIntent, lastSubintent, { question });
    return "Para saber si sí te conviene unificar deudas 👀, compara tres cosas: tasa de interés, plazo nuevo y valor total que terminarías pagando. Si solo baja la cuota pero sube mucho el tiempo, podrías terminar pagando más 💸.\n\n¿Quieres que te diga en qué números fijarte?";
  }

  if (lastIntent?.intent === "deudas" && lastSubintent?.intent === "no_puedo_pagar" && isWalleFollowUpQuestion(normalizedQuestion)) {
    updateWalleContext(lastIntent, lastSubintent, { question });
    return "Si hoy no te alcanza, prioriza comida, vivienda y la deuda más sensible ⚠️. Después intenta negociar las demás antes de dejar que entren en mora más fuerte.\n\n¿Quieres que te ayude a ordenar qué pagar primero?";
  }

  return "";
}

function buildWalleConfirmationResponse(question) {
  if (!esConfirmacion(question) && !esNegacion(question)) {
    return "";
  }

  if (esNegacion(question)) {
    return "Listo 👀 cuando quieras te ayudo a organizarlos";
  }

  const currentIntent = lastSubintent?.intent || lastIntent?.intent || "";

  const confirmationFlows = {
    organizar_gastos: "Perfecto 💚 hazlo así 👇\n1. Fijos: arriendo, servicios\n2. Variables: comida, transporte\n3. Extras: salidas, compras\n\nEmpieza revisando los extras, ahí suele irse más dinero 💸",
    reducir_gastos: "Perfecto 💚 arranca por aquí 👇\n1. Mira tus gastos repetidos\n2. Detecta antojos y compras impulso\n3. Pon un tope semanal a salidas y domicilios\n\nCorta primero uno o dos hábitos caros, no todo de golpe 💸",
    pagar_deudas: "Perfecto 💚 haz esto 👇\n1. Lista cada deuda con tasa y cuota\n2. Paga mínimos en todas\n3. Mete el extra a la más cara\n\nAsí bajas intereses más rápido 👀",
    unificar_deudas: "Perfecto 💚 revisa estas 3 cosas 👇\n1. Que la nueva tasa sea menor\n2. Que el plazo no se alargue demasiado\n3. Que el costo total sí baje\n\nNo te fijes solo en la cuota mensual 💸",
    ingresos_extra: "Perfecto 💚 empieza así 👇\n1. Elige algo que ya sepas hacer\n2. Prueba venderlo pequeño esta semana\n3. Quédate con lo que sí te deje plata y tiempo\n\nPrimero valida demanda, luego escalas 👀",
    cuanto_ahorrar: "Perfecto 💚 puedes usar esta guía rápida 👇\n1. 10% si tienes margen\n2. 5% si vas apretado\n3. Súbelo poco a poco cuando respires mejor\n\nLo importante es volverlo fijo cada mes 💸",
    porcentaje_ahorro: "Perfecto 💚 toma esto como base 👇\n1. 10% es una meta saludable\n2. 5% sirve para empezar sin ahogarte\n3. 20% ya es muy bueno si tu realidad lo permite\n\nPrimero constancia, luego monto 👀",
    ahorro: "Perfecto 💚 empieza así 👇\n1. Separa el ahorro apenas te paguen\n2. Déjalo fuera de la cuenta del gasto diario\n3. Hazlo fijo cada mes aunque sea poquito\n\nLa costumbre pesa más que arrancar con un monto enorme 💸",
    gastos: "Perfecto 💚 lo mejor es ordenarlos por categorías y revisar cuál se está comiendo más plata.\n\nSi quieres, empezamos por comida, transporte o salidas 👀"
  };

  const response = confirmationFlows[currentIntent];
  if (response) {
    updateWalleContext(lastIntent, lastSubintent, { ...(lastTopicDetail || {}), question });
    return response;
  }

  if (lastIntent?.intent === "gastos") {
    return confirmationFlows.organizar_gastos;
  }

  return "Perfecto 💚 cuéntame un poco más y seguimos sobre eso.";
}

function buildWalleHistoryDrivenResponse(question) {
  const normalized = normalizeWalleText(question);
  const detectedAmount = extractWalleIncomeAmount(question);
  const detectedMonths = extraerPlazoMeses(question);
  const history = walleConversationState.messages.length ? walleConversationState.messages : getWalleHistory();
  const lastBotMessage = [...history].reverse().find((entry) => entry.role === "bot");
  const lastUserMessage = [...history].reverse().find((entry) => entry.role === "user");
  const rememberedIncome = getRememberedIncome();
  const rememberedGoal = getRememberedGoalAmount();

  if (isCorrectionMessage(question)) {
    updateWalleContext(lastIntent, lastSubintent, {
      ...(lastTopicDetail || {}),
      question
    });
  }

  if (isGoalSavingsContext(question)) {
    return "";
  }

  if (detectedMonths && lastIntent?.intent === "meta_ahorro" && rememberedIncome && rememberedGoal) {
    return buildGoalSavingsNeedResponse(rememberedIncome, rememberedGoal, detectedMonths);
  }

  if (detectedAmount && lastIntent?.intent === "ahorro") {
    rememberWalleIncome(detectedAmount, question);
    updateWalleContext({ intent: "ahorro" }, { intent: "cuanto_ahorrar_dinero" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: detectedAmount,
      question
    });
    return buildSavingsAmountResponse(detectedAmount);
  }

  if (detectedAmount && lastBotMessage?.intent === "ahorro") {
    rememberWalleIncome(detectedAmount, question);
    updateWalleContext({ intent: "ahorro" }, { intent: "cuanto_ahorrar_dinero" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: detectedAmount,
      question
    });
    return buildSavingsAmountResponse(detectedAmount);
  }

  if (
    detectedAmount &&
    lastBotMessage?.message &&
    normalizeWalleText(lastBotMessage.message).includes("cuanto ganas mas o menos")
  ) {
    rememberWalleIncome(detectedAmount, question);
    updateWalleContext({ intent: "ahorro" }, { intent: "cuanto_ahorrar_dinero" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: detectedAmount,
      question
    });
    return buildSavingsAmountResponse(detectedAmount);
  }

  if (
    /cuanto ahorro|cuanto deberia ahorrar|cuanto debería ahorrar/.test(normalized) &&
    !detectedAmount &&
    getRememberedIncome()
  ) {
    return buildSavingsAmountResponse(getRememberedIncome());
  }

  if (
    normalized.includes("dime cuanto ahorro") &&
    !detectedAmount &&
    (lastUserMessage?.incomeAmount || rememberedIncome)
  ) {
    return buildSavingsAmountResponse(lastUserMessage?.incomeAmount || rememberedIncome);
  }

  return "";
}

function formatWallePercent(value) {
  const number = Number(value) || 0;
  if (number % 1 === 0) {
    return `${Math.round(number)}%`;
  }
  return `${number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function calcularInteres(monto, tasa, tiempo) {
  return monto * tasa * tiempo;
}

function interesCompuesto(monto, tasa, tiempo) {
  return monto * Math.pow((1 + tasa), tiempo);
}

function calcularCuota(monto, tasaMensual, meses) {
  const i = tasaMensual;
  const n = meses;
  if (!monto || !n) return 0;
  if (!i) return monto / n;
  return monto * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

function detectarPerfil(ingresos, gastos, deudas) {
  if (gastos > ingresos && ingresos > 0) return "riesgo";
  if (deudas > ingresos * 0.5 && ingresos > 0) return "endeudado";
  if (ingresos > 0 && ((ingresos - gastos) / ingresos) < 0.1) return "gastador";
  return "estable";
}

function parseWalleAmount(rawNumber, suffix = "") {
  if (!rawNumber) return 0;
  const normalized = String(rawNumber)
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const value = Number(normalized.replace(/\.(?=.*\.)/g, ""));
  if (!Number.isFinite(value)) return 0;

  const unit = normalizeWalleText(suffix);
  if (["m", "mill", "millon", "millones"].includes(unit)) {
    return Math.round(value * 1000000);
  }
  if (["k", "mil"].includes(unit)) {
    return Math.round(value * 1000);
  }

  const digitsOnly = String(rawNumber).replace(/\D/g, "");
  if (digitsOnly.length >= 4) {
    return Number(digitsOnly);
  }

  return value;
}

function getRatePeriodFromContext(text, index) {
  const raw = String(text || "").toLowerCase();
  const context = raw.slice(Math.max(0, index - 18), Math.min(raw.length, index + 28));
  if (/anual|ea|e\.a/.test(context)) return "anual";
  return "mensual";
}

function hasExplicitRatePeriod(text, index) {
  const raw = String(text || "").toLowerCase();
  const context = raw.slice(Math.max(0, index - 18), Math.min(raw.length, index + 28));
  return /mensual|anual|ea|e\.a/.test(context);
}

function normalizeRateToMonthly(rateDecimal, period = "mensual") {
  if (!Number.isFinite(rateDecimal)) return 0;
  if (period === "anual") {
    return Math.pow(1 + rateDecimal, 1 / 12) - 1;
  }
  return rateDecimal;
}

function normalizeRateToAnnual(rateDecimal, period = "mensual") {
  if (!Number.isFinite(rateDecimal)) return 0;
  if (period === "mensual") {
    return Math.pow(1 + rateDecimal, 12) - 1;
  }
  return rateDecimal;
}

function extraerTasas(texto) {
  const regex = /(\d+(?:[.,]\d+)?)\s?%/g;
  const tasas = [];
  let match;

  while ((match = regex.exec(String(texto || ""))) !== null) {
    tasas.push(parseFloat(match[1].replace(",", ".")));
  }

  return tasas;
}

function mejorTasa(tasas) {
  return Math.min(...tasas);
}

function extraerRateEntries(texto) {
  const regex = /(\d+(?:[.,]\d+)?)\s?%/g;
  const entries = [];
  let match;

  while ((match = regex.exec(String(texto || ""))) !== null) {
    const ratePercent = parseFloat(match[1].replace(",", "."));
    const period = getRatePeriodFromContext(texto, match.index);
    entries.push({
      raw: match[0],
      percent: ratePercent,
      decimal: ratePercent / 100,
      period,
      explicitPeriod: hasExplicitRatePeriod(texto, match.index),
      monthlyDecimal: normalizeRateToMonthly(ratePercent / 100, period),
      annualDecimal: normalizeRateToAnnual(ratePercent / 100, period),
      index: match.index
    });
  }

  return entries;
}

function extraerPlazoMeses(texto) {
  const normalized = String(texto || "").toLowerCase();
  const monthMatch = normalized.match(/(\d+)\s*(meses|mes)\b/);
  if (monthMatch) return Number(monthMatch[1]);

  const yearMatch = normalized.match(/(\d+)\s*(anos|año|años|ano)\b/);
  if (yearMatch) return Number(yearMatch[1]) * 12;

  return 0;
}

function extraerMontos(texto) {
  if (window.WalleEngine?.extraerMontos) {
    return window.WalleEngine.extraerMontos(texto).map((item) => ({
      raw: item.raw,
      value: item.value,
      index: item.index
    }));
  }

  const regex = /(\d+(?:[.,]\d+)?)\s*(millones?|millon|mill|m|mil|k)?/gi;
  const montos = [];
  let match;

  while ((match = regex.exec(String(texto || ""))) !== null) {
    const raw = match[0];
    const value = parseWalleAmount(match[1], match[2]);
    const normalizedRaw = normalizeWalleText(raw);
    if (!value || normalizedRaw === "0") continue;
    if (/%/.test(raw)) continue;
    montos.push({
      raw,
      value,
      index: match.index
    });
  }

  return montos;
}

function extraerDeudas(texto) {
  const debtRegex = /(\d+(?:[.,]\d+)?)\s*(millones?|millon|mill|m|mil|k)?(?:\s+de)?[^%\n]{0,24}?\bal\b[^%\n]{0,8}?(\d+(?:[.,]\d+)?)\s?%(?:\s*(mensual|anual))?/gi;
  const deudas = [];
  let match;

  while ((match = debtRegex.exec(String(texto || ""))) !== null) {
    const monto = parseWalleAmount(match[1], match[2]);
    const ratePercent = parseFloat(String(match[3]).replace(",", "."));
    const period = normalizeWalleText(match[4]) || getRatePeriodFromContext(texto, match.index);
    deudas.push({
      monto,
      tasaPercent: ratePercent,
      tasaDecimal: ratePercent / 100,
      period,
      explicitPeriod: Boolean(match[4]),
      monthlyRate: normalizeRateToMonthly(ratePercent / 100, period),
      annualRate: normalizeRateToAnnual(ratePercent / 100, period),
      label: `${formatoCOP(monto)} al ${formatWallePercent(ratePercent)} ${period}`
    });
  }

  return deudas;
}

function detectarMontoPrincipal(texto, deudas = []) {
  if (deudas.length === 1) return deudas[0].monto;
  const montos = extraerMontos(texto);
  return montos[0]?.value || 0;
}

function calcularCostoInteresDeuda(deuda, meses = 12) {
  return calcularInteres(deuda.monto, deuda.monthlyRate, meses);
}

function evaluarConsolidacion(tasasActuales, nuevaTasa) {
  const promedio = tasasActuales.reduce((a, b) => a + b, 0) / tasasActuales.length;

  if (nuevaTasa < promedio) {
    return "Sí te conviene 💚 reduces el interés total";
  }
  return "No te conviene ⚠️ podrías pagar más";
}

function buildWalleStructuredResponse(result, explanation, recommendation) {
  return `${result}\n${explanation}\n${recommendation}`;
}

async function getWalleFinancialSnapshot(force = false) {
  if (!usuario?.id_usuario) return null;
  if (!force && walleFinancialSnapshot && (Date.now() - walleFinancialSnapshotAt) < 30000) {
    return walleFinancialSnapshot;
  }

  try {
    const [resMovimientos, resMetas] = await Promise.all([
      apiFetch(`${API_URL}/movimientos/${usuario.id_usuario}`),
      apiFetch(`${API_URL}/metas/${usuario.id_usuario}`)
    ]);

    const movimientos = await resMovimientos.json();
    const metas = await resMetas.json();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ingresos = movimientos
      .filter((item) => item.tipo === "ingreso")
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const gastos = movimientos
      .filter((item) => item.tipo === "gasto")
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const ahorroPct = ingresos > 0 ? ((ingresos - gastos) / ingresos) * 100 : 0;

    const categoryTotals = new Map();
    movimientos
      .filter((item) => item.tipo === "gasto")
      .forEach((item) => {
        const name = item.categoria || "Sin categoría";
        categoryTotals.set(name, (categoryTotals.get(name) || 0) + Number(item.monto || 0));
      });

    const categorias = Array.from(categoryTotals.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);

    const gastosMes = movimientos
      .filter((item) => item.tipo === "gasto" && item.fecha && new Date(item.fecha) >= startOfMonth)
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const ingresosMes = movimientos
      .filter((item) => item.tipo === "ingreso" && item.fecha && new Date(item.fecha) >= startOfMonth)
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);

    const metasResumen = metas.map((meta) => calcularMetaEstado(meta, movimientos));
    const principalMeta = metasResumen
      .slice()
      .sort((a, b) => b.porcentajeReal - a.porcentajeReal)[0] || null;

    walleFinancialSnapshot = {
      movimientos,
      metas,
      ingresos,
      gastos,
      ahorroPct,
      balance: ingresos - gastos,
      ingresosMes,
      gastosMes,
      categorias,
      categoriaDominante: categorias[0] || null,
      metasResumen,
      principalMeta,
      metasCount: metas.length
    };
    walleFinancialSnapshotAt = Date.now();
    return walleFinancialSnapshot;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function invalidateWalleFinancialSnapshot() {
  walleFinancialSnapshot = null;
  walleFinancialSnapshotAt = 0;
}

function getTotalKnownDebt() {
  const memory = getWalleMemory();
  return (memory.knownDebts || []).reduce((sum, debt) => sum + Number(debt.monto || 0), 0);
}

function construirPlanAccion(snapshot, profile, categoriaProblematica) {
  const plan = [];
  if (categoriaProblematica?.nombre) {
    plan.push(`1. Reduce gastos en ${categoriaProblematica.nombre}`);
  } else {
    plan.push("1. Revisa tu gasto más grande del mes");
  }
  plan.push("2. Ahorra 10% fijo apenas te entre dinero");
  if (profile === "endeudado" || profile === "riesgo") {
    plan.push("3. No uses crédito este mes");
  } else {
    plan.push("3. Mantén un fondo para imprevistos");
  }
  return `Plan rápido 👇\n${plan.join("\n")}`;
}

function buildSnapshotHealthResponse(snapshot) {
  if (!snapshot) {
    return "No pude leer tus datos ahora mismo 👀 Intenta de nuevo en un momento.";
  }

  const debtTotal = getTotalKnownDebt();
  const profile = detectarPerfil(snapshot.ingresos, snapshot.gastos, debtTotal);
  const categoriaDominante = snapshot.categoriaDominante;
  const memory = getWalleMemory();
  const alerts = [];

  if (snapshot.ahorroPct < 10 && snapshot.ingresos > 0) {
    alerts.push("Estás ahorrando muy poco ⚠️ intenta mejorar eso");
  }
  if (snapshot.gastos > snapshot.ingresos && snapshot.ingresos > 0) {
    alerts.push("Estás gastando más de lo que ganas 💸 cuidado");
  }
  if (categoriaDominante && snapshot.gastos > 0 && (categoriaDominante.total / snapshot.gastos) > 0.35) {
    alerts.push(`Estás gastando mucho en ${categoriaDominante.nombre} 👀 revisa ahí`);
  }
  if (debtTotal > snapshot.ingresos * 0.5 && snapshot.ingresos > 0) {
    alerts.push("Tu nivel de deuda es alto ⚠️ prioriza pagarlas");
  }

  const profileMessages = {
    gastador: "Tu perfil es gastador 👀 deberías controlar mejor tus salidas",
    riesgo: "Tu perfil está en riesgo financiero ⚠️ necesitas bajar gastos urgente",
    endeudado: "Tu perfil está endeudado 💸 te conviene atacar tus deudas caras primero",
    estable: "Tu perfil es estable 💚 vas bien, pero todavía puedes mejorar tu ahorro"
  };

  let result = `Hoy tus ingresos suman ${formatoCOP(snapshot.ingresos)} y tus gastos ${formatoCOP(snapshot.gastos)}. Tu ahorro va en ${porcentajeAhorro(snapshot.ahorroPct)} 💚`;
  let explanation = alerts[0] || profileMessages[profile];

  if (categoriaDominante) {
    const objetivo = Math.round(categoriaDominante.total * 0.75);
    const potencial = categoriaDominante.total - objetivo;
    const previousSignal = memory.lastProblemCategory === categoriaDominante.nombre
      ? `Sigues gastando mucho en ${categoriaDominante.nombre} 👀`
      : `Tu categoría más pesada es ${categoriaDominante.nombre} con ${formatoCOP(categoriaDominante.total)}. Podrías bajarla a ${formatoCOP(objetivo)} y liberar ${formatoCOP(potencial)} 💚`;
    explanation = `${explanation}\n${previousSignal}`;
  }

  let recommendation = construirPlanAccion(snapshot, profile, categoriaDominante);
  if (!snapshot.metasCount) {
    recommendation += "\n¿Quieres que te ayude a crear una meta de ahorro?";
  } else if (snapshot.principalMeta) {
    recommendation += `\nVas en ${snapshot.principalMeta.porcentajeReal.toFixed(1)}% de tu meta 💚 vas bien`;
  }

  saveWalleMemory({
    lastRecommendation: recommendation,
    lastProblemCategory: categoriaDominante?.nombre || memory.lastProblemCategory
  });

  return buildWalleStructuredResponse(result, explanation, recommendation);
}

async function maybeShowAutomaticWalleInsight() {
  const memory = getWalleMemory();
  if (Date.now() - Number(memory.lastInsightAt || 0) < 6 * 60 * 60 * 1000) {
    return;
  }

  const snapshot = await getWalleFinancialSnapshot();
  if (!snapshot || !snapshot.ingresos) return;

  let message = "";
  let mood = "happy";
  const categoriaDominante = snapshot.categoriaDominante;

  if (snapshot.gastos > snapshot.ingresos) {
    message = "Estás gastando más de lo que ganas 💸 cuidado con ese ritmo.";
    mood = "alert";
  } else if (snapshot.ahorroPct < 10) {
    message = "Este mes bajaste tu ahorro 😕 ¿quieres mejorarlo?";
    mood = "alert";
  } else if (categoriaDominante && snapshot.gastos > 0 && (categoriaDominante.total / snapshot.gastos) > 0.35) {
    message = `Estás gastando mucho en ${categoriaDominante.nombre} 👀 revisa ahí.`;
    mood = "guide";
  }

  if (!message) return;

  window.WalleController?.showOverlay(message, { mood, duration: 4200 });
  saveWalleMemory({
    lastInsightAt: Date.now(),
    lastProblemCategory: categoriaDominante?.nombre || memory.lastProblemCategory
  });
}

function buildRateComparisonResponse(rateEntries) {
  const sorted = rateEntries.slice().sort((a, b) => a.monthlyDecimal - b.monthlyDecimal);
  const best = sorted[0];
  return buildWalleStructuredResponse(
    `La mejor opción es ${formatWallePercent(best.percent)} ${best.period} 👀`,
    "Esa es la tasa más baja, así que pagarías menos interés en el tiempo 💸",
    "Si quieres, te comparo cuánto cambia el costo entre todas."
  );
}

function buildDebtAnalysisResponse(deudas, horizonMonths = 12) {
  const sorted = deudas
    .map((deuda) => ({
      ...deuda,
      interesEstimado: calcularCostoInteresDeuda(deuda, horizonMonths)
    }))
    .sort((a, b) => b.monthlyRate - a.monthlyRate || b.interesEstimado - a.interesEstimado);
  const target = sorted[0];
  saveWalleMemory({ knownDebts: deudas });

  return buildWalleStructuredResponse(
    `Te conviene atacar primero la deuda del ${formatWallePercent(target.tasaPercent)} ${target.period} 💸`,
    `Es la que más interés genera. En ${horizonMonths} meses esa deuda sola podría comerte aprox ${formatoCOP(target.interesEstimado)} en interés simple.`,
    "Prioriza esa deuda antes de abonar fuerte a las más baratas."
  );
}

function buildConsolidationResponse(deudas, nuevaTasaEntry, months = 12) {
  const tasasActuales = deudas.map((deuda) => deuda.monthlyRate);
  const evaluacion = evaluarConsolidacion(tasasActuales, nuevaTasaEntry.monthlyDecimal);
  const costoActual = deudas.reduce((sum, deuda) => sum + calcularInteres(deuda.monto, deuda.monthlyRate, months), 0);
  const deudaTotal = deudas.reduce((sum, deuda) => sum + deuda.monto, 0);
  const nuevoCosto = calcularInteres(deudaTotal, nuevaTasaEntry.monthlyDecimal, months);
  const ahorro = costoActual - nuevoCosto;
  const result = evaluacion.startsWith("Sí")
    ? `Sí te conviene 👀 porque pasas a ${formatWallePercent(nuevaTasaEntry.percent)} ${nuevaTasaEntry.period}`
    : `No es buena idea ⚠️ esa tasa no mejora lo suficiente`;
  const explanation = ahorro > 0
    ? `Podrías ahorrar aproximadamente ${formatoCOP(ahorro)} en intereses 💚`
    : `Con ese cambio pagarías aproximadamente ${formatoCOP(Math.abs(ahorro))} más en intereses.`;
  const recommendation = evaluacion.startsWith("Sí")
    ? "Hazlo solo si no te alargan demasiado el plazo ni te cobran costos extras."
    : "Solo tendría sentido si te bajan cuota sin subir mucho el costo total.";
  return buildWalleStructuredResponse(result, explanation, recommendation);
}

function buildCreditSimulationResponse(monto, rateEntry, meses) {
  const tasaMensual = rateEntry.period === "anual"
    ? normalizeRateToMonthly(rateEntry.decimal, "anual")
    : rateEntry.decimal;
  const cuota = calcularCuota(monto, tasaMensual, meses);
  const totalPagado = cuota * meses;
  const interesTotal = totalPagado - monto;
  return buildWalleStructuredResponse(
    `Si pides ${formatoCOP(monto)} al ${formatWallePercent(rateEntry.percent)} ${rateEntry.period} a ${meses} meses 👇\nTu cuota sería aprox: ${formatoCOP(cuota)} 💸`,
    `Terminarías pagando cerca de ${formatoCOP(interesTotal)} en intereses si mantienes esa tasa 👀`,
    "Compárala con otra tasa o intenta bajar plazo si quieres pagar menos interés total."
  );
}

function buildInterestResponse(monto, rateEntry, tiempo, compound = false) {
  const tasa = rateEntry.period === "anual" ? rateEntry.decimal : rateEntry.decimal;
  const total = compound
    ? interesCompuesto(monto, tasa, tiempo)
    : calcularInteres(monto, tasa, tiempo);
  const result = compound
    ? `Con interés compuesto, ${formatoCOP(monto)} crecería a aprox ${formatoCOP(total)} 👀`
    : `El interés simple sería aprox ${formatoCOP(total)} 👀`;
  const explanation = compound
    ? `Eso asume una tasa de ${formatWallePercent(rateEntry.percent)} ${rateEntry.period} durante ${tiempo} periodos.`
    : `Eso sale de multiplicar monto, tasa y tiempo con ${formatWallePercent(rateEntry.percent)} ${rateEntry.period}.`;
  return buildWalleStructuredResponse(
    result,
    explanation,
    "Si quieres, también te lo comparo contra interés compuesto o una cuota mensual."
  );
}

function shouldUseSnapshotAnalysis(question) {
  const normalized = normalizeWalleText(question);
  return [
    "salud financiera",
    "como voy",
    "como van mis finanzas",
    "analiza mis gastos",
    "analiza mis finanzas",
    "mis ingresos",
    "mis gastos",
    "mi ahorro",
    "mi perfil financiero",
    "que tal voy",
    "en que gasto mas",
    "en que estoy gastando",
    "que categoria me pesa",
    "mis metas",
    "balance",
    "balances",
    "valance",
    "valances",
    "mi balance",
    "balance de gastos",
    "balance gastos",
    "resumen de gastos",
    "resumen financiero",
    "como estan mis gastos",
    "como estan mis ingresos",
    "revisa mis gastos",
    "revisa mis finanzas",
    "quiero un analisis"
  ].some((term) => normalized.includes(term));
}

function parseWalleLabeledAmount(normalizedQuestion, labels) {
  const escaped = labels.map((label) => normalizeWalleText(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?:${escaped})\\D{0,28}(\\d[\\d.,]*)\\s*(millones?|millon|mill|m|palos?|palo|lucas?|luca|mil|k)?`, "i");
  const match = normalizedQuestion.match(regex);
  if (!match) return 0;
  return parseWalleAmount(match[1], match[2] || "");
}

function parseWalleDate(text) {
  const raw = String(text || "");
  const normalized = normalizeWalleText(raw);
  const iso = raw.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const slash = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const today = new Date();
  if (normalized.includes("hoy")) return fechaHoyInput();
  if (normalized.includes("manana")) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatearFechaInput(date);
  }

  const monthMap = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11
  };
  const monthName = Object.keys(monthMap).find((name) => normalized.includes(name));
  const dayMatch = normalized.match(/\b(\d{1,2})\b/);
  if (monthName && dayMatch) {
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : today.getFullYear();
    return formatearFechaInput(new Date(year, monthMap[monthName], Number(dayMatch[1])));
  }

  const months = extraerPlazoMeses(text);
  if (months) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return formatearFechaInput(date);
  }

  return "";
}

function parseWalleNameAfter(text, triggers) {
  const normalized = normalizeWalleText(text);
  for (const trigger of triggers) {
    const cleanTrigger = normalizeWalleText(trigger);
    const index = normalized.indexOf(cleanTrigger);
    if (index >= 0) {
      const after = normalized.slice(index + cleanTrigger.length).trim();
      const cleaned = after
        .replace(/\b(por|de|con|para|hasta|a|al|del|el|la|una|un|que|se llame|llamada|llamado)\b/g, " ")
        .replace(/\b\d[\d.,]*\s*(millones?|millon|mill|m|palos?|palo|lucas?|luca|mil|k)?\b/g, " ")
        .replace(/\b\d+\b/g, " ")
        .replace(/\b(hoy|manana|mañana|en|mes|meses|ano|anos|año|años|fecha|limite|límite)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned) return cleaned.slice(0, 60);
    }
  }
  return "";
}

async function fetchWalleMetasYMovimientos() {
  const [resMetas, resMovimientos] = await Promise.all([
    apiFetch(`${API_URL}/metas/${usuario.id_usuario}`),
    apiFetch(`${API_URL}/movimientos/${usuario.id_usuario}`)
  ]);
  return {
    metas: await resMetas.json(),
    movimientos: await resMovimientos.json()
  };
}

async function findWalleMetaByText(text) {
  const { metas } = await fetchWalleMetasYMovimientos();
  const normalized = normalizeWalleText(text);
  return metas.find((meta) => normalized.includes(normalizeWalleText(meta.nombre))) || null;
}

async function getWalleCategories() {
  const res = await apiFetch(`${API_URL}/categorias/${usuario.id_usuario}`);
  return res.json();
}

async function findWalleCategory(text, tipo = "") {
  const normalized = normalizeWalleText(text);
  const categories = await getWalleCategories();
  const byName = categories.find((category) => normalized.includes(normalizeWalleText(category.nombre)));
  if (byName) return byName;

  const fallbackNames = tipo === "ingreso"
    ? ["Ingresos", "Salario", "Otros ingresos"]
    : ["Otros", "General", "Compras"];
  return categories.find((category) => fallbackNames.some((name) => normalizeWalleText(category.nombre).includes(normalizeWalleText(name))))
    || categories.find((category) => !category.es_meta)
    || null;
}

function buildWalleReportSummary(snapshot) {
  if (!snapshot) return "No pude leer tus datos ahora mismo. Intenta de nuevo en un momento.";
  const categoryLine = snapshot.categoriaDominante
    ? `Tu categoria mas pesada es ${snapshot.categoriaDominante.nombre} con ${formatoCOP(snapshot.categoriaDominante.total)}.`
    : "Todavia no hay una categoria dominante clara.";
  return buildWalleStructuredResponse(
    `Tu balance general va en ${formatoCOP(snapshot.balance)}: ingresos ${formatoCOP(snapshot.ingresos)} y gastos ${formatoCOP(snapshot.gastos)}.`,
    `${categoryLine} Este mes llevas ingresos por ${formatoCOP(snapshot.ingresosMes)} y gastos por ${formatoCOP(snapshot.gastosMes)}.`,
    snapshot.balance < 0
      ? "Prioriza bajar el gasto mas repetido y evita nuevas deudas este mes."
      : "Vas con margen positivo. Puedes convertir parte de ese balance en ahorro o aporte a metas."
  );
}

async function handleWalleReportActions(question) {
  const normalized = normalizeWalleText(question);
  const wantsReportPdf = /(pdf|descarga|descargar|pasame|pasar|enviar|genera|generar).{0,40}(reporte|reportes)|(?:reporte|reportes).{0,40}(pdf|descarga|descargar|pasame|pasar|enviar|genera|generar)/.test(normalized);
  const wantsReportExcel = /(excel|csv).{0,40}(reporte|reportes)|(?:reporte|reportes).{0,40}(excel|csv)/.test(normalized);
  const wantsBalance = shouldUseSnapshotAnalysis(question);

  if (wantsReportPdf || wantsReportExcel) {
    mostrar("reportes");
    await cargarReportes();
    if (wantsReportPdf) {
      await exportarReportePDF();
      return "Listo, generé el PDF del reporte financiero. Si estás en celular, se abrirá la opción para guardarlo o compartirlo.";
    }
    await exportarReporteExcel();
    return "Listo, generé el archivo de Excel/CSV del reporte. Si estás en celular, elige dónde guardarlo o compartirlo.";
  }

  if (wantsBalance) {
    const snapshot = await getWalleFinancialSnapshot(true);
    return buildWalleReportSummary(snapshot);
  }

  return "";
}

async function handleWalleTaxActions(question) {
  const normalized = normalizeWalleText(question);
  const wantsTax = /(renta|declaracion|declarar|dian|impuesto)/.test(normalized);
  const wantsPdf = /(pdf|descarga|descargar|pasame|pasar|enviar|genera|generar|hazme|hacer)/.test(normalized);
  if (!wantsTax || !wantsPdf) return "";

  const ingresos = parseWalleLabeledAmount(normalized, ["ingresos", "ingreso", "ingresos anuales", "gane", "gano"])
    || parseNumeroInput(document.getElementById("rentaIngresos")?.value || "");
  const patrimonio = parseWalleLabeledAmount(normalized, ["patrimonio", "patrimonio bruto", "bienes"])
    || parseNumeroInput(document.getElementById("rentaPatrimonio")?.value || "");
  const deducciones = parseWalleLabeledAmount(normalized, ["deducciones", "deduccion", "deducible"])
    || parseNumeroInput(document.getElementById("rentaDeducciones")?.value || "");
  const retenciones = parseWalleLabeledAmount(normalized, ["retenciones", "retencion", "retencion practicada", "retenciones practicadas"])
    || parseNumeroInput(document.getElementById("rentaRetenciones")?.value || "");

  if (!ingresos && !patrimonio) {
    return "Sí puedo ayudarte con la simulación de renta. Pásame al menos ingresos anuales y/o patrimonio bruto; si tienes deducciones y retenciones, también inclúyelas.";
  }

  mostrar("renta");
  document.getElementById("rentaIngresos").value = formatearNumeroInput(ingresos || 0);
  document.getElementById("rentaPatrimonio").value = formatearNumeroInput(patrimonio || 0);
  document.getElementById("rentaDeducciones").value = formatearNumeroInput(deducciones || 0);
  document.getElementById("rentaRetenciones").value = formatearNumeroInput(retenciones || 0);
  simularRenta();
  await descargarRentaPDF();

  return buildWalleStructuredResponse(
    "Listo, hice la simulación de renta con los datos que me diste y generé el PDF.",
    `Usé ingresos ${formatoCOP(ingresos)}, patrimonio ${formatoCOP(patrimonio)}, deducciones ${formatoCOP(deducciones)} y retenciones ${formatoCOP(retenciones)}.`,
    "Recuerda que es una orientación y no reemplaza la revisión de un contador ni la declaración oficial ante la DIAN."
  );
}

async function handleWalleGoalActions(question) {
  const normalized = normalizeWalleText(question);
  if (!/(meta|metas|objetivo|ahorrar para|viaje|comprar)/.test(normalized)) return "";

  const isCreate = /(crea|crear|agrega|agregar|haz|hacer|nueva|nuevo)/.test(normalized);
  const isDelete = /(elimina|eliminar|borra|borrar|quita|quitar)/.test(normalized);
  const isUpdate = /(modifica|modificar|actualiza|actualizar|cambia|cambiar|edita|editar)/.test(normalized);

  if (isDelete) {
    const meta = await findWalleMetaByText(question);
    if (!meta) return "¿Cuál meta quieres eliminar? Escríbeme el nombre tal como aparece en tus metas.";
    if (!confirm(`Walle va a eliminar la meta "${meta.nombre}". ¿Quieres continuar?`)) {
      return "Listo, no eliminé la meta.";
    }
    const res = await apiFetch(`${API_URL}/metas/${meta.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return data.mensaje || "No pude eliminar esa meta.";
    invalidateWalleFinancialSnapshot();
    cargarMetas();
    cargarCategorias();
    return `Listo, eliminé la meta "${meta.nombre}".`;
  }

  if (isUpdate) {
    const meta = await findWalleMetaByText(question);
    if (!meta) return "¿Cuál meta quieres modificar? Dime el nombre de la meta.";
    const monto = extraerMonto(question) || Number(meta.monto);
    const fecha = parseWalleDate(question) || (meta.fecha_limite?.split("T")[0] || meta.fecha_limite);
    const nombre = parseWalleNameAfter(question, ["renombrar meta", "cambiar nombre", "se llame"]) || meta.nombre;
    if (!confirm(`Walle va a modificar la meta "${meta.nombre}". ¿Quieres continuar?`)) {
      return "Listo, no modifiqué la meta.";
    }
    const res = await apiFetch(`${API_URL}/metas/${meta.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, monto, fecha_limite: fecha })
    });
    const data = await res.json();
    if (!res.ok) return data.mensaje || "No pude modificar esa meta.";
    invalidateWalleFinancialSnapshot();
    cargarMetas();
    cargarCategorias();
    return `Listo, actualicé la meta "${nombre}" con monto ${formatoCOP(monto)} y fecha ${fecha}.`;
  }

  if (isCreate) {
    const monto = extraerMonto(question);
    const fecha = parseWalleDate(question);
    const nombre = parseWalleNameAfter(question, ["meta", "ahorrar para", "objetivo", "comprar"]) || "Nueva meta";
    if (!monto) return "¿De cuánto será la meta? Ejemplo: crea una meta viaje por 2 millones en 6 meses.";
    if (!fecha) return "¿Para qué fecha o en cuántos meses quieres lograr esa meta?";

    const res = await apiFetch(`${API_URL}/metas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, monto, fecha_limite: fecha })
    });
    const data = await res.json();
    if (!res.ok) return data.mensaje || "No pude crear la meta.";
    invalidateWalleFinancialSnapshot();
    cargarMetas();
    cargarCategorias();
    return `Listo, creé la meta "${nombre}" por ${formatoCOP(monto)} para el ${fecha}.`;
  }

  return "";
}

async function handleWalleMovementActions(question) {
  const normalized = normalizeWalleText(question);
  if (!/(movimiento|gasto|ingreso|compra|pago|registre|registra|agrega|agregar|elimina|eliminar|borra|modifica|actualiza)/.test(normalized)) return "";

  const isCreate = /(registra|registrar|agrega|agregar|crea|crear|anota|guardar|guarda)/.test(normalized);
  const isDelete = /(elimina|eliminar|borra|borrar|quita|quitar)/.test(normalized);
  const isUpdate = /(modifica|modificar|actualiza|actualizar|cambia|cambiar|edita|editar)/.test(normalized);

  if (isDelete) {
    const snapshot = await getWalleFinancialSnapshot(true);
    const target = (snapshot?.movimientos || []).find((movement) => {
      const haystack = normalizeWalleText(`${movement.categoria || ""} ${movement.descripcion || ""} ${movement.monto || ""}`);
      return normalized.includes(normalizeWalleText(movement.categoria || "")) || (movement.descripcion && normalized.includes(normalizeWalleText(movement.descripcion)));
    });
    if (!target) return "¿Cuál movimiento quieres eliminar? Dime categoría, descripción o monto para ubicarlo.";
    if (!confirm(`Walle va a eliminar el movimiento "${target.descripcion || target.categoria}" por ${formatoCOP(target.monto)}. ¿Continuar?`)) {
      return "Listo, no eliminé el movimiento.";
    }
    const res = await apiFetch(`${API_URL}/movimientos/${target.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return data.mensaje || "No pude eliminar ese movimiento.";
    invalidateWalleFinancialSnapshot();
    cargar();
    cargarReportes();
    cargarMetas();
    return "Listo, eliminé el movimiento.";
  }

  if (isUpdate) {
    return "Puedo ayudarte a modificar movimientos, pero necesito ubicarlo con claridad. Dime: cambia el movimiento de [categoria o descripcion] a [nuevo monto] y, si aplica, la fecha.";
  }

  if (isCreate) {
    const monto = extraerMonto(question);
    if (!monto) return "¿Por cuánto fue el movimiento? Dime el monto para registrarlo.";
    const tipo = /(ingreso|salario|sueldo|me pagaron|me entro|ganancia|venta)/.test(normalized) ? "ingreso" : "gasto";
    const category = await findWalleCategory(question, tipo);
    if (!category?.id) return "No encontré una categoría para ese movimiento. Crea o elige una categoría primero.";
    const fecha = parseWalleDate(question) || fechaHoyInput();
    const descripcion = parseWalleNameAfter(question, ["por", "de", "en", "compra", "pago"]) || (tipo === "ingreso" ? "Ingreso registrado por Walle" : "Gasto registrado por Walle");
    const res = await apiFetch(`${API_URL}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, monto, descripcion, categoria_id: category.id, fecha })
    });
    const data = await res.json();
    if (!res.ok) return data.mensaje || "No pude registrar el movimiento.";
    invalidateWalleFinancialSnapshot();
    cargar();
    cargarReportes();
    cargarMetas();
    return `Listo, registré un ${tipo} por ${formatoCOP(monto)} en ${category.nombre}.`;
  }

  return "";
}

async function getWalleActionResponse(question) {
  const handlers = [
    handleWalleTaxActions,
    handleWalleReportActions,
    handleWalleGoalActions,
    handleWalleMovementActions
  ];

  for (const handler of handlers) {
    const response = await handler(question);
    if (response) return response;
  }

  return "";
}

async function getAdvancedWalleResponse(question) {
  const normalized = normalizeWalleText(question);
  const rateEntries = extraerRateEntries(question);
  const deudas = extraerDeudas(question);
  const monto = detectarMontoPrincipal(question, deudas);
  const ingresoDetectado = extractWalleIncomeAmount(question);
  const goalAmount = extractGoalTargetAmount(question, ingresoDetectado);
  const meses = extraerPlazoMeses(question);
  const wantsCompound = normalized.includes("compuesto");
  const wantsSimple = normalized.includes("simple");
  const wantsCredit = /(credito|prestamo|pr[eé]stamo|cuota|cuotas|sistema frances)/.test(normalized);
  const wantsConsolidation = /(unir|unificar|consolidar)/.test(normalized) && normalized.includes("deuda");
  const wantsOwnData = shouldUseSnapshotAnalysis(question);
  const missingRatePeriod = rateEntries.length > 0 && rateEntries.some((entry) => !entry.explicitPeriod);
  const wantsSavingsCalculation = isSavingsContext(question);
  const wantsGoalPlan = isGoalSavingsContext(question);

  if (wantsOwnData) {
    updateWalleContext({ intent: "analisis_financiero" }, null, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    const snapshot = await getWalleFinancialSnapshot(true);
    return buildSnapshotHealthResponse(snapshot);
  }

  if (ingresoDetectado) {
    rememberWalleIncome(ingresoDetectado, question);
  }
  if (goalAmount) {
    rememberWalleGoal(goalAmount, question);
  }

  if (wantsGoalPlan) {
    const incomeContextual = ingresoDetectado || getRememberedIncome();
    const goalContextual = goalAmount || getRememberedGoalAmount();
    updateWalleContext({ intent: "meta_ahorro" }, null, {
      ...(lastTopicDetail || {}),
      incomeAmount: incomeContextual || 0,
      goalAmount: goalContextual || 0,
      question
    });
    if (!incomeContextual) {
      return "¿Cuánto ganas al mes más o menos? 👀 así te calculo cuánto exigiría esa meta";
    }
    if (!goalContextual) {
      return "¿De cuánto es la meta o el viaje que quieres lograr? 👀";
    }
    if (!meses) {
      return buildWalleStructuredResponse(
        `Con un ingreso de ${formatoCOP(incomeContextual)} y una meta de ${formatoCOP(goalContextual)} 👀`,
        "Sí te lo puedo calcular, pero me falta el plazo para decirte cuánto ahorrar al mes y qué porcentaje te exige.",
        "¿En cuántos meses quieres lograr esa meta?"
      );
    }
    return buildGoalSavingsNeedResponse(incomeContextual, goalContextual, meses);
  }

  if (wantsSavingsCalculation) {
    const ingresoContextual = ingresoDetectado || getRememberedIncome();
    updateWalleContext({ intent: "ahorro" }, { intent: "cuanto_ahorrar_dinero" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoContextual || 0,
      question
    });
    if (!ingresoContextual) {
      return "¿Cuánto ganas más o menos? 👀 así te ayudo mejor";
    }
    const savingsResponse = buildSavingsAmountResponse(ingresoContextual);
    saveWalleMemory({
      lastRecommendation: savingsResponse
    });
    return savingsResponse;
  }

  if (lastIntent?.intent === "ahorro" && ingresoDetectado) {
    updateWalleContext(lastIntent, { intent: "cuanto_ahorrar_dinero" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado,
      question
    });
    return buildSavingsAmountResponse(ingresoDetectado);
  }

  if (wantsCredit) {
    updateWalleContext({ intent: "credito" }, null, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    if (!monto) return "¿Cuánto quieres pedir en el crédito? 👀";
    if (!rateEntries.length) return "¿A qué tasa te lo ofrecen? 👀";
    if (missingRatePeriod) return "¿Esa tasa es mensual o anual? 👀";
    if (!meses) return "¿A cuántos meses quieres el crédito? 👀";
    return buildCreditSimulationResponse(monto, rateEntries[0], meses);
  }

  if (wantsConsolidation) {
    updateWalleContext({ intent: "deudas" }, { intent: "unificar_deudas" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    const memoryDebts = getWalleMemory().knownDebts || [];
    const currentDebts = deudas.length > 1 ? deudas.slice(0, -1) : memoryDebts;
    const nuevaTasa = rateEntries[rateEntries.length - 1];
    if (!currentDebts.length) {
      return "Pásame tus deudas actuales con monto y tasa para comparar la consolidación 👀";
    }
    if (!nuevaTasa) {
      return "¿Cuál sería la nueva tasa de la deuda unificada? 👀";
    }
    if (missingRatePeriod || currentDebts.some((deuda) => !deuda.explicitPeriod)) {
      return "¿Esas tasas son mensuales o anuales? 👀";
    }
    return buildConsolidationResponse(currentDebts, nuevaTasa, meses || 12);
  }

  if (deudas.length >= 2) {
    updateWalleContext({ intent: "deudas" }, { intent: "muchas_deudas" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    if (deudas.some((deuda) => !deuda.explicitPeriod)) {
      return "¿Esas tasas son mensuales o anuales? 👀";
    }
    return buildDebtAnalysisResponse(deudas, meses || 12);
  }

  if (rateEntries.length >= 2) {
    updateWalleContext({ intent: "deudas" }, { intent: "deudas_con_intereses" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    if (missingRatePeriod) return "¿Esas tasas son mensuales o anuales? 👀";
    return buildRateComparisonResponse(rateEntries);
  }

  if ((wantsSimple || wantsCompound) && monto && rateEntries.length) {
    updateWalleContext({ intent: wantsCompound ? "interes_compuesto" : "interes_simple" }, null, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    if (missingRatePeriod) return "¿Esa tasa es mensual o anual? 👀";
    if (!meses && !/ano|año|anos|años|mes|meses/.test(normalized)) {
      return "¿En cuántos meses o años quieres calcularlo? 👀";
    }
    const tiempo = meses || 1;
    return buildInterestResponse(monto, rateEntries[0], tiempo, wantsCompound);
  }

  if (/deuda|debo|credito|prestamo/.test(normalized) && deudas.length === 1) {
    updateWalleContext({ intent: "deudas" }, { intent: "deudas_con_intereses" }, {
      ...(lastTopicDetail || {}),
      incomeAmount: ingresoDetectado || getRememberedIncome(),
      question
    });
    saveWalleMemory({ knownDebts: deudas });
    return buildWalleStructuredResponse(
      `Registré tu deuda de ${deudas[0].label} 👀`,
      "Con eso ya te puedo ayudar a compararla con otras, estimar interés o revisar una consolidación.",
      "Si tienes otra deuda, escríbemela con monto y tasa y te digo cuál te conviene pagar primero."
    );
  }

  return "";
}

function buildWalleKnowledgeResponse(question) {
  const normalized = normalizeWalleText(question);

  const knowledgeRules = [
    {
      test: /(que puedes hacer|que sabes hacer|ayuda|ayudame|como funcionas|para que sirves)/,
      intent: "ayuda_app",
      response: [
        "Puedo ayudarte con tres cosas: responder dudas financieras, hacer calculos con tus datos y moverme por la app.",
        "Por ejemplo: registra un gasto de 20 mil en comida, crea una meta de viaje por 2 millones, genera mi reporte en PDF, analiza mis gastos o calcula una cuota de credito.",
        "Tambien puedo seguir el hilo si me das ingreso, deudas, tasas o metas."
      ].join("\n")
    },
    {
      test: /(como registro|registrar|agregar|anotar).{0,35}(gasto|ingreso|movimiento)|(?:gasto|ingreso|movimiento).{0,35}(como registro|registrar|agregar|anotar)/,
      intent: "movimientos",
      response: [
        "Para registrar un movimiento puedes usar el boton + o pedirmelo directo.",
        "Ejemplo: registra un gasto de 25000 en transporte hoy, o agrega un ingreso de 1 millon por salario.",
        "Si no encuentro la categoria, te aviso para que la crees o la elijas."
      ].join("\n")
    },
    {
      test: /(categoria|categorias|crear categoria|nueva categoria|organizar categorias)/,
      intent: "categorias",
      response: [
        "Las categorias sirven para que tus reportes sean mas claros.",
        "Puedes usar las principales o crear una propia desde Perfil > Gestionar categorias.",
        "Para que Walle acierte mejor, usa nombres concretos como comida, transporte, arriendo, servicios, deudas o ahorro."
      ].join("\n")
    },
    {
      test: /(reporte|reportes|grafica|graficas|balance|resumen).{0,35}(como|ver|mostrar|sirve|funciona)|(?:como|ver|mostrar).{0,35}(reporte|reportes|balance|resumen)/,
      intent: "reportes",
      response: [
        "En Reportes ves ingresos, gastos, balance y categorias que mas pesan.",
        "Si me pides analiza mis finanzas, uso tus movimientos recientes para decirte donde hay fugas y que podria mejorar.",
        "Tambien puedes pedirme genera mi reporte en PDF o en Excel."
      ].join("\n")
    },
    {
      test: /(meta|metas|objetivo).{0,35}(como|crear|funciona|sirve|ahorro)|(?:crear|hacer).{0,35}(meta|objetivo)/,
      intent: "metas",
      response: [
        "Las metas son para separar objetivos concretos: viaje, estudio, emergencia o una compra grande.",
        "Puedes crear una meta manualmente o decirme algo como: crea una meta viaje por 2 millones en 6 meses.",
        "Si me das ingreso, monto y plazo, te calculo cuanto tendrias que guardar al mes."
      ].join("\n")
    },
    {
      test: /(renta|dian|declaracion|declarar|impuesto).{0,40}(como|sirve|funciona|calcula|simula)/,
      intent: "renta",
      response: [
        "La seccion de Renta es una simulacion orientativa para Colombia.",
        "Usa ingresos anuales, patrimonio, deducciones y retenciones para darte una aproximacion.",
        "No reemplaza a un contador, pero te ayuda a saber si debes revisar el tema con mas calma."
      ].join("\n")
    },
    {
      test: /(seguridad|pin|huella|recordarme|sesion|contraseña|contrasena)/,
      intent: "seguridad",
      response: [
        "En seguridad puedes cambiar tu PIN y cuidar el acceso a la cuenta.",
        "Si activas Recordar correo en el login, la app solo guarda tu correo en este dispositivo.",
        "Por seguridad, tu PIN no se guarda y tendras que escribirlo al ingresar."
      ].join("\n")
    },
    {
      test: /(gracias|muchas gracias|super|listo|ok gracias)/,
      intent: "cortesia",
      response: "Con gusto. Cuando quieras seguimos con tus gastos, metas, deudas o reportes."
    }
  ];

  const match = knowledgeRules.find((rule) => rule.test.test(normalized));
  if (!match) return "";

  updateWalleContext({ intent: match.intent }, null, {
    ...(lastTopicDetail || {}),
    question
  });
  saveWalleMemory({
    lastRecommendation: match.response,
    lastProblemCategory: match.intent
  });
  return match.response;
}

function buildWalleReply(baseResponse, intent, subintent = null) {
  const followUp = getWalleFollowUp(intent?.intent, subintent?.intent);
  return followUp ? `${baseResponse}\n\n${followUp}` : baseResponse;
}

async function getWalleResponse(question) {
  const normalizedQuestion = normalizeWalleText(question);
  if (!normalizedQuestion) {
    return tx("walleGreeting");
  }

  const actionResponse = await getWalleActionResponse(question);
  if (actionResponse) {
    return actionResponse;
  }

  const engineResponse = processWalleWithEngine(question);
  if (engineResponse) {
    return engineResponse;
  }

  const confirmationResponse = buildWalleConfirmationResponse(question);
  if (confirmationResponse) {
    return confirmationResponse;
  }

  const advancedResponse = await getAdvancedWalleResponse(question);
  if (advancedResponse) {
    return advancedResponse;
  }

  const knowledgeResponse = buildWalleKnowledgeResponse(question);
  if (knowledgeResponse) {
    return knowledgeResponse;
  }

  const historyResponse = buildWalleHistoryDrivenResponse(question);
  if (historyResponse) {
    return historyResponse;
  }

  const detectedAmount = extractWalleIncomeAmount(question);
  if (detectedAmount) {
    rememberWalleIncome(detectedAmount, question);
  }

  const contextualResponse = buildContextualWalleResponse(question);
  if (contextualResponse) {
    walleConversationState.followUpDepth += 1;
    return contextualResponse;
  }

  const detected = detectWalleIntent(normalizedQuestion);
  const detectedFromSubintent = detectWalleIntentFromSubintents(normalizedQuestion);
  const contextualIntent = !detected && !detectedFromSubintent && lastIntent && isWalleContextualQuestion(normalizedQuestion) ? lastIntent : null;
  const contextualSubintent = !detectedFromSubintent && contextualIntent && lastSubintent && isWalleContextualQuestion(normalizedQuestion)
    ? lastSubintent
    : null;

  const resolvedIntent = detected?.intent || detectedFromSubintent?.intent || contextualIntent;
  if (!resolvedIntent) {
    const nearbyIntent = detectNearbyWalleIntent(normalizedQuestion)?.intent || lastIntent;
    if (nearbyIntent) {
      return getWalleGeneralOrientation(nearbyIntent);
    }
    return tx("walleUnknown");
  }

  const resolvedSubintent = detectWalleSubintent(normalizedQuestion, resolvedIntent)?.subintent
    || detectedFromSubintent?.subintent
    || contextualSubintent
    || null;

  const ambiguityMatch = (resolvedIntent.ambiguity || []).some((variant) =>
    keywordMatchesQuestion(normalizedQuestion, variant)
  );
  const howQuestion = isHowQuestion(question);

  if (resolvedSubintent) {
    const inferredIncome = extractWalleIncomeAmount(question);
    updateWalleContext(resolvedIntent, resolvedSubintent, {
      incomeAmount: inferredIncome || lastTopicDetail?.incomeAmount || 0,
      question
    });
    walleConversationState.followUpDepth = 1;
    return buildWalleReply(getRandomResponse(resolvedSubintent), resolvedIntent, resolvedSubintent);
  }

  if (howQuestion) {
    const stepByStepSubintent = (resolvedIntent.subintents || []).find((subintent) =>
      ["organizar_gastos", "reducir_gastos", "pagar_deudas", "ingresos_extra"].includes(subintent.intent)
    );

    if (stepByStepSubintent) {
      updateWalleContext(resolvedIntent, stepByStepSubintent, { question });
      walleConversationState.followUpDepth = 1;
      return buildWalleReply(getRandomResponse(stepByStepSubintent), resolvedIntent, stepByStepSubintent);
    }
  }

  if (resolvedIntent.intent === "saludo") {
    updateWalleContext(resolvedIntent, null, { question });
    walleConversationState.followUpDepth = 0;
    return buildGreetingResponse(getRandomResponse(resolvedIntent), normalizedQuestion);
  }

  if (ambiguityMatch && resolvedIntent.clarification) {
    updateWalleContext(resolvedIntent, null, {
      ...(lastTopicDetail || {}),
      incomeAmount: detectedAmount || getRememberedIncome(),
      question
    });
    if (resolvedIntent.intent === "ahorro") {
      return "¿Cuánto ganas más o menos? 👀";
    }
    return resolvedIntent.clarification;
  }

  const isShortQuestion = tokenizeWalleText(normalizedQuestion).length <= 3;
  if (isShortQuestion && detected?.intent && resolvedIntent.clarification) {
    updateWalleContext(resolvedIntent, null, { question });
    return resolvedIntent.clarification;
  }

  updateWalleContext(resolvedIntent, null, { question });
  if (resolvedIntent.intent === "ahorro" && !detectedAmount && !getRememberedIncome() && tokenizeWalleText(normalizedQuestion).length <= 2) {
    return "¿Cuánto ganas más o menos? 👀";
  }
  walleConversationState.followUpDepth = 1;
  return buildWalleReply(getRandomResponse(resolvedIntent), resolvedIntent, null);
}

function appendWalleChatMessage(role, message) {
  const container = document.getElementById("walleChatMessages");
  if (!container) return;

  const row = document.createElement("div");
  row.className = `walle-chat-row ${role}`;

  if (role === "bot") {
    const avatar = document.createElement("img");
    avatar.className = "walle-chat-mini";
    avatar.src = "assets/walle-happy.svg";
    avatar.alt = "Walle";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "walle-chat-bubble";
  bubble.textContent = message;
  row.appendChild(bubble);

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function getWalleGuidedModuleFromText(text) {
  const normalized = normalizeWalleText(text);
  if (!normalized) return null;

  return Object.entries(WALLE_GUIDED_MODULES).find(([, module]) =>
    module.aliases.some((alias) => normalized === normalizeWalleText(alias))
  )?.[0] || null;
}

function getWalleGuidedResult(question) {
  const normalized = normalizeWalleText(question);
  const currentModule = walleConversationState.guidedModule;

  if (["menu", "menú", "inicio", "volver", "temas"].includes(normalized) || isPureGreeting(normalized)) {
    walleConversationState.guidedModule = "";
    return { response: tx("walleGreeting"), prompt: "", action: null };
  }

  if (currentModule && /^\d$/.test(normalized)) {
    const selected = WALLE_GUIDED_MODULES[currentModule]?.buttons?.find((item) => item.number === normalized);
    if (!selected) {
      return { response: "Esa opción no está disponible en este menú.", prompt: "", action: null };
    }
    walleConversationState.guidedModule = "";
    return {
      response: "",
      prompt: selected.prompt || "",
      action: selected.action || null
    };
  }

  const moduleKey = getWalleGuidedModuleFromText(question);
  if (!moduleKey) return { response: "", prompt: "", action: null };

  walleConversationState.guidedModule = moduleKey;
  return { response: WALLE_GUIDED_MODULES[moduleKey].response, prompt: "", action: null };
}

function executeWalleGuidedAction(action) {
  if (!action?.type) return "No pude abrir esa opción. Intenta de nuevo.";

  if (action.type === "open_goal") {
    setTimeout(() => {
      cerrarModalGenerico("modalWalleChat");
      mostrar("metas");
      abrirModalMeta();
    }, 320);
    return "Abrí el formulario de meta. Completa nombre, monto y fecha para guardarla.";
  }

  if (action.type === "open_movement") {
    setTimeout(() => {
      cerrarModalGenerico("modalWalleChat");
      abrirModal();
      const typeSelect = document.getElementById("tipo");
      if (typeSelect) typeSelect.value = action.movementType === "ingreso" ? "ingreso" : "gasto";
      actualizarTipoSegunCategoria();
    }, 320);
    return action.movementType === "ingreso"
      ? "Abrí el formulario de ingreso. Elige categoría, monto, fecha y descripción."
      : "Abrí el formulario de gasto. Elige categoría, monto, fecha y descripción.";
  }

  if (action.type === "open_categories") {
    setTimeout(() => {
      cerrarModalGenerico("modalWalleChat");
      abrirCategorias();
    }, 320);
    return "Abrí la gestión de categorías para que puedas crear o revisar las tuyas.";
  }

  return "No pude abrir esa opción. Intenta de nuevo.";
}

function getWalleQuickActionItems(moduleKey = "") {
  const module = moduleKey ? WALLE_GUIDED_MODULES[moduleKey] : null;
  if (!module?.buttons?.length) {
    return WALLE_QUICK_PROMPTS.map((item) => ({
      ...item,
      prompt: item.prompt
    }));
  }

  return [
    ...module.buttons.map((item) => ({
      ...item,
      prompt: item.number
    })),
    { number: "↩", label: "Menú", prompt: "menu" }
  ];
}

function appendWalleGuidedOptions(moduleKey = "") {
  const container = document.getElementById("walleChatMessages");
  if (!container) return;
  container.querySelectorAll(".walle-chat-options-row").forEach((row) => row.remove());

  const row = document.createElement("div");
  row.className = "walle-chat-row bot walle-chat-options-row";

  const avatar = document.createElement("img");
  avatar.className = "walle-chat-mini";
  avatar.src = "assets/walle-happy.svg";
  avatar.alt = "Walle";
  row.appendChild(avatar);

  const options = document.createElement("div");
  options.className = "walle-chat-options";

  getWalleQuickActionItems(moduleKey).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.number === "↩" ? `↩ ${item.label}` : `${item.number}. ${item.label}`;
    button.title = item.label;
    button.addEventListener("click", () => enviarPreguntaWalleDesdeTexto(item.prompt, item.label));
    options.appendChild(button);
  });

  row.appendChild(options);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function abrirChatWalle() {
  const messages = document.getElementById("walleChatMessages");
  const input = document.getElementById("walleQuestionInput");
  if (messages && !messages.dataset.initialized) {
    messages.innerHTML = "";
    const history = getWalleHistory();
    walleConversationState.messages = history;
    if (history.length) {
      history.forEach((entry) => appendWalleChatMessage(entry.role, entry.message));
    } else {
      appendWalleChatMessage("bot", tx("walleGreeting"));
      appendWalleGuidedOptions();
      saveWalleHistoryEntry("bot", tx("walleGreeting"), { intent: "saludo" });
    }
    appendWalleGuidedOptions(walleConversationState.guidedModule);
    messages.dataset.initialized = "1";
  }

  openModal("modalWalleChat");
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 60);
  }
}

function enviarPreguntaWalleDesdeTexto(question, displayText = "") {
  const input = document.getElementById("walleQuestionInput");
  const normalizedQuestion = String(question || "").trim();
  const visibleQuestion = String(displayText || normalizedQuestion).trim();
  if (!normalizedQuestion) return;

  appendWalleChatMessage("user", visibleQuestion);
  saveWalleHistoryEntry("user", visibleQuestion, {
    intent: lastIntent?.intent || null,
    subintent: lastSubintent?.intent || null,
    incomeAmount: extractWalleIncomeAmount(normalizedQuestion) || getRememberedIncome()
  });
  if (input) input.value = "";

  setTimeout(async () => {
    const guidedResult = getWalleGuidedResult(normalizedQuestion);
    const effectiveQuestion = guidedResult.prompt || normalizedQuestion;
    const rawResponse = guidedResult.action
      ? executeWalleGuidedAction(guidedResult.action)
      : guidedResult.response || await getWalleResponse(effectiveQuestion);
    const response = finalizeWalleOutgoingResponse(effectiveQuestion, rawResponse);
    appendWalleChatMessage("bot", response);
    if (!guidedResult.action) {
      appendWalleGuidedOptions(walleConversationState.guidedModule);
    }
    saveWalleHistoryEntry("bot", response, {
      intent: lastIntent?.intent || null,
      subintent: lastSubintent?.intent || null,
      incomeAmount: getRememberedIncome()
    });
  }, 220);
}

function enviarPreguntaWalle(event) {
  event.preventDefault();
  const input = document.getElementById("walleQuestionInput");
  enviarPreguntaWalleDesdeTexto(input?.value.trim());
}

function setupWalleChatModal() {
  const modal = document.getElementById("modalWalleChat");
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  if (!modal.dataset.boundBackdrop) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        cerrarModalGenerico("modalWalleChat");
      }
    });
    modal.dataset.boundBackdrop = "1";
  }
}

function setupGlobalModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("modal-overlay");

    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }

    if (!modal.dataset.boundBackdrop) {
      modal.addEventListener("click", (event) => {
        if (modal.dataset.required === "true") {
          return;
        }
        if (event.target === modal) {
          cerrarModalGenerico(modal.id);
        }
      });
      modal.dataset.boundBackdrop = "1";
    }
  });
}

function localeForLanguage(language) {
  if (language === "en") return "en-US";
  if (language === "pt") return "pt-BR";
  return "es-CO";
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-mode", isLight);
  document.body.classList.toggle("theme-light", isLight);
  chartTextColor = getComputedStyle(document.body).getPropertyValue("--text-primary").trim() || (isLight ? "#0f172a" : "#ffffff");
}

function showBanner(id, message) {
  const banner = document.getElementById(id);
  if (!banner) return;
  banner.textContent = message;
  banner.style.display = "block";
  clearTimeout(banner._timeoutId);
  banner._timeoutId = setTimeout(() => {
    banner.style.display = "none";
  }, 3000);
}

function showToast(message, type = "info", duration = 3200) {
  const toast = document.getElementById("appToast");
  if (!toast || !message) return;
  toast.textContent = message;
  toast.className = `app-toast ${type}`;
  toast.hidden = false;
  clearTimeout(toast._timeoutId);
  toast._timeoutId = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function renderEmptyState(title, body) {
  return `
    <div class="empty-state">
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}

function renderLoadingState(message) {
  return `<div class="loading-state">${message}</div>`;
}

function isScreenActive(id) {
  return document.getElementById(id)?.classList.contains("activa");
}

function syncBodyModalState() {
  const hasOpenModal = Array.from(document.querySelectorAll(".modal")).some((modal) => (
    modal.style.display === "flex" || modal.classList.contains("is-open")
  ));
  document.body.classList.toggle("modal-open", hasOpenModal);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  if (id === "modalWalleChat") {
    setupWalleChatModal();
    modal.classList.add("is-open");
  }

  modal.style.display = "flex";
  syncBodyModalState();
}

function cerrarModalGenerico(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.style.display = "none";
  modal.classList.remove("is-open");
  syncBodyModalState();
}

function updateNotificationSummary() {
  const summary = document.getElementById("notificacionesResumen");
  if (!summary) return;
  const prefs = {
    metas: document.getElementById("notifMetas")?.checked,
    resumen: document.getElementById("notifResumen")?.checked,
    seguridad: document.getElementById("notifSeguridad")?.checked
  };
  const active = Object.values(prefs).filter(Boolean).length;
  summary.textContent = active === 3
    ? tx("notificationsSummaryAll")
    : tx("notificationsSummarySome", { count: active });
}

function applyLanguage() {
  const config = getConfig();
  const texts = currentText();
  localeActual = localeForLanguage(config.language);
  document.documentElement.lang = config.language;
  document.title = "Dinamicash Wallet";

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("loaderText", texts.loaderStatus);
  setText("loaderLabel", texts.loaderLabel);
  const loaderMessages = getWalleLoaderMessages();
  window.WalleController?.updateLoader(loaderMessages[0] || texts.loader);
  setText("fabWalleText", texts.askWalle);
  setText("walleChatTitle", texts.walleChatTitle);
  setText("walleChatSubtitle", texts.walleChatSubtitle);
  setText("walleSendBtn", texts.walleSend);
  setText("btnUltimos30Inicio", texts.ultimo30);
  setText("btnUltimos30Reportes", texts.ultimo30);
  setText("btnNuevoMovimiento", texts.nuevoMovimiento);
  setText("optFiltroTodos", texts.all);
  setText("optFiltroReportesTodos", texts.all);
  setText("optFiltroIngresos", texts.income);
  setText("optFiltroReportesIngresos", texts.income);
  setText("optFiltroGastos", texts.expense);
  setText("optFiltroReportesGastos", texts.expense);
  setText("navInicio", texts.home);
  setText("navReportes", texts.reports);
  setText("navMetas", texts.goals);
  setText("navRenta", texts.tax);
  setText("navPerfil", texts.profile);
  setText("tituloReportes", texts.reportsTitle);
  setText("tituloMetas", texts.goalsTitle);
  setText("tituloRenta", texts.taxTitle);
  setText("tituloPerfil", texts.profileTitle);
  setText("tituloGastosCategoria", texts.categoryExpensesTitle);
  setText("tituloTopCategorias", texts.topCategoriesTitle);
  setText("perfilConfigTitulo", texts.settings);
  setText("perfilConfigTexto", texts.profileConfigText);
  setText("perfilEditarTexto", texts.profileEditText);
  setText("perfilNotificacionesTexto", texts.profileNotificationsText);
  setText("perfilSeguridadTexto", texts.profileSecurityText);
  setText("perfilAyudaTexto", texts.profileHelpText);
  setText("perfilCategoriasTitulo", texts.customCategories);
  setText("perfilCategoriasTexto", texts.customCategoriesText);
  setText("modalMovimientoTitulo", texts.movement);
  setText("btnGuardarMovimiento", texts.save);
  setText("btnNuevaCategoriaMovimiento", texts.newCategory);
  setText("btnCancelarMovimiento", texts.cancel);
  setText("tipoIngreso", texts.incomeOption);
  setText("tipoGasto", texts.expenseOption);
  setText("btnCrearCategoria", texts.save);
  setText("btnCerrarCategorias", texts.close);
  setText("perfilEditarTitulo", texts.editProfile);
  setText("perfilNotificacionesTitulo", texts.notifications);
  setText("perfilSeguridadTitulo", texts.security);
  setText("perfilAyudaTitulo", texts.help);
  setText("perfilCategoriasBtn", texts.manageCategories);
  setText("perfilLogoutBtn", texts.logout);
  setText("progresoTotalLabel", texts.progressTotal);
  setText("resultadoRentaTitulo", texts.resultEstimated);
  setText("rentaCardTitle", texts.simpleSimulator);
  setText("rentaCardNote", texts.taxNote);
  setText("rentaIngresosLabel", texts.annualIncome);
  setText("rentaPatrimonioLabel", texts.grossAssets);
  setText("rentaDeduccionesLabel", texts.estimatedDeductions);
  setText("rentaRetencionesLabel", texts.withholdings);
  setText("btnSimularRenta", texts.simulate);
  setText("btnDescargarRenta", texts.downloadPdf);
  setText("rentaBaseLabel", texts.estimatedBase);
  setText("rentaImpuestoLabel", texts.estimatedTax);
  setText("rentaSaldoLabel", texts.estimatedBalance);
  setText("rentaGuiaTitulo", texts.taxGuide);
  setText("modalEditarPerfilTitulo", texts.editProfile);
  setText("textoEditarPerfil", texts.editProfileText);
  setText("btnGuardarPerfil", texts.saveChanges);
  setText("btnCancelarPerfil", texts.cancel);
  setText("modalNotificacionesTitulo", texts.notifications);
  setText("notifRecordatoriosTitulo", texts.goalReminders);
  setText("notifRecordatoriosTexto", texts.goalRemindersText);
  setText("notifResumenTitulo", texts.weeklySummary);
  setText("notifResumenTexto", texts.weeklySummaryText);
  setText("notifSeguridadTitulo", texts.securityAlerts);
  setText("notifSeguridadTexto", texts.securityAlertsText);
  setText("btnGuardarNotificaciones", texts.savePreferences);
  setText("btnCerrarNotificaciones", texts.close);
  setText("modalSeguridadTitulo", texts.security);
  setText("seguridadTexto", texts.securityNote);
  setText("btnGuardarSeguridad", texts.updatePin);
  setText("btnCancelarSeguridad", texts.cancel);
  setText("modalConfiguracionTitulo", texts.settings);
  setText("configTemaTitulo", texts.theme);
  setText("configTemaTexto", texts.themeText);
  setText("configIdiomaTitulo", texts.language);
  setText("configIdiomaTexto", texts.languageText);
  setText("configApiTitulo", texts.mobileServer);
  setText("configApiTexto", texts.mobileServerText);
  setText("btnGuardarConfiguracion", texts.saveSettings);
  setText("btnCancelarConfiguracion", texts.cancel);
  setText("modalAyudaTitulo", texts.help);
  setText("btnEnviarAyuda", texts.sendRequest);
  setText("btnCancelarAyuda", texts.cancel);
  const walleQuestionInput = document.getElementById("walleQuestionInput");
  if (walleQuestionInput) {
    walleQuestionInput.placeholder = texts.wallePlaceholder;
  }

  const quickConfig = document.getElementById("quickConfigFab");
  const tourFab = document.getElementById("tourFab");
  const helpFab = document.getElementById("helpFab");
  if (quickConfig) quickConfig.setAttribute("aria-label", texts.configQuickAria);
  if (tourFab) tourFab.setAttribute("aria-label", texts.tourAria);
  if (helpFab) helpFab.setAttribute("aria-label", texts.helpAria);

  updateNotificationSummary();

  if (onboardingState.active) {
    onboardingState.steps = onboardingText().steps;
    renderOnboardingStep();
  }
}

function applyPreferences() {
  const config = getConfig();
  localStorage.setItem(STORAGE_KEYS.appLanguage, config.language);
  localeActual = localeForLanguage(config.language);
  applyTheme(config.theme);
  applyLanguage();
  const themeSelect = document.getElementById("configTema");
  const languageSelect = document.getElementById("configIdioma");
  if (themeSelect) themeSelect.value = config.theme;
  if (languageSelect) languageSelect.value = config.language;
}

function formatoCOP(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor) || 0);
}

function formatearNumeroInput(valor) {
  const limpio = String(valor || "").replace(/\D/g, "");
  if (!limpio) {
    return "";
  }
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(limpio));
}

function parseNumeroInput(valor) {
  const limpio = String(valor || "").replace(/\D/g, "");
  return limpio ? Number(limpio) : 0;
}

function configurarEntradasMoneda() {
  document.querySelectorAll(".entrada-moneda").forEach((input) => {
    input.addEventListener("input", (event) => {
      event.target.value = formatearNumeroInput(event.target.value);
    });
    input.addEventListener("focus", () => {
      setTimeout(() => {
        try {
          input.setSelectionRange(input.value.length, input.value.length);
        } catch (error) {
          // Some Android keyboards do not expose selection APIs for numeric inputs.
        }
      }, 0);
    });
  });
}

function poblarSelectorIconos() {
  const select = document.getElementById("iconoCategoria");
  if (!select) {
    return;
  }

  select.innerHTML = "";
  ICONOS_CATEGORIA.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.icono;
    option.textContent = `${item.icono} ${item.nombre}`;
    select.appendChild(option);
  });
}

function mostrarConsejoAleatorio() {
  const tip = document.getElementById("loaderTip");
  if (!tip) {
    return;
  }
  const indice = Math.floor(Math.random() * consejosFinancieros.length);
  tip.textContent = consejosFinancieros[indice];
}

function mostrarMensajeCargaWalleAleatorio() {
  const mensajes = getWalleLoaderMessages();
  if (!mensajes.length) return;
  const indice = Math.floor(Math.random() * mensajes.length);
  window.WalleController?.updateLoader(mensajes[indice]);
}

function formatearFechaInput(date) {
  return date.toISOString().split("T")[0];
}

function fechaHoyInput() {
  return formatearFechaInput(new Date());
}

function obtenerClaveFecha(valor) {
  if (!valor) {
    return "";
  }

  const texto = String(valor);
  if (texto.includes("T")) {
    return texto.split("T")[0];
  }

  return texto.slice(0, 10);
}

function obtenerIniciales(nombre) {
  const partes = String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (partes.length === 0) {
    return "U";
  }

  return partes.map((parte) => parte[0].toUpperCase()).join("");
}

function configurarPerfil() {
  const nombre = usuario?.nombre || "Usuario";
  const correo = usuario?.correo || "Sin correo";

  const avatar = document.getElementById("perfilAvatar");
  const nombreEl = document.getElementById("perfilNombre");
  const correoEl = document.getElementById("perfilCorreo");

  if (avatar) avatar.textContent = obtenerIniciales(nombre);
  if (nombreEl) nombreEl.textContent = nombre;
  if (correoEl) correoEl.textContent = correo;
}

function actualizarResumenPerfil({ totalTransacciones, totalMetas, diasActivos }) {
  const transaccionesEl = document.getElementById("perfilTransacciones");
  const metasEl = document.getElementById("perfilMetas");
  const diasEl = document.getElementById("perfilDiasActivos");

  if (transaccionesEl && Number.isFinite(totalTransacciones)) {
    transaccionesEl.textContent = totalTransacciones;
  }

  if (metasEl && Number.isFinite(totalMetas)) {
    metasEl.textContent = totalMetas;
  }

  if (diasEl && Number.isFinite(diasActivos)) {
    diasEl.textContent = diasActivos;
  }
}

function aplicarUltimos30Dias() {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(hoy.getDate() - 30);
  document.getElementById("fechaInicio").value = formatearFechaInput(desde);
  document.getElementById("fechaFin").value = formatearFechaInput(hoy);
  cargar();
}

function aplicarUltimos30DiasReportes() {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(hoy.getDate() - 30);
  document.getElementById("fechaInicioReportes").value = formatearFechaInput(desde);
  document.getElementById("fechaFinReportes").value = formatearFechaInput(hoy);
  document.getElementById("filtroMesReportes").value = "";
  document.getElementById("filtroAnioReportes").value = "";
  cargarReportes();
}

function sincronizarFiltrosReportesMes() {
  const mes = document.getElementById("filtroMesReportes").value;
  const anio = document.getElementById("filtroAnioReportes").value;
  if (mes && anio) {
    document.getElementById("fechaInicioReportes").value = "";
    document.getElementById("fechaFinReportes").value = "";
  }
}

function limpiarFiltrosMesSiHayRango() {
  const desde = document.getElementById("fechaInicioReportes").value;
  const hasta = document.getElementById("fechaFinReportes").value;
  if (desde || hasta) {
    document.getElementById("filtroMesReportes").value = "";
    document.getElementById("filtroAnioReportes").value = "";
  }
}

function setupCriticalMobileActions() {
  const actions = {
    btnNuevoMovimiento: () => abrirModal(),
    btnSimularRenta: () => simularRenta(),
    btnDescargarRenta: () => descargarRentaPDF(),
    btnExportarReportePDF: () => exportarReportePDF(),
    btnExportarReporteExcel: () => exportarReporteExcel(),
    perfilCategoriasBtn: () => abrirCategorias(),
    perfilLogoutBtn: () => logout()
  };

  const menuTargets = new Set(["inicio", "reportes", "metas", "renta", "perfil"]);
  const profileActions = {
    editar: () => editarPerfil(),
    notificaciones: () => verNotificaciones(),
    seguridad: () => verSeguridad(),
    configuracion: () => abrirConfiguracion(),
    ayuda: () => ayuda()
  };

  document.addEventListener("click", (event) => {
    const menuItem = event.target.closest?.(".menu-item[data-target]");
    if (menuItem && menuTargets.has(menuItem.dataset.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (onboardingState.active) cerrarGuiaUsuario(true);
      mostrar(menuItem.dataset.target);
      return;
    }

    const button = event.target.closest?.("button");
    if (!button) return;

    const fabMenu = button.closest("#fabMenu");
    const fabStack = document.getElementById("fabStack");
    if (fabMenu && !fabStack?.classList.contains("open")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const helpTarget = button.dataset?.helpTarget;
    if (helpTarget) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleAyudaCampo(helpTarget);
      return;
    }

    const handler = actions[button.id];
    if (handler) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (onboardingState.active) cerrarGuiaUsuario(true);
      handler();
      return;
    }

    const profileAction = button.closest(".perfil-menu-item");
    if (!profileAction) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (onboardingState.active) cerrarGuiaUsuario(true);

    const actionName = profileAction.dataset?.profileAction;
    if (profileActions[actionName]) {
      profileActions[actionName]();
    } else if (profileAction.textContent.includes("Editar") || profileAction.querySelector("#perfilEditarTitulo")) editarPerfil();
    else if (profileAction.textContent.includes("Notificaciones") || profileAction.querySelector("#perfilNotificacionesTitulo")) verNotificaciones();
    else if (profileAction.textContent.includes("Seguridad") || profileAction.querySelector("#perfilSeguridadTitulo")) verSeguridad();
    else if (profileAction.querySelector("#perfilConfigTitulo")) abrirConfiguracion();
    else if (profileAction.querySelector("#perfilAyudaTitulo")) ayuda();
  }, true);

  ["rentaIngresos", "rentaPatrimonio", "rentaDeducciones", "rentaRetenciones"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.removeAttribute("disabled");
    input.removeAttribute("readonly");
    input.addEventListener("pointerup", () => input.focus());
    input.addEventListener("click", () => input.focus());
    input.addEventListener("touchend", () => setTimeout(() => input.focus(), 0), { passive: true });
  });
}

function toggleFabMenu() {
  const stack = document.getElementById("fabStack");
  const trigger = document.getElementById("fabMain");
  if (!stack || !trigger) return;
  const abierto = stack.classList.toggle("open");
  trigger.setAttribute("aria-expanded", abierto ? "true" : "false");
}

function cerrarFabMenu() {
  const stack = document.getElementById("fabStack");
  const trigger = document.getElementById("fabMain");
  if (!stack || !trigger) return;
  stack.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
}

function estaDentroDeRango(fechaValor, desde, hasta) {
  const fecha = new Date(fechaValor);
  const fechaSinHora = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  if (desde) {
    const fechaDesde = new Date(`${desde}T00:00:00`);
    if (fechaSinHora < fechaDesde) {
      return false;
    }
  }

  if (hasta) {
    const fechaHasta = new Date(`${hasta}T00:00:00`);
    if (fechaSinHora > fechaHasta) {
      return false;
    }
  }

  return true;
}

window.onload = async () => {
  usuario = await obtenerSesionUsuario();
  if (!usuario?.id_usuario) {
    window.location = "login.html";
    return;
  }

  resetWalleConversationForUser();
  window.WalleController?.init();
  setupGlobalModals();
  setupWalleChatModal();
  setupInactivityLogout();
  setupCriticalMobileActions();
  poblarSelectorIconos();
  configurarEntradasMoneda();
  applyPreferences();
  mostrarMensajeCargaWalleAleatorio();
  configurarPerfil();
  mostrarConsentimientoDatosSiHaceFalta();
  document.getElementById("fechaMovimiento").value = fechaHoyInput();
  document.getElementById("filtroAnioReportes").value = new Date().getFullYear();
  document.getElementById("fechaInicioReportes").addEventListener("change", limpiarFiltrosMesSiHayRango);
  document.getElementById("fechaFinReportes").addEventListener("change", limpiarFiltrosMesSiHayRango);
  document.addEventListener("click", (event) => {
    const stack = document.getElementById("fabStack");
    if (stack && !stack.contains(event.target)) {
      cerrarFabMenu();
    }
  });
  aplicarUltimos30Dias();
  aplicarUltimos30DiasReportes();
  mostrarConsejoAleatorio();
  mostrarMensajeCargaWalleAleatorio();
  loaderTipInterval = setInterval(mostrarConsejoAleatorio, 2500);
  const walleLoaderInterval = setInterval(mostrarMensajeCargaWalleAleatorio, 1800);
  ["notifMetas", "notifResumen", "notifSeguridad"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("change", updateNotificationSummary);
  });
  prepararGuiaUsuario();
  window.WalleController?.showOverlay(getWalleMessages().welcome, {
    mood: "guide",
    duration: 2400
  });

  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = "none";
    }

    if (loaderTipInterval) {
      clearInterval(loaderTipInterval);
    }
    clearInterval(walleLoaderInterval);

    cargar();
    cargarMetas();
    cargarCategorias();
    setTimeout(() => iniciarGuiaUsuario(false), 500);
  }, 900);
};

function resetFormularioMovimiento() {
  movimientoEnEdicion = null;
  document.getElementById("modalMovimientoTitulo").textContent = "Nuevo movimiento";
  document.getElementById("btnGuardarMovimiento").textContent = "Guardar";
  document.getElementById("tipo").value = "ingreso";
  document.getElementById("categoria").value = "";
  document.getElementById("fechaMovimiento").value = fechaHoyInput();
  document.getElementById("monto").value = "";
  document.getElementById("descripcion").value = "";
  actualizarTipoSegunCategoria();
}

function abrirModal(movimiento = null) {
  if (movimiento) {
    movimientoEnEdicion = movimiento;
    document.getElementById("modalMovimientoTitulo").textContent = "Editar movimiento";
    document.getElementById("btnGuardarMovimiento").textContent = "Actualizar";
    document.getElementById("tipo").value = movimiento.tipo;
    document.getElementById("categoria").value = String(movimiento.categoria_id || "");
    document.getElementById("fechaMovimiento").value = obtenerClaveFecha(movimiento.fecha) || fechaHoyInput();
    document.getElementById("monto").value = formatearNumeroInput(movimiento.monto);
    document.getElementById("descripcion").value = movimiento.descripcion || "";
    actualizarTipoSegunCategoria();
  } else {
    resetFormularioMovimiento();
  }
  openModal("modal");
}

function cerrarModal() {
  cerrarModalGenerico("modal");
  resetFormularioMovimiento();
}

function abrirCategorias() {
  openModal("modalCategorias");
  cargarCategoriasLista();
}

function abrirCategoriasDesdeMovimiento() {
  volverAMovimiento = true;
  cerrarModal();
  abrirCategorias();
}

function cerrarCategorias() {
  cerrarModalGenerico("modalCategorias");
  if (volverAMovimiento) {
    volverAMovimiento = false;
    abrirModal();
    cargarCategorias();
  }
}

function abrirModalMeta() {
  metaEnEdicion = null;
  document.getElementById("tituloModalMeta").textContent = "Nueva Meta";
  document.getElementById("btnGuardarMeta").textContent = "Guardar";
  document.getElementById("metaNombre").value = "";
  document.getElementById("metaMonto").value = "";
  document.getElementById("metaFecha").value = "";
  openModal("modalMeta");
}

function cerrarModalMeta() {
  metaEnEdicion = null;
  cerrarModalGenerico("modalMeta");
}

function toggleAyudaCampo(id) {
  document.querySelectorAll(".campo-ayuda").forEach((item) => {
    item.classList.toggle("activa", item.id === id && !item.classList.contains("activa"));
  });
}

async function cargarCategorias() {
  try {
    const res = await apiFetch(`${API_URL}/categorias/${usuario.id_usuario}`);
    const data = await res.json();

    const select = document.getElementById("categoria");
    const filtroCategoria = document.getElementById("filtroCategoriaReportes");
    const categoriaActual = select.value;
    const filtroActual = filtroCategoria?.value || "";
    select.innerHTML = "";
    if (filtroCategoria) {
      filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
    }

    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.textContent = "Selecciona una categoría";
    select.appendChild(optionDefault);

    data.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.id;
      option.dataset.esMeta = c.es_meta;
      option.dataset.nombre = normalizeWalleText(c.nombre);
      option.textContent = `${c.icono || "📦"} ${c.nombre}`;
      select.appendChild(option);

      if (filtroCategoria) {
        const filtroOption = document.createElement("option");
        filtroOption.value = c.id;
        filtroOption.textContent = `${c.icono || "📦"} ${c.nombre}`;
        filtroCategoria.appendChild(filtroOption);
      }
    });

    select.value = categoriaActual;
    if (filtroCategoria) {
      filtroCategoria.value = filtroActual;
    }
    actualizarTipoSegunCategoria();
  } catch (error) {
    console.error(error);
    alert(tx("categoriesError"));
  }
}

function actualizarTipoSegunCategoria() {
  const select = document.getElementById("categoria");
  const tipo = document.getElementById("tipo");
  const hint = document.getElementById("hintMetaMovimiento");
  const option = select?.selectedOptions?.[0];
  const esMeta = option?.dataset?.esMeta === "1";

  if (esMeta) {
    tipo.value = "gasto";
    tipo.disabled = true;
    hint.style.display = "block";
  } else {
    tipo.disabled = false;
    hint.style.display = "none";
  }
}

async function cargarCategoriasLista() {
  try {
    const res = await apiFetch(`${API_URL}/categorias/${usuario.id_usuario}`);
    const data = await res.json();

    const lista = document.getElementById("listaCategorias");
    lista.innerHTML = "";

    data.forEach((c) => {
      const li = document.createElement("li");
      const texto = document.createElement("span");
      texto.textContent = `${c.icono || "📦"} ${c.nombre}`;
      li.appendChild(texto);

      if (!c.es_meta) {
        const boton = document.createElement("button");
        boton.textContent = "Eliminar";
        boton.onclick = () => eliminarCategoria(c.id);
        li.appendChild(boton);
      }

      lista.appendChild(li);
    });
  } catch (error) {
    console.error(error);
    alert(tx("categoriesError"));
  }
}

async function crearCategoria() {
  const nombre = document.getElementById("nuevaCategoria").value.trim();
  const icono = document.getElementById("iconoCategoria").value;

  if (!nombre) {
    alert(tx("categoryNameRequired"));
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/categorias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, icono })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "No se pudo crear la categoría");
      return;
    }

    document.getElementById("nuevaCategoria").value = "";
    cargarCategorias();
    cargarCategoriasLista();
  } catch (error) {
    console.error(error);
    alert(tx("categoriesError"));
  }
}

async function eliminarCategoria(id) {
  const confirmar = confirm("¿Seguro que quieres eliminar esta categoría?");
  if (!confirmar) {
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/categorias/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok || data.error) {
      alert(data.mensaje || "No se pudo eliminar la categoría");
      return;
    }

    cargarCategorias();
    cargarCategoriasLista();
  } catch (error) {
    console.error(error);
    alert(tx("categoriesError"));
  }
}

async function guardar() {
  const tipo = document.getElementById("tipo").value;
  const monto = parseNumeroInput(document.getElementById("monto").value);
  const categoria_id = Number(document.getElementById("categoria").value);
  const descripcion = document.getElementById("descripcion").value.trim();
  const fecha = document.getElementById("fechaMovimiento").value;

  if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
    showToast(tx("categoryRequired"), "error");
    return;
  }

  if (!monto || monto <= 0) {
    showToast(tx("amountInvalid"), "error");
    return;
  }
  if (!fecha) {
    showToast("Selecciona la fecha del movimiento.", "error");
    return;
  }

  try {
    const esEdicion = Boolean(movimientoEnEdicion?.id);
    const res = await apiFetch(esEdicion ? `${API_URL}/movimientos/${movimientoEnEdicion.id}` : `${API_URL}/movimientos`, {
      method: esEdicion ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        monto,
        descripcion,
        categoria_id,
        fecha
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.mensaje || `No se pudo ${esEdicion ? "actualizar" : "guardar"} el movimiento.`, "error");
      return;
    }

    invalidateWalleFinancialSnapshot();
    cerrarModal();
    cargar();
    cargarMetas();
    cargarReportes();
    showToast(esEdicion ? "Movimiento actualizado correctamente." : "Movimiento guardado correctamente.", "success");
    window.WalleController?.showOverlay(
      tipo === "gasto" ? getWalleMessages().watchExpense : getWalleMessages().goodJob,
      { mood: tipo === "gasto" ? "alert" : "happy" }
    );
  } catch (error) {
    console.error(error);
    showToast("No se pudo guardar el movimiento.", "error");
  }
}

async function cargar() {
  const lista = document.getElementById("lista");
  if (lista) {
    lista.innerHTML = renderLoadingState("Cargando tus movimientos...");
  }

  try {
    limpiarFiltrosMesSiHayRango();
    const desde = document.getElementById("fechaInicio").value;
    const hasta = document.getElementById("fechaFin").value;
    const tipoFiltro = document.getElementById("filtroTipo").value;

    const params = new URLSearchParams();
    if (desde) params.set("startDate", desde);
    if (hasta) params.set("endDate", hasta);
    if (tipoFiltro && tipoFiltro !== "todos") params.set("tipo", tipoFiltro);

    const res = await apiFetch(`${API_URL}/movimientos/${usuario.id_usuario}?${params.toString()}`);
    const data = await res.json();

    lista.innerHTML = "";

    let total = 0;
    const diasActivos = new Set();

    if (!data.length) {
      lista.innerHTML = renderEmptyState(
        "Aún no tienes movimientos",
        "Registra tu primer ingreso o gasto para empezar a ver tu flujo de dinero con más claridad."
      );
      document.getElementById("balance").textContent = formatoCOP(0);
      actualizarResumenPerfil({
        totalTransacciones: 0,
        diasActivos: 0
      });
      return;
    }

    data.forEach((m) => {
      if (m.fecha) {
        diasActivos.add(obtenerClaveFecha(m.fecha));
      }

      const li = document.createElement("li");
      li.className = m.tipo;

      li.innerHTML = `
        <div class="movimiento-titulo"><span class="lista-icono">${m.icono || "📦"}</span><b>${m.categoria || "Sin categoría"}</b></div>
        <div>${formatoCOP(m.monto)}</div>
        <small>${new Date(m.fecha).toLocaleString(localeActual)}${m.descripcion ? ` • ${m.descripcion}` : ""}</small>
      `;

       const acciones = document.createElement("div");
       acciones.style.display = "flex";
       acciones.style.gap = "8px";
       acciones.style.marginTop = "10px";

       const botonEditar = document.createElement("button");
       botonEditar.textContent = "Editar";
       botonEditar.style.marginTop = "0";
       botonEditar.onclick = async () => {
         await cargarCategorias();
         abrirModal(m);
       };

       const botonEliminar = document.createElement("button");
       botonEliminar.textContent = "Eliminar";
       botonEliminar.style.marginTop = "0";
       botonEliminar.onclick = () => eliminarMovimiento(m.id, m.descripcion || m.categoria || "este movimiento");

       acciones.appendChild(botonEditar);
       acciones.appendChild(botonEliminar);
       li.appendChild(acciones);

      lista.appendChild(li);

      if (m.tipo === "ingreso") {
        total += Number(m.monto);
      } else {
        total -= Number(m.monto);
      }
    });

    document.getElementById("balance").textContent = formatoCOP(total);
    actualizarResumenPerfil({
      totalTransacciones: data.length,
      diasActivos: diasActivos.size
    });
    maybeShowAutomaticWalleInsight();
  } catch (error) {
    console.error(error);
    if (lista) {
      lista.innerHTML = renderEmptyState(
        "No pudimos cargar tus movimientos",
        "Intenta nuevamente en unos segundos para recuperar tu historial."
      );
    }
    showToast("No se pudieron cargar los movimientos.", "error");
  }
}

async function eliminarMovimiento(id, label) {
  const confirmar = confirm(`¿Seguro que quieres eliminar ${label}?`);
  if (!confirmar) {
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/movimientos/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.mensaje || "No se pudo eliminar el movimiento.", "error");
      return;
    }
    invalidateWalleFinancialSnapshot();
    cargar();
    cargarMetas();
    cargarReportes();
    showToast("Movimiento eliminado.", "success");
  } catch (error) {
    console.error(error);
    showToast("No se pudo eliminar el movimiento.", "error");
  }
}

function porcentajeAhorro(valor) {
  if (!Number.isFinite(valor)) return "0%";
  return `${valor.toFixed(1)}%`;
}

function construirReporteParams() {
  const desde = document.getElementById("fechaInicioReportes").value;
  const hasta = document.getElementById("fechaFinReportes").value;
  const tipoFiltro = document.getElementById("filtroTipoReportes").value;
  const categoriaId = document.getElementById("filtroCategoriaReportes").value;
  const month = document.getElementById("filtroMesReportes").value;
  const year = document.getElementById("filtroAnioReportes").value;
  const params = new URLSearchParams();

  if (desde) params.set("startDate", desde);
  if (hasta) params.set("endDate", hasta);
  if (tipoFiltro && tipoFiltro !== "todos") params.set("tipo", tipoFiltro);
  if (categoriaId) params.set("categoriaId", categoriaId);
  if (month && year) {
    params.set("month", month);
    params.set("year", year);
  }

  return params;
}

async function cargarReportes() {
  const lista = document.getElementById("listaReporte");
  const resumenMensual = document.getElementById("listaResumenMensual");
  if (lista) {
    lista.innerHTML = renderLoadingState("Calculando tus reportes...");
  }
  if (resumenMensual) {
    resumenMensual.innerHTML = renderLoadingState("Preparando tu resumen mensual...");
  }

  try {
    const params = construirReporteParams();
    const res = await apiFetch(`${API_URL}/reportes/${usuario.id_usuario}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showToast(data.mensaje || "No se pudieron cargar los reportes.", "error");
      return;
    }

    ultimoReporte = data;
    const summary = data.summary || {};
    const comparison = data.comparison || {
      current: { ingresos: 0, gastos: 0, balance: 0 },
      previous: { ingresos: 0, gastos: 0, balance: 0 },
      currentLabel: "Periodo actual",
      previousLabel: "Periodo anterior"
    };
    const categoriasOrdenadas = Array.isArray(data.categories) ? data.categories : [];
    const monthlyData = Array.isArray(data.monthly) ? data.monthly : [];

    document.getElementById("repIngresos").textContent = formatoCOP(summary.ingresos || 0);
    document.getElementById("repGastos").textContent = formatoCOP(summary.gastos || 0);
    document.getElementById("repBalance").textContent = formatoCOP(summary.balance || 0);
    document.getElementById("repPromedioMensual").textContent = formatoCOP(summary.promedioMensual || 0);
    document.getElementById("repCapacidadAhorro").textContent = porcentajeAhorro(summary.capacidadAhorro || 0);
    document.getElementById("repCategoriaMayor").textContent = summary.categoriaMayorGasto
      ? `${summary.categoriaMayorGasto.icono || "📦"} ${summary.categoriaMayorGasto.categoria || "Sin categoría"}`
      : "Sin datos";
    document.getElementById("repTotalMovimientos").textContent = summary.totalMovimientos || 0;

    const ctx = document.getElementById("grafica");
    if (window.miGrafica && typeof window.miGrafica.destroy === "function") {
      window.miGrafica.destroy();
    }
    if (typeof Chart !== "undefined" && ctx) {
      window.miGrafica = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: categoriasOrdenadas.length ? categoriasOrdenadas.map((item) => item.categoria) : ["Sin datos"],
          datasets: [{
            data: categoriasOrdenadas.length ? categoriasOrdenadas.map((item) => item.total) : [1],
            backgroundColor: categoriasOrdenadas.length
              ? ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"]
              : ["#334155"],
            borderWidth: 0
          }]
        },
        options: {
          plugins: {
            legend: {
              labels: { color: chartTextColor }
            }
          }
        }
      });
    }

    lista.innerHTML = "";

    if (!categoriasOrdenadas.length) {
      const item = document.createElement("div");
      item.className = "top-categoria-item";
      item.innerHTML = `<div class="top-categoria-nombre"><span>Sin movimientos para este filtro</span></div><strong>${formatoCOP(0)}</strong>`;
      lista.appendChild(item);
    } else {
      categoriasOrdenadas.slice(0, 6).forEach((info) => {
        const item = document.createElement("div");
        item.className = "top-categoria-item";
        item.innerHTML = `
          <div class="top-categoria-nombre"><span class="lista-icono">${info.icono || "📦"}</span><span>${info.categoria || "Sin categoría"}</span></div>
          <strong>${formatoCOP(info.total || 0)}</strong>
        `;
        lista.appendChild(item);
      });
    }

    const ctxComparativa = document.getElementById("graficaComparativa");
    if (window.graficaComparativa && typeof window.graficaComparativa.destroy === "function") {
      window.graficaComparativa.destroy();
    }
    if (typeof Chart !== "undefined" && ctxComparativa) {
      window.graficaComparativa = new Chart(ctxComparativa, {
        type: "bar",
        data: {
          labels: ["Ingresos", "Gastos", "Balance"],
          datasets: [
            {
              label: comparison.currentLabel || "Periodo actual",
              data: [
                comparison.current?.ingresos || 0,
                comparison.current?.gastos || 0,
                comparison.current?.balance || 0
              ],
              backgroundColor: "#22c55e"
            },
            {
              label: comparison.previousLabel || "Periodo anterior",
              data: [
                comparison.previous?.ingresos || 0,
                comparison.previous?.gastos || 0,
                comparison.previous?.balance || 0
              ],
              backgroundColor: "#94a3b8"
            }
          ]
        },
        options: {
          plugins: { legend: { labels: { color: chartTextColor } } },
          scales: {
            x: { ticks: { color: chartTextColor } },
            y: { ticks: { color: chartTextColor } }
          }
        }
      });
    }

    resumenMensual.innerHTML = "";
    if (!monthlyData.length) {
      const item = document.createElement("div");
      item.className = "top-categoria-item";
      item.innerHTML = `<div class="top-categoria-nombre"><span>Sin historial para mostrar</span></div><strong>${formatoCOP(0)}</strong>`;
      resumenMensual.appendChild(item);
    } else {
      monthlyData.slice(-6).reverse().forEach((mes) => {
        const item = document.createElement("div");
        item.className = "top-categoria-item";
        item.innerHTML = `
          <div class="top-categoria-nombre"><span>${mes.periodo || "Periodo"}</span></div>
          <strong>${formatoCOP(mes.balance || 0)}</strong>
        `;
        resumenMensual.appendChild(item);
      });
    }
  } catch (error) {
    console.error(error);
    if (lista) {
      lista.innerHTML = renderEmptyState(
        "No pudimos construir este reporte",
        "Revisa tus filtros o intenta nuevamente en unos segundos."
      );
    }
    if (resumenMensual) {
      resumenMensual.innerHTML = renderEmptyState(
        "Sin resumen disponible",
        "Todavía no tenemos suficiente información para mostrar el histórico filtrado."
      );
    }
    showToast("No se pudieron cargar los reportes.", "error");
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stringToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function saveTextDocument(content, fileName, mimeType, shareText) {
  const safeFileName = String(fileName || `dinamicash-${Date.now()}.txt`).replace(/[\\/:*?"<>|]+/g, "-");
  const Filesystem = getCapacitorPlugin("Filesystem");
  const Share = getCapacitorPlugin("Share");

  if (isNativeAndroidApp() && Filesystem) {
    const Directory = window.Capacitor?.FilesystemDirectory || { Cache: "CACHE", Documents: "DOCUMENTS" };
    const result = await Filesystem.writeFile({
      path: safeFileName,
      data: stringToBase64(content),
      directory: Directory.Cache
    });

    if (Share?.share) {
      await Share.share({
        title: "Dinamicash Wallet",
        text: shareText || "Archivo generado por Dinamicash Wallet",
        url: result.uri,
        dialogTitle: "Guardar o compartir archivo"
      });
      showToast("Archivo listo. Elige dónde guardarlo o compartirlo.", "success");
      return;
    }

    alert(`Archivo generado. Ubicación temporal: ${result.uri}`);
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportarReporteExcel() {
  if (!ultimoReporte) {
    alert("Primero carga un reporte.");
    return;
  }

  const rows = [
    ["Periodo", ultimoReporte.comparison.currentLabel],
    ["Ingresos", ultimoReporte.summary.ingresos],
    ["Gastos", ultimoReporte.summary.gastos],
    ["Balance", ultimoReporte.summary.balance],
    ["Promedio mensual", ultimoReporte.summary.promedioMensual],
    ["Capacidad de ahorro", ultimoReporte.summary.capacidadAhorro]
  ];

  rows.push([]);
  rows.push(["Categoria", "Total"]);
  (ultimoReporte.categories || []).forEach((item) => rows.push([item.categoria, item.total]));

  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
  try {
    await saveTextDocument(
      csv,
      `dinamicash-reporte-${Date.now()}.csv`,
      "text/csv;charset=utf-8;",
      "Reporte CSV generado por Dinamicash Wallet"
    );
  } catch (error) {
    console.error(error);
    alert("No se pudo generar o guardar el reporte de Excel.");
  }
}

async function getPdfLogoDataUrl() {
  if (wallePdfLogoDataUrl) {
    return wallePdfLogoDataUrl;
  }

  const response = await fetch("assets/LOGO.png");
  if (!response.ok) {
    throw new Error("No se pudo cargar el logo para el PDF.");
  }

  const blob = await response.blob();
  wallePdfLogoDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el logo para el PDF."));
    reader.readAsDataURL(blob);
  });

  return wallePdfLogoDataUrl;
}

async function addPdfBrandHeader(doc, title, subtitle, options = {}) {
  const {
    logoX = 14,
    logoY = 10,
    logoWidth = 72,
    logoHeight = 41,
    titleY = 25,
    subtitleY = 33
  } = options;

  const logoDataUrl = await getPdfLogoDataUrl();
  doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoWidth, logoHeight);
  const textX = logoX + logoWidth + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, textX, titleY);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(subtitle, textX, subtitleY);
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 56, 196, 56);
}

function getCapacitorPlugin(name) {
  return window.Capacitor?.Plugins?.[name] || window[name] || null;
}

function isNativeAndroidApp() {
  return window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === "android";
}

async function savePdfDocument(doc, fileName) {
  const safeFileName = String(fileName || `dinamicash-${Date.now()}.pdf`).replace(/[\\/:*?"<>|]+/g, "-");
  const Filesystem = getCapacitorPlugin("Filesystem");
  const Share = getCapacitorPlugin("Share");

  if (isNativeAndroidApp() && Filesystem) {
    const Directory = window.Capacitor?.FilesystemDirectory || { Cache: "CACHE", Documents: "DOCUMENTS" };
    const data = doc.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({
      path: safeFileName,
      data,
      directory: Directory.Cache
    });

    if (Share?.share) {
      await Share.share({
        title: "Dinamicash Wallet",
        text: "PDF generado por Dinamicash Wallet",
        url: result.uri,
        dialogTitle: "Guardar o compartir PDF"
      });
      showToast("PDF listo. Elige dónde guardarlo o compartirlo.", "success");
      return;
    }

    alert(`PDF generado. Archivo temporal: ${result.uri}`);
    return;
  }

  doc.save(safeFileName);
}

async function exportarReportePDF() {
  if (!ultimoReporte) {
    alert("Primero carga un reporte.");
    return;
  }

  const jsPDFLib = window.jspdf?.jsPDF;
  if (!jsPDFLib) {
    alert("No se pudo cargar la librería para generar el PDF.");
    return;
  }

  try {
    const doc = new jsPDFLib();
    await addPdfBrandHeader(
      doc,
      "Reporte financiero",
      `Periodo: ${ultimoReporte.comparison.currentLabel}`
    );

    const lineas = [
      ["Ingresos", formatoCOP(ultimoReporte.summary.ingresos)],
      ["Gastos", formatoCOP(ultimoReporte.summary.gastos)],
      ["Balance", formatoCOP(ultimoReporte.summary.balance)],
      ["Promedio mensual", formatoCOP(ultimoReporte.summary.promedioMensual)],
      ["Capacidad de ahorro", porcentajeAhorro(ultimoReporte.summary.capacidadAhorro)],
      ["Categoria top", ultimoReporte.summary.categoriaMayorGasto ? ultimoReporte.summary.categoriaMayorGasto.categoria : "Sin datos"]
    ];

    let y = 68;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    lineas.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, 14, y);
      y += 10;
    });

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Categorias destacadas", 14, y);
    doc.setFont("helvetica", "normal");
    y += 10;
    (ultimoReporte.categories || []).slice(0, 8).forEach((item) => {
      doc.text(`${item.categoria}: ${formatoCOP(item.total)}`, 14, y);
      y += 8;
    });

    await savePdfDocument(doc, `dinamicash-reporte-${Date.now()}.pdf`);
  } catch (error) {
    console.error(error);
    alert("No se pudo generar o guardar el PDF.");
  }
}

function calcularMetaEstado(meta, movimientos = []) {
  const metaMonto = Number(meta.monto) || 0;
  let ahorroReal = 0;
  let primerAporte = null;

  movimientos.forEach((movimiento) => {
    if (normalizeWalleText(movimiento.categoria) !== normalizeWalleText(meta.nombre)) {
      return;
    }

    const monto = Number(movimiento.monto) || 0;
    if (movimiento.tipo === "gasto") {
      ahorroReal += monto;
      if (!primerAporte || new Date(movimiento.fecha) < primerAporte) {
        primerAporte = new Date(movimiento.fecha);
      }
    } else {
      ahorroReal -= monto;
    }
  });

  ahorroReal = Math.max(ahorroReal, 0);
  const faltante = Math.max(metaMonto - ahorroReal, 0);
  const porcentajeReal = metaMonto > 0 ? Math.min((ahorroReal / metaMonto) * 100, 100) : 0;
  const hoy = new Date();
  const fechaLimite = new Date(meta.fecha_limite);
  const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));

  const inicioBase = primerAporte || hoy;
  const totalDiasPlan = Math.max(Math.ceil((fechaLimite - inicioBase) / (1000 * 60 * 60 * 24)), 1);
  const diasTranscurridos = Math.min(Math.max(Math.ceil((hoy - inicioBase) / (1000 * 60 * 60 * 24)), 0), totalDiasPlan);
  const ahorroPlaneado = metaMonto > 0 ? Math.min(metaMonto, (metaMonto / totalDiasPlan) * diasTranscurridos) : 0;
  const porcentajePlaneado = metaMonto > 0 ? Math.min((ahorroPlaneado / metaMonto) * 100, 100) : 0;
  const ritmoRecomendado = diasRestantes > 0 ? faltante / diasRestantes : faltante;

  return {
    metaMonto,
    ahorroReal,
    faltante,
    porcentajeReal,
    porcentajePlaneado,
    ahorroPlaneado,
    diasRestantes,
    ritmoRecomendado
  };
}

async function aportarAMeta(meta) {
  await cargarCategorias();
  abrirModal();

  const tipo = document.getElementById("tipo");
  const categoria = document.getElementById("categoria");
  const descripcion = document.getElementById("descripcion");
  const fecha = document.getElementById("fechaMovimiento");

  const categoriaMeta = Array.from(categoria.options).find((option) => (
    option.dataset.esMeta === "1" && option.dataset.nombre === normalizeWalleText(meta.nombre)
  ));

  tipo.value = "gasto";
  if (categoriaMeta) {
    categoria.value = categoriaMeta.value;
  }
  if (descripcion) {
    descripcion.value = `Aporte a meta: ${meta.nombre}`;
  }
  if (fecha) {
    fecha.value = fechaHoyInput();
  }
  actualizarTipoSegunCategoria();
  showToast(`Registra aquí el aporte para la meta "${meta.nombre}".`, "info");
}

async function guardarMeta() {
  const nombre = document.getElementById("metaNombre").value.trim();
  const monto = parseNumeroInput(document.getElementById("metaMonto").value);
  const fecha = document.getElementById("metaFecha").value;

  if (!nombre || !monto || !fecha) {
    showToast("Completa todos los campos de la meta.", "error");
    return;
  }

  try {
    const url = metaEnEdicion ? `${API_URL}/metas/${metaEnEdicion.id}` : `${API_URL}/metas`;
    const method = metaEnEdicion ? "PUT" : "POST";

    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        monto,
        fecha_limite: fecha
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.mensaje || "No se pudo guardar la meta.", "error");
      return;
    }

    invalidateWalleFinancialSnapshot();
    cerrarModalMeta();
    cargarCategorias();
    cargarMetas();
    showToast(metaEnEdicion ? "Meta actualizada correctamente." : "Meta creada correctamente.", "success");
    window.WalleController?.showOverlay(getWalleMessages().saveToday, { mood: "motivate" });
  } catch (error) {
    console.error(error);
    showToast("No se pudo guardar la meta.", "error");
  }
}

async function cargarMetas() {
  const lista = document.getElementById("listaMetas");
  const total = document.getElementById("totalMetas");
  lista.innerHTML = renderLoadingState("Cargando tus metas y su progreso...");

  try {
    const [resMetas, resMovimientos] = await Promise.all([
      apiFetch(`${API_URL}/metas/${usuario.id_usuario}`),
      apiFetch(`${API_URL}/movimientos/${usuario.id_usuario}`)
    ]);

    const metas = await resMetas.json();
    const movimientos = await resMovimientos.json();
    lista.innerHTML = "";

    let suma = 0;
    let metasPorVencer = 0;
    let metasCumplidas = 0;

    if (!metas.length) {
      total.textContent = formatoCOP(0);
      lista.innerHTML = renderEmptyState(
        "Aún no tienes metas creadas",
        "Crea una meta con monto y fecha límite para empezar a medir tu avance real y tomar mejores decisiones."
      );
      actualizarResumenPerfil({ totalMetas: 0 });
      return;
    }

    metas.forEach((m) => {
      const estado = calcularMetaEstado(m, movimientos);
      suma += estado.ahorroReal;
      if (estado.porcentajeReal >= 100) metasCumplidas += 1;
      if (estado.diasRestantes >= 0 && estado.diasRestantes <= 7 && estado.porcentajeReal < 100) metasPorVencer += 1;

      let estadoChip = '<span class="meta-chip info">En progreso</span>';
      if (estado.porcentajeReal >= 100) {
        estadoChip = '<span class="meta-chip success">Meta cumplida</span>';
      } else if (estado.diasRestantes < 0) {
        estadoChip = '<span class="meta-chip danger">Fecha vencida</span>';
      } else if (estado.diasRestantes <= 7) {
        estadoChip = '<span class="meta-chip warning">Cerca del vencimiento</span>';
      }

      const div = document.createElement("div");
      div.className = "meta-card";
      div.innerHTML = `
        <div class="meta-topline">
          <div class="meta-title-group">
            <div class="movimiento-titulo"><span class="lista-icono">${m.icono || "🎯"}</span><h3>${m.nombre}</h3></div>
            <span class="meta-subtext">${estado.diasRestantes > 0 ? `${estado.diasRestantes} días restantes` : estado.diasRestantes === 0 ? "Vence hoy" : "Meta vencida"}</span>
          </div>
          ${estadoChip}
        </div>
        <div class="meta-progress-row">
          <span class="meta-subtext">Avance real</span>
          <strong>${estado.porcentajeReal.toFixed(1)}%</strong>
        </div>
        <div class="barra"><div class="progreso" style="width:${estado.porcentajeReal}%"></div></div>
        <div class="meta-info">
          <div class="meta-stat"><span class="meta-stat-label">Ahorro real</span><b>${formatoCOP(estado.ahorroReal)}</b></div>
          <div class="meta-stat"><span class="meta-stat-label">Planeado a hoy</span><b>${formatoCOP(estado.ahorroPlaneado)}</b></div>
          <div class="meta-stat"><span class="meta-stat-label">Faltante</span><b>${formatoCOP(estado.faltante)}</b></div>
          <div class="meta-stat"><span class="meta-stat-label">Meta total</span><b>${formatoCOP(estado.metaMonto)}</b></div>
        </div>
        <div class="meta-status-row">
          <span class="meta-chip info">Planeado: ${estado.porcentajePlaneado.toFixed(1)}%</span>
          <span class="meta-chip info">Ritmo sugerido: ${formatoCOP(Math.ceil(estado.ritmoRecomendado || 0))}/día</span>
        </div>
      `;

      const acciones = document.createElement("div");
      acciones.className = "meta-actions";

      const botonAportar = document.createElement("button");
      botonAportar.textContent = "Aportar";
      botonAportar.style.marginTop = "0";
      botonAportar.onclick = async () => aportarAMeta(m);

      const botonEditar = document.createElement("button");
      botonEditar.textContent = "Editar";
      botonEditar.style.marginTop = "0";
      botonEditar.onclick = () => editarMeta(m);

      const botonEliminar = document.createElement("button");
      botonEliminar.textContent = "Eliminar meta";
      botonEliminar.style.marginTop = "0";
      botonEliminar.onclick = () => eliminarMeta(m.id, m.nombre);

      acciones.appendChild(botonAportar);
      acciones.appendChild(botonEditar);
      acciones.appendChild(botonEliminar);
      div.appendChild(acciones);
      lista.appendChild(div);
    });

    total.textContent = formatoCOP(suma);
    actualizarResumenPerfil({ totalMetas: metas.length });

    if (isScreenActive("metas") && getNotifications().metas) {
      if (metasCumplidas > 0) {
        showToast(`Tienes ${metasCumplidas} meta(s) cumplida(s). Gran trabajo.`, "success");
      } else if (metasPorVencer > 0) {
        showToast(`Tienes ${metasPorVencer} meta(s) cerca de vencer. Revisa sus aportes.`, "info");
      }
    }
  } catch (error) {
    console.error(error);
    lista.innerHTML = renderEmptyState(
      "No pudimos cargar tus metas",
      "Intenta nuevamente para recuperar tus avances y tus objetivos."
    );
    showToast("No se pudieron cargar las metas.", "error");
  }
}

function editarMeta(meta) {
  metaEnEdicion = meta;
  document.getElementById("tituloModalMeta").textContent = "Editar Meta";
  document.getElementById("btnGuardarMeta").textContent = "Actualizar";
  document.getElementById("metaNombre").value = meta.nombre;
  document.getElementById("metaMonto").value = formatearNumeroInput(meta.monto);
  document.getElementById("metaFecha").value = meta.fecha_limite?.split("T")[0] || meta.fecha_limite;
  document.getElementById("modalMeta").style.display = "flex";
}

async function eliminarMeta(id, nombre) {
  const confirmar = confirm(`¿Seguro que quieres eliminar la meta "${nombre}"?`);
  if (!confirmar) {
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/metas/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.mensaje || "No se pudo eliminar la meta.", "error");
      return;
    }

    invalidateWalleFinancialSnapshot();
    showToast(data.mensaje || "Meta eliminada.", "success");
    cargarMetas();
  } catch (error) {
    console.error(error);
    showToast("No se pudo eliminar la meta.", "error");
  }
}

function simularRenta() {
  const ingresos = parseNumeroInput(document.getElementById("rentaIngresos").value);
  const patrimonio = parseNumeroInput(document.getElementById("rentaPatrimonio").value);
  const deducciones = parseNumeroInput(document.getElementById("rentaDeducciones").value);
  const retenciones = parseNumeroInput(document.getElementById("rentaRetenciones").value);

  if (ingresos <= 0 && patrimonio <= 0) {
    showToast("Ingresa al menos los ingresos o el patrimonio para hacer una simulación.", "error");
    return;
  }

  const baseGravable = Math.max(ingresos - deducciones, 0);
  const referenciaIngresosDeclara = 65891000;
  const referenciaPatrimonioDeclara = 211793000;
  const superaIngresos = ingresos >= referenciaIngresosDeclara;
  const superaPatrimonio = patrimonio >= referenciaPatrimonioDeclara;

  let tarifa = 0;
  if (baseGravable > 180000000) tarifa = 0.12;
  else if (baseGravable > 100000000) tarifa = 0.08;
  else if (baseGravable > 50000000) tarifa = 0.04;

  let impuestoEstimado = baseGravable * tarifa;
  if (patrimonio > 300000000 && impuestoEstimado < patrimonio * 0.005) {
    impuestoEstimado = patrimonio * 0.005;
  }

  const saldo = impuestoEstimado - retenciones;
  const resultado = document.getElementById("resultadoRenta");
  const mensaje = document.getElementById("rentaMensaje");
  const chip = document.getElementById("rentaEstadoChip");
  const downloadBtn = document.getElementById("btnDescargarRenta");
  const breakdown = document.getElementById("rentaBreakdown");

  resultado.style.display = "block";
  document.getElementById("rentaBase").textContent = formatoCOP(baseGravable);
  document.getElementById("rentaImpuesto").textContent = formatoCOP(impuestoEstimado);
  document.getElementById("rentaSaldo").textContent = formatoCOP(saldo);

  if (superaIngresos || superaPatrimonio) {
    mensaje.textContent = "Por tus cifras, vale la pena revisar con calma si estás obligado a declarar en Colombia. La simulación sugiere que podrías entrar en rangos que merecen validación.";
    chip.className = "renta-chip warning";
    chip.textContent = "Revisión recomendada";
  } else if (saldo > 0) {
    mensaje.textContent = "Con esta proyección, podrías tener un valor aproximado por pagar. Revísalo con soportes y con tu contador antes de tomar decisiones.";
    chip.className = "renta-chip info";
    chip.textContent = "Posible saldo por pagar";
  } else {
    mensaje.textContent = "Con esta proyección, podrías no tener un saldo importante por pagar o incluso compensar parte con retenciones. Igual conviene validarlo.";
    chip.className = "renta-chip success";
    chip.textContent = "Escenario favorable";
  }

  if (breakdown) {
    breakdown.innerHTML = `
      <div class="renta-breakdown-item">
        <strong>1. Obligación de revisar</strong>
        <span>${superaIngresos || superaPatrimonio ? "Tus cifras superan al menos una referencia clave para revisar la obligación de declarar." : "Tus cifras no superan las referencias principales usadas aquí, aunque sigue siendo una simulación orientativa."}</span>
      </div>
      <div class="renta-breakdown-item">
        <strong>2. Base gravable estimada</strong>
        <span>Se tomó ${formatoCOP(ingresos)} en ingresos y se restaron ${formatoCOP(deducciones)} en deducciones para estimar una base de ${formatoCOP(baseGravable)}.</span>
      </div>
      <div class="renta-breakdown-item">
        <strong>3. Tarifa aplicada</strong>
        <span>${tarifa > 0 ? `Para esta simulación se aplicó una tarifa aproximada del ${(tarifa * 100).toFixed(0)}%.` : "La base calculada quedó en un tramo sin tarifa estimada en esta versión simplificada."}</span>
      </div>
      <div class="renta-breakdown-item">
        <strong>4. Retenciones y saldo</strong>
        <span>Al impuesto estimado de ${formatoCOP(impuestoEstimado)} se le descuentan ${formatoCOP(retenciones)} en retenciones para proyectar un saldo de ${formatoCOP(saldo)}.</span>
      </div>
    `;
  }

  ultimaSimulacionRenta = {
    fecha: new Date(),
    ingresos,
    patrimonio,
    deducciones,
    retenciones,
    baseGravable,
    impuestoEstimado,
    saldo,
    mensaje: mensaje.textContent,
    estado: chip.textContent
  };

  if (downloadBtn) {
    downloadBtn.style.display = "inline-flex";
  }

  showToast("Simulación actualizada. Úsala como guía y valida el cálculo con soportes reales.", "info");
}

async function descargarRentaPDF() {
  if (!ultimaSimulacionRenta) {
    alert("Primero realiza la simulación de renta.");
    return;
  }

  const jsPDFLib = window.jspdf?.jsPDF;
  if (!jsPDFLib) {
    alert("No se pudo cargar la librería para generar el PDF.");
    return;
  }

  try {
    const doc = new jsPDFLib();
    const simulacion = ultimaSimulacionRenta;
    const fechaGeneracion = simulacion.fecha.toLocaleString(localeActual);
    const lineas = [
      ["Fecha de generación", fechaGeneracion],
      ["Usuario", usuario?.nombre || "Usuario"],
      ["Correo", usuario?.correo || "Sin correo"],
      ["Ingresos anuales", formatoCOP(simulacion.ingresos)],
      ["Patrimonio bruto", formatoCOP(simulacion.patrimonio)],
      ["Deducciones estimadas", formatoCOP(simulacion.deducciones)],
      ["Retenciones", formatoCOP(simulacion.retenciones)],
      ["Base gravable", formatoCOP(simulacion.baseGravable)],
      ["Impuesto estimado", formatoCOP(simulacion.impuestoEstimado)],
      ["Saldo estimado", formatoCOP(simulacion.saldo)],
      ["Estado", simulacion.estado]
    ];

    await addPdfBrandHeader(
      doc,
      "Simulación de renta",
      "Reporte orientativo para declaración de renta en Colombia."
    );

    let y = 68;
    doc.setFontSize(11);
    lineas.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 72, y);
      y += 8;
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Conclusión", 14, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    const mensajeLineas = doc.splitTextToSize(simulacion.mensaje, 180);
    doc.text(mensajeLineas, 14, y);
    y += mensajeLineas.length * 7 + 8;

    const nota = "Este documento es una simulación orientativa y no reemplaza la revisión de un contador ni una declaración oficial ante la DIAN.";
    const notaLineas = doc.splitTextToSize(nota, 180);
    doc.setFontSize(10);
    doc.text(notaLineas, 14, y);

    const fechaArchivo = simulacion.fecha.toISOString().slice(0, 10);
    await savePdfDocument(doc, `dinamicash-renta-${fechaArchivo}.pdf`);
  } catch (error) {
    console.error(error);
    alert("No se pudo generar o guardar el PDF.");
  }
}

function editarPerfil() {
  document.getElementById("editarNombre").value = usuario?.nombre || "";
  document.getElementById("editarCorreo").value = usuario?.correo || "";
  openModal("modalEditarPerfil");
}

async function guardarPerfil() {
  const nombre = document.getElementById("editarNombre").value.trim();
  const correo = document.getElementById("editarCorreo").value.trim().toLowerCase();

  if (!nombre || !correo) {
    alert(tx("profileNameRequired"));
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/usuarios/${usuario.id_usuario}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, correo })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.mensaje || tx("profileNameRequired"));
      return;
    }

    usuario.nombre = data.usuario.nombre;
    usuario.correo = data.usuario.correo;
    configurarPerfil();
    showBanner("perfilBanner", data.mensaje || tx("profileSaved"));
    setTimeout(() => cerrarModalGenerico("modalEditarPerfil"), 900);
  } catch (error) {
    console.error(error);
    alert("No se pudo actualizar el perfil");
  }
}

function verNotificaciones() {
  const config = getNotifications();
  document.getElementById("notifMetas").checked = config.metas;
  document.getElementById("notifResumen").checked = config.resumen;
  document.getElementById("notifSeguridad").checked = config.seguridad;
  updateNotificationSummary();
  openModal("modalNotificaciones");
}

function guardarNotificaciones() {
  const config = {
    metas: document.getElementById("notifMetas").checked,
    resumen: document.getElementById("notifResumen").checked,
    seguridad: document.getElementById("notifSeguridad").checked
  };
  saveNotifications(config);
  updateNotificationSummary();
  showBanner("notificacionesResumen", tx("notificationsSaved"));
  setTimeout(() => cerrarModalGenerico("modalNotificaciones"), 900);
}

function verSeguridad() {
  document.getElementById("passwordActual").value = "";
  document.getElementById("passwordNueva").value = "";
  document.getElementById("passwordConfirmacion").value = "";
  openModal("modalSeguridad");
}

async function guardarSeguridad() {
  const passwordActual = document.getElementById("passwordActual").value;
  const passwordNueva = document.getElementById("passwordNueva").value;
  const passwordConfirmacion = document.getElementById("passwordConfirmacion").value;

  if (!passwordActual || !passwordNueva || !passwordConfirmacion) {
    alert(tx("securityRequired"));
    return;
  }

  if (passwordNueva !== passwordConfirmacion) {
    alert(tx("securityMatch"));
    return;
  }

  if (!/^\d{4}$/.test(passwordActual) || !/^\d{4}$/.test(passwordNueva)) {
    alert(tx("securityPinInvalid"));
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/usuarios/${usuario.id_usuario}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordActual, passwordNueva })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.mensaje || "No se pudo actualizar el PIN");
      return;
    }

    showBanner("seguridadBanner", data.mensaje || tx("passwordSaved"));
    setTimeout(() => cerrarModalGenerico("modalSeguridad"), 900);
  } catch (error) {
    console.error(error);
    alert("No se pudo actualizar el PIN");
  }
}

function abrirConfiguracion() {
  const config = getConfig();
  document.getElementById("configTema").value = config.theme;
  document.getElementById("configIdioma").value = config.language;
  const apiInput = document.getElementById("configApiUrl");
  if (apiInput) {
    apiInput.value = window.DinamicashApi?.getSavedApiUrl?.() || "";
  }
  openModal("modalConfiguracion");
}

function guardarConfiguracion() {
  const config = {
    theme: document.getElementById("configTema").value,
    language: document.getElementById("configIdioma").value
  };

  saveConfig(config);
  const apiInput = document.getElementById("configApiUrl");
  if (apiInput) {
    const apiValue = apiInput.value.trim();
    if (apiValue && !/^https?:\/\/[^/]+/i.test(apiValue)) {
      alert("Escribe una URL valida para el backend, por ejemplo https://api.tu-dominio.com");
      return;
    }
    window.DinamicashApi?.saveApiUrl?.(apiValue);
    API_URL = window.DinamicashApi?.getBaseUrl?.() || API_URL;
  }
  applyPreferences();
  cargar();
  cargarMetas();
  cargarCategorias();
  showBanner("configBanner", tx("settingsSaved"));
}

function ayuda() {
  document.getElementById("ayudaCorreo").value = usuario?.correo || "";
  openModal("modalAyuda");
}

async function enviarAyuda() {
  const asunto = document.getElementById("ayudaAsunto").value;
  const mensaje = document.getElementById("ayudaMensaje").value.trim();

  if (!mensaje) {
    alert(tx("helpRequired"));
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/ayuda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asunto,
        mensaje
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.mensaje || "No se pudo enviar la solicitud");
      return;
    }

    document.getElementById("ayudaMensaje").value = "";
    showBanner("ayudaBanner", data.mensaje || tx("helpSaved"));
    setTimeout(() => cerrarModalGenerico("modalAyuda"), 900);
  } catch (error) {
    console.error(error);
    alert("No se pudo enviar la solicitud");
  }
}

async function logout(options = {}) {
  const { skipConfirm = false } = options || {};
  if (!skipConfirm) {
    const confirmar = confirm(tx("logoutConfirm"));
    if (!confirmar) return;
  }

  clearTimeout(inactivityTimerId);
  resetWalleConversationForUser();

  try {
    await apiFetch(`${API_URL}/auth/logout`, {
      method: "POST",
      redirectOnAuthFailure: false
    });
  } catch (error) {
    console.error(error);
  }

  window.location = "login.html";
}

function mostrar(id) {
  cerrarFabMenu();
  cerrarModalGenerico("modalWalleChat");
  const pantalla = document.getElementById(id);
  if (!pantalla) return;
  document.querySelectorAll(".pantalla").forEach((p) => p.classList.remove("activa"));
  pantalla.classList.add("activa");
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.toggle("activo", item.dataset.target === id);
  });

  if (id === "reportes") cargarReportes();
  if (id === "metas") cargarMetas();
}

function prepararGuiaUsuario() {
  const prevBtn = document.getElementById("onboardingPrev");
  const nextBtn = document.getElementById("onboardingNext");
  const skipBtn = document.getElementById("onboardingSkip");

  if (prevBtn) prevBtn.addEventListener("click", avanzarGuiaUsuarioAtras);
  if (nextBtn) nextBtn.addEventListener("click", avanzarGuiaUsuario);
  if (skipBtn) skipBtn.addEventListener("click", () => cerrarGuiaUsuario(true));

  window.addEventListener("resize", () => {
    if (onboardingState.active) {
      actualizarMarcoGuia();
      posicionarGuiaUsuario();
    }
  });
  window.addEventListener("scroll", () => {
    if (onboardingState.active) {
      actualizarMarcoGuia();
      posicionarGuiaUsuario();
    }
  }, { passive: true });
}

function iniciarGuiaUsuario(forzar = false) {
  if (!forzar && localStorage.getItem(storageKey(STORAGE_KEYS.onboardingSeen)) === "1") {
    return;
  }

  onboardingState.steps = onboardingText().steps;
  onboardingState.currentStep = 0;
  onboardingState.active = true;

  const layer = document.getElementById("onboardingLayer");
  if (layer) layer.hidden = false;

  renderOnboardingStep();
}

function avanzarGuiaUsuario() {
  if (!onboardingState.active) return;

  if (onboardingState.currentStep >= onboardingState.steps.length - 1) {
    cerrarGuiaUsuario(true);
    return;
  }

  onboardingState.currentStep += 1;
  renderOnboardingStep();
}

function avanzarGuiaUsuarioAtras() {
  if (!onboardingState.active || onboardingState.currentStep === 0) return;
  onboardingState.currentStep -= 1;
  renderOnboardingStep();
}

function cerrarGuiaUsuario(markSeen = false) {
  onboardingState.active = false;
  clearTimeout(onboardingState.renderTimeoutId);
  onboardingState.requestId += 1;
  limpiarResaltadoGuia();

  const layer = document.getElementById("onboardingLayer");
  if (layer) layer.hidden = true;

  if (markSeen) {
    localStorage.setItem(storageKey(STORAGE_KEYS.onboardingSeen), "1");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement(selector, options = {}) {
  const {
    attempts = 18,
    interval = 140
  } = options;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await delay(interval);
  }

  console.warn(`[Onboarding] No se encontró el elemento: ${selector}`);
  return null;
}

async function renderOnboardingStep() {
  if (!onboardingState.active) return;
  const requestId = ++onboardingState.requestId;

  const copy = onboardingText();
  const step = onboardingState.steps[onboardingState.currentStep];
  if (!step) {
    cerrarGuiaUsuario(true);
    return;
  }

  clearTimeout(onboardingState.renderTimeoutId);
  limpiarResaltadoGuia();
  cerrarTodosLosModales();

  if (step.screen) {
    mostrar(step.screen);
  }

  const title = document.getElementById("onboardingTitle");
  const body = document.getElementById("onboardingBody");
  const kicker = document.getElementById("onboardingKicker");
  const progress = document.getElementById("onboardingProgress");
  const prevBtn = document.getElementById("onboardingPrev");
  const nextBtn = document.getElementById("onboardingNext");
  const skipBtn = document.getElementById("onboardingSkip");

  if (title) title.textContent = step.title;
  if (body) body.textContent = step.body;
  if (kicker) kicker.textContent = copy.kicker;
  if (progress) {
    progress.textContent = copy.progress
      .replace("{current}", onboardingState.currentStep + 1)
      .replace("{total}", onboardingState.steps.length);
  }
  if (prevBtn) {
    prevBtn.textContent = copy.previous;
    prevBtn.style.visibility = onboardingState.currentStep === 0 ? "hidden" : "visible";
  }
  if (nextBtn) {
    nextBtn.textContent = onboardingState.currentStep === onboardingState.steps.length - 1
      ? copy.finish
      : copy.next;
  }
  if (skipBtn) skipBtn.textContent = copy.skip;
  window.WalleController?.syncOnboarding(step);

  await delay(80);
  if (!onboardingState.active || onboardingState.requestId !== requestId) return;

  const target = step.selector ? await waitForElement(step.selector) : null;
  if (!onboardingState.active || onboardingState.requestId !== requestId) return;

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    await delay(280);
    if (!onboardingState.active || onboardingState.requestId !== requestId) return;
    destacarElementoGuia(target);
    posicionarGuiaUsuario(target);
    return;
  }

  posicionarGuiaUsuario(null);
}

function cerrarTodosLosModales() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
    modal.classList.remove("is-open");
  });
  syncBodyModalState();
  volverAMovimiento = false;
}

function destacarElementoGuia(element) {
  limpiarResaltadoGuia();
  onboardingState.highlightedElement = element;
  if (element) {
    element.classList.add("onboarding-focus-target");
  }
  actualizarMarcoGuia(element);
}

function actualizarMarcoGuia(element = onboardingState.highlightedElement) {
  const highlight = document.getElementById("onboardingHighlight");
  if (!highlight) return;

  if (!element) {
    highlight.hidden = true;
    highlight.style.width = "0px";
    highlight.style.height = "0px";
    return;
  }

  const rect = element.getBoundingClientRect();
  const padding = window.innerWidth <= 640 ? 6 : 8;
  highlight.hidden = false;
  highlight.style.left = `${Math.max(6, rect.left - padding)}px`;
  highlight.style.top = `${Math.max(6, rect.top - padding)}px`;
  highlight.style.width = `${Math.min(window.innerWidth - 12, rect.width + (padding * 2))}px`;
  highlight.style.height = `${Math.min(window.innerHeight - 12, rect.height + (padding * 2))}px`;
}

function limpiarResaltadoGuia() {
  if (onboardingState.highlightedElement) {
    onboardingState.highlightedElement.classList.remove("onboarding-focus-target");
  }

  const highlight = document.getElementById("onboardingHighlight");
  if (highlight) {
    highlight.hidden = true;
    highlight.style.width = "0px";
    highlight.style.height = "0px";
  }

  onboardingState.highlightedElement = null;
}

function posicionarGuiaUsuario(target = onboardingState.highlightedElement) {
  const card = document.getElementById("onboardingCard");
  if (!card) return;

  actualizarMarcoGuia(target);

  card.dataset.placement = "center";
  card.style.left = "";
  card.style.top = "";
  card.style.bottom = "";
  card.style.setProperty("--arrow-left", "50%");

  const padding = 12;

  if (window.innerWidth <= 640) {
    card.style.left = "10px";
    card.style.right = "10px";
    card.style.top = "auto";
    card.style.bottom = "calc(12px + env(safe-area-inset-bottom, 0px))";
    card.dataset.placement = "center";
    return;
  }

  card.style.right = "";

  if (!target) {
    const cardWidth = Math.min(340, window.innerWidth - (padding * 2));
    const left = Math.max(padding, (window.innerWidth - cardWidth) / 2);
    const top = Math.max(24, (window.innerHeight - card.offsetHeight) / 2);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    return;
  }

  const rect = target.getBoundingClientRect();
  const gap = 24;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  const maxLeft = window.innerWidth - cardWidth - padding;
  const maxTop = window.innerHeight - cardHeight - 16;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const intersects = (a, b) => !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );

  const candidates = [
    {
      placement: "bottom",
      left: clamp(rect.left + (rect.width / 2) - (cardWidth / 2), padding, maxLeft),
      top: rect.bottom + gap
    },
    {
      placement: "top",
      left: clamp(rect.left + (rect.width / 2) - (cardWidth / 2), padding, maxLeft),
      top: rect.top - cardHeight - gap
    },
    {
      placement: "right",
      left: rect.right + gap,
      top: clamp(rect.top + (rect.height / 2) - (cardHeight / 2), 16, maxTop)
    },
    {
      placement: "left",
      left: rect.left - cardWidth - gap,
      top: clamp(rect.top + (rect.height / 2) - (cardHeight / 2), 16, maxTop)
    }
  ];

  const visibleCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      left: clamp(candidate.left, padding, maxLeft),
      top: clamp(candidate.top, 16, maxTop)
    }))
    .filter((candidate) => {
      const candidateRect = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + cardWidth,
        bottom: candidate.top + cardHeight
      };
      return !intersects(candidateRect, rect);
    });

  const selected = visibleCandidates[0] || {
    placement: "center",
    left: clamp(window.innerWidth - cardWidth - 24, padding, maxLeft),
    top: 24
  };

  const arrowLeft = Math.min(
    Math.max(28, rect.left + (rect.width / 2) - selected.left),
    cardWidth - 28
  );

  card.dataset.placement = selected.placement === "top" || selected.placement === "bottom"
    ? selected.placement
    : "center";
  card.style.left = `${selected.left}px`;
  card.style.top = `${selected.top}px`;
  card.style.setProperty("--arrow-left", `${arrowLeft}px`);
}
