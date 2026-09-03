from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


OUT = Path(__file__).resolve().parent / "AVANCE-PROYECTO-SENA-DINAMICASH.pdf"


def p(text, style):
    return Paragraph(text, style)


def table(data, widths, header=True):
    cell = ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=8.8,
        leading=11,
        spaceAfter=0,
    )
    cell_header = ParagraphStyle(
        "TableHeader",
        parent=cell,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1F4D78"),
    )
    wrapped = []
    for row_index, row in enumerate(data):
        style = cell_header if header and row_index == 0 else cell
        wrapped.append([Paragraph(escape(str(value)), style) for value in row])

    t = Table(wrapped, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C9D3DF")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.8),
    ]
    if header:
        style.extend([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1F4D78")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ])
    t.setStyle(TableStyle(style))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(inch, 0.55 * inch, "Dinamicash Wallet - Proyecto formativo SENA")
    canvas.drawRightString(7.5 * inch, 0.55 * inch, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleCustom",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=23,
        leading=28,
        alignment=TA_LEFT,
        spaceAfter=4,
        textColor=colors.black,
    )
    subtitle = ParagraphStyle(
        "SubtitleCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=15,
        spaceAfter=14,
        textColor=colors.HexColor("#555555"),
    )
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor("#2E74B5"),
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.8,
        leading=13,
        spaceAfter=6,
    )
    bullet = ParagraphStyle(
        "Bullet",
        parent=body,
        leftIndent=15,
        bulletIndent=5,
        spaceAfter=4,
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )

    story = []
    story.append(p("Informe de avance del proyecto", title))
    story.append(p("Dinamicash Wallet - Revision tecnica de avance", subtitle))
    story.append(table([
        ["Campo", "Detalle"],
        ["Proyecto", "Dinamicash Wallet"],
        ["Aprendiz", "Sebastian Andres Castaneda Panqueva"],
        ["Programa", "Analisis y Desarrollo de Software - SENA"],
        ["Tipo de entrega", "Revision de avance, no entrega final"],
        ["Fecha de preparacion", "31 de agosto de 2026"],
        ["Repositorio", "https://github.com/SEBASPAC17/mi-proyecto-sena.git"],
    ], [1.85 * inch, 4.65 * inch]))

    story.append(p("1. Resumen del proyecto", h1))
    story.append(p("Dinamicash Wallet es una aplicacion web para la gestion de finanzas personales. Permite registrar ingresos, gastos, categorias, metas de ahorro y consultar reportes financieros.", body))
    story.append(p("En el avance actual implemente una arquitectura cliente-servidor con frontend en HTML, CSS y JavaScript, backend en Node.js con Express y persistencia de datos en MySQL.", body))

    story.append(p("2. Objetivo del avance", h1))
    story.append(p("Presentar los modulos funcionales que he desarrollado hasta la fecha y evidenciar que el aplicativo cuenta con versionamiento en GitHub, conexion a base de datos, autenticacion, API REST y pruebas basicas con Postman.", body))

    story.append(p("3. Tecnologias utilizadas", h1))
    story.append(table([
        ["Area", "Tecnologias / evidencia"],
        ["Frontend", "HTML5, CSS3, JavaScript, Chart.js, jsPDF"],
        ["Backend", "Node.js, Express"],
        ["Base de datos", "MySQL, base local llamada dinamicash"],
        ["Seguridad", "bcryptjs, cookies de sesion, validacion de correo, bloqueo por intentos"],
        ["Pruebas", "Postman para endpoints y pruebas automatizadas en Node.js"],
        ["Versionamiento", "Git y GitHub"],
    ], [1.6 * inch, 4.9 * inch]))

    story.append(p("4. Modulos desarrollados", h1))
    for item in [
        "Registro de usuarios con validacion de datos.",
        "Inicio de sesion con PIN y sesion persistente.",
        "Verificacion de correo y recuperacion de PIN.",
        "Dashboard principal con resumen financiero.",
        "Gestion de movimientos: ingresos y gastos.",
        "Gestion de categorias y metas de ahorro.",
        "Reportes por periodo, tipo y categoria.",
        "Auditoria de eventos sensibles en la base de datos.",
        "Preparacion de APK Android mediante Capacitor.",
    ]:
        story.append(Paragraph(item, bullet, bulletText="-"))

    story.append(p("5. Base de datos de prueba", h1))
    story.append(p("La base de datos de prueba se llama dinamicash y esta implementada en MySQL. Contiene tablas para usuarios, categorias, movimientos, metas, tokens de correo, sesiones, tokens biometricos y auditoria.", body))
    story.append(table([
        ["Elemento", "Detalle"],
        ["Usuario demo", "demo.sena@dinamicash.com"],
        ["PIN demo", "1234"],
        ["Estado", "Usuario verificado y con autorizacion de datos"],
        ["Movimientos guardados", "6 registros de ingresos y gastos"],
        ["Metas guardadas", "2 metas de ahorro"],
        ["Tablas principales", "usuarios, categorias, movimientos, metas, user_sessions, audit_logs"],
    ], [1.85 * inch, 4.65 * inch]))

    story.append(PageBreak())
    story.append(p("6. Pruebas realizadas", h1))
    story.append(p("Realice pruebas en Postman para validar que el backend responde correctamente y que los datos se consultan desde MySQL.", body))
    story.append(table([
        ["Endpoint", "Validacion", "Resultado"],
        ["POST /login", "Valida el ingreso del usuario demo", "200 OK"],
        ["GET /auth/session", "Comprueba la sesion activa", "200 OK"],
        ["GET /movimientos/1", "Lista movimientos guardados en la base de datos", "200 OK"],
        ["GET /metas/1", "Lista metas guardadas en la base de datos", "200 OK"],
        ["GET /reportes/1 (agosto 2026)", "Genera reporte con datos del periodo", "200 OK esperado"],
    ], [1.8 * inch, 3.45 * inch, 1.25 * inch]))

    story.append(p("7. Evidencias disponibles", h1))
    story.append(table([
        ["Evidencia", "Descripcion"],
        ["GitHub", "Repositorio publico con commit visible: Avance proyecto SENA."],
        ["Aplicativo local", "Lo ejecute en http://localhost:3000/frontend/login.html."],
        ["Base de datos", "Consulta directa a MySQL con tablas y registros demo."],
        ["Postman", "Pruebas de login y consulta de movimientos con respuesta 200 OK."],
        ["Codigo fuente", "Carpetas frontend, backend, docs y configuracion Android."],
    ], [1.55 * inch, 4.95 * inch]))

    story.append(p("8. Lista de chequeo de avance", h1))
    story.append(table([
        ["Item", "Estado", "Observacion"],
        ["Versionamiento Git/GitHub", "Realizado", "Repositorio conectado y commit de avance visible."],
        ["Frontend funcional", "Realizado", "Pantallas de login, registro y dashboard disponibles."],
        ["Backend/API REST", "Realizado", "Endpoints de login, movimientos, metas y reportes."],
        ["Base de datos MySQL", "Realizado", "Base dinamicash con datos demo guardados."],
        ["Pruebas Postman", "Realizado", "Login y consulta de movimientos validados."],
        ["Datos de prueba", "Realizado", "Usuario demo con movimientos y metas."],
        ["Documento de avance", "Realizado", "Este informe consolida el estado del proyecto."],
        ["Entrega final", "Pendiente", "Ajustes finales, documentacion completa y validaciones ampliadas."],
    ], [2.15 * inch, 1.15 * inch, 3.2 * inch]))

    story.append(p("9. Pendientes y siguientes pasos", h1))
    for item in [
        "Tomar capturas de evidencia para anexar o mostrar durante la revision.",
        "Organizar capturas y anexos de evidencia en caso de que sean solicitados durante la revision.",
        "Completar pruebas adicionales de endpoints si se solicita mayor evidencia tecnica.",
        "Pulir documentacion final y preparar sustentacion completa para la entrega definitiva.",
        "Corregir la configuracion del servicio MySQL96 de Windows, que actualmente apunta a un my.ini inexistente.",
    ]:
        story.append(Paragraph(item, bullet, bulletText="-"))

    story.append(p("10. Guion corto para la revision", h1))
    story.append(p("Dinamicash Wallet es una aplicacion de finanzas personales. En este avance presento que el sistema ya permite iniciar sesion, guardar movimientos y metas, consultar reportes y persistir datos en MySQL. Tambien se demuestra el versionamiento en GitHub y pruebas de API en Postman.", body))
    story.append(p("Durante la revision voy a mostrar primero el aplicativo, luego GitHub, despues Postman y por ultimo la consulta directa de la base de datos.", body))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()
    print(OUT)
