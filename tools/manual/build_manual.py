# -*- coding: utf-8 -*-
"""Construye el Manual de usuario (DOCX) del simulador Stop & Wait v2."""
import os, sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ANN = sys.argv[1]     # figuras anotadas
SHOTS = sys.argv[2]   # capturas de escenarios
OUT = sys.argv[3]

doc = Document()

# ---------- estilos base ----------
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin, sec.bottom_margin = Cm(2.2), Cm(2.0)
USABLE = 21.0 - 4.4

st = doc.styles["Normal"]
st.font.name = "Calibri"
st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.12

INK = RGBColor(0x1F, 0x1F, 0x1F)
ACCENT = RGBColor(0xB2, 0x26, 0x1E)
SOFT = RGBColor(0x5A, 0x5A, 0x5A)
for name, size, color in (("Heading 1", 20, INK), ("Heading 2", 15, INK), ("Heading 3", 12.5, ACCENT)):
    h = doc.styles[name]
    h.font.name = "Calibri"
    h.font.size = Pt(size)
    h.font.bold = True
    h.font.color.rgb = color
    h.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    h.paragraph_format.space_before = Pt(18 if name == "Heading 1" else 12)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True

FIG_N = [0]


def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def cell_border(cell, color="B2261E", sz=12, side="left"):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for s in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{s}")
        if s == side:
            el.set(qn("w:val"), "single"); el.set(qn("w:sz"), str(sz)); el.set(qn("w:color"), color)
        else:
            el.set(qn("w:val"), "nil")
        borders.append(el)
    tcPr.append(borders)


def h1(t): return doc.add_heading(t, level=1)
def h2(t): return doc.add_heading(t, level=2)
def h3(t): return doc.add_heading(t, level=3)


def para(text, bold_lead=None, italic=False, align=None, size=None, color=None, after=None):
    p = doc.add_paragraph()
    if bold_lead:
        r = p.add_run(bold_lead); r.bold = True
    r = p.add_run(text); r.italic = italic
    if size: r.font.size = Pt(size)
    if color: r.font.color.rgb = color
    if align: p.alignment = align
    if after is not None: p.paragraph_format.space_after = Pt(after)
    return p


def rich(parts, style=None):
    """parts: lista de (texto, {'b':1,'i':1,'mono':1})"""
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    for t, f in parts:
        r = p.add_run(t)
        r.bold = bool(f.get("b")); r.italic = bool(f.get("i"))
        if f.get("mono"):
            r.font.name = "Consolas"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas"); r.font.size = Pt(10)
    return p


def bullet(text, lead=None):
    p = doc.add_paragraph(style="List Bullet")
    if lead:
        r = p.add_run(lead); r.bold = True
    p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p


def numbered(text, lead=None):
    p = doc.add_paragraph(style="List Number")
    if lead:
        r = p.add_run(lead); r.bold = True
    p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p


def formula(text, note=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.font.name = "Cambria Math"; r._element.rPr.rFonts.set(qn("w:eastAsia"), "Cambria Math")
    r.font.size = Pt(12.5)
    p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(4)
    if note:
        q = doc.add_paragraph(); q.alignment = WD_ALIGN_PARAGRAPH.CENTER
        rr = q.add_run(note); rr.italic = True; rr.font.size = Pt(9.5); rr.font.color.rgb = SOFT
        q.paragraph_format.space_after = Pt(6)
    return p


def fig(path, caption, width_cm=None, source=ANN):
    FIG_N[0] += 1
    full = os.path.join(source, path)
    from PIL import Image
    im = Image.open(full)
    ratio = im.height / im.width
    if width_cm is None:
        width_cm = USABLE if ratio < 1.0 else min(USABLE, 22.5 / ratio)
    width_cm = min(width_cm, USABLE)
    if width_cm * ratio > 23.0:
        width_cm = 23.0 / ratio
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(full, width=Cm(width_cm))
    c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = c.add_run(f"Figura {FIG_N[0]}. "); r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = SOFT
    r = c.add_run(caption); r.font.size = Pt(9.5); r.font.color.rgb = SOFT
    c.paragraph_format.space_after = Pt(10)
    return FIG_N[0]


def items(rows, head=("N.º", "Elemento", "Qué hace y qué afecta")):
    """Tabla de anotaciones: [(n, nombre, explicación)]"""
    t = doc.add_table(rows=1, cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = "Table Grid"
    t.autofit = False
    widths = (Cm(1.1), Cm(4.2), Cm(USABLE - 5.3))
    for i, wcol in enumerate(widths):
        t.columns[i].width = wcol
    for i, h in enumerate(head):
        c = t.rows[0].cells[i]; c.width = widths[i]
        c.text = ""; r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(10)
        shade(c, "F2F2F2")
    for n, name, desc in rows:
        row = t.add_row().cells
        for i, val in enumerate((str(n), name, desc)):
            row[i].width = widths[i]
            row[i].text = ""
            pr = row[i].paragraphs[0]
            r = pr.add_run(val); r.font.size = Pt(10)
            if i == 0: r.bold = True; r.font.color.rgb = ACCENT; pr.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if i == 1: r.bold = True
            pr.paragraph_format.space_after = Pt(2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def box(kind, title, lines):
    """Caja lateral: kind = 'paso' (azul), 'fuente' (verde), 'cuidado' (rojo), 'nota' (gris)."""
    colors = {"paso": ("EAF1FB", "2F5D9E"), "fuente": ("EAF5EC", "2E7D4F"), "cuidado": ("FBECEB", "B2261E"), "nota": ("F3F3F3", "666666")}
    fill, bar = colors[kind]
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.rows[0].cells[0]; c.width = Cm(USABLE)
    shade(c, fill); cell_border(c, bar, 24, "left")
    c.text = ""
    p = c.paragraphs[0]
    r = p.add_run(title.upper()); r.bold = True; r.font.size = Pt(9); r.font.color.rgb = RGBColor.from_string(bar)
    p.paragraph_format.space_after = Pt(2)
    for ln in lines:
        q = c.add_paragraph()
        if isinstance(ln, tuple):
            rr = q.add_run(ln[0]); rr.bold = True; rr.font.size = Pt(10)
            rr = q.add_run(ln[1]); rr.font.size = Pt(10)
        else:
            rr = q.add_run(ln); rr.font.size = Pt(10)
        q.paragraph_format.space_after = Pt(2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# =====================================================================
# PORTADA (blanca)
# =====================================================================
for _ in range(7):
    doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = p.add_run("MANUAL DE USUARIO"); r.font.size = Pt(12); r.bold = True; r.font.color.rgb = ACCENT
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = p.add_run("Simulador Stop & Wait"); r.font.size = Pt(38); r.bold = True; r.font.color.rgb = INK
p.paragraph_format.space_after = Pt(4)
p = doc.add_paragraph()
r = p.add_run("Simulador y calculadora de enlace del protocolo de parada y espera"); r.font.size = Pt(15); r.font.color.rgb = SOFT
p.paragraph_format.space_after = Pt(36)
p = doc.add_paragraph()
r = p.add_run("Parte 1 · Interfaz — cada componente, qué hace y qué afecta\nParte 2 · Funcionamiento — tutorial con fundamento teórico y fórmulas"); r.font.size = Pt(11.5)
for _ in range(9):
    doc.add_paragraph()
p = doc.add_paragraph()
r = p.add_run("Redes de computadoras\nVersión 1.0 · 13 de septiembre de 2026"); r.font.size = Pt(11); r.font.color.rgb = SOFT
p = doc.add_paragraph()
r = p.add_run("Base teórica: Tanenbaum & Wetherall, Redes de computadoras, 5.ª ed., capítulo 3."); r.font.size = Pt(9.5); r.font.color.rgb = SOFT
page_break()

# =====================================================================
# CONTENIDO
# =====================================================================
h1("Contenido")
TOC = [
    ("Parte 1 — Interfaz", None),
    ("1.1 El simulador", ["Vista general", "Cabecera", "Panel de control", "Diagrama tiempo–espacio y leyenda", "Cadena del camino",
                          "Trama en el canal (inspector)", "CRC paso a paso", "Protocolo", "Camino", "Telemetría", "Qué ha pasado (bitácora)"]),
    ("1.2 La calculadora de enlace", ["Vista general", "Datos y camino", "Cómo se han leído los datos", "Resultado", "Desarrollo",
                                      "Ráfaga de ruido", "Transferencia de un fichero completo", "Avisos y errores"]),
    ("Parte 2 — Funcionamiento", None),
    ("2.1 Un ciclo del protocolo: tiempos, RTT y utilización", None),
    ("2.2 El número de secuencia y la alternancia 0/1", None),
    ("2.3 Detección de errores: el CRC", None),
    ("2.4 Trama dañada sin NAK: el temporizador la rescata", None),
    ("2.5 Trama dañada con NAK: recuperación inmediata", None),
    ("2.6 Trama destruida en el canal", None),
    ("2.7 Confirmación retrasada y duplicados", None),
    ("2.8 Forzar el número de secuencia", None),
    ("2.9 Un temporizador demasiado corto", None),
    ("2.10 Canal half duplex", None),
    ("2.11 Ráfaga de ruido", None),
    ("2.12 Camino de varios saltos", None),
    ("2.13 La calculadora, paso a paso: el satélite de Tanenbaum", None),
    ("2.14 Los otros ejemplos: LAN y casa → satélite → casa", None),
    ("2.15 Ráfaga y transferencia en la calculadora", None),
]
for t, subs in TOC:
    p = doc.add_paragraph(); r = p.add_run(t); r.bold = bool(t.startswith("Parte") or subs)
    p.paragraph_format.space_after = Pt(2)
    if subs:
        for s in subs:
            q = doc.add_paragraph(); q.paragraph_format.left_indent = Cm(1.0); q.paragraph_format.space_after = Pt(0)
            q.add_run(s).font.size = Pt(10.5)
page_break()

# =====================================================================
# PARTE 1 — INTERFAZ
# =====================================================================
h1("Parte 1 — Interfaz")
para("La aplicación tiene dos páginas. El simulador (index.html) anima el protocolo sobre un diagrama tiempo–espacio y "
     "deja meter fallos a mano. La calculadora de enlace (calculadora.html) hace los mismos cálculos sin animación y "
     "enseña el desarrollo paso a paso. Se pasa de una a otra con el enlace de la cabecera.")
box("paso", "Cómo abrir la aplicación", [
    "1. Servir la carpeta simulador_stop_and_wait_v2 (por ejemplo: python -m http.server 8000 --directory simulador_stop_and_wait_v2).",
    "2. Abrir http://localhost:8000 en el navegador. No hace falta instalar nada.",
    "3. Abrir index.html con doble clic también funciona para mirar, pero el navegador aplica restricciones con file:// que no reflejan el despliegue real.",
])

# ---------------- 1.1 Simulador ----------------
h2("1.1 El simulador")

h3("Vista general")
fig("A01-vista-general.png", "El simulador nada más abrirse: cabecera, diagrama, cadena del camino y panel lateral.")
items([
    (1, "Cabecera", "Título, subtítulo con el protocolo que se simula, enlace a la calculadora y el interruptor de fondo oscuro."),
    (2, "Diagrama tiempo–espacio", "El dibujo principal. El tiempo baja; cada línea vertical es un punto del camino (A, B y los intermedios). Aquí se ven viajar tramas y confirmaciones."),
    (3, "Cadena del camino", "Esquema horizontal del camino: nodos y, entre ellos, la distancia y la velocidad de transmisión de cada tramo. Es un resumen del bloque Camino."),
    (4, "Panel lateral", "Todos los controles y lecturas, en bloques de arriba abajo: control, trama en el canal, protocolo, camino, telemetría, bitácora y leyenda. Se desplaza con la rueda del ratón."),
])

h3("Cabecera")
fig("A02-cabecera.png", "Cabecera del simulador.")
items([
    (1, "Título", "Nombre de la página."),
    (2, "Subtítulo", "Recuerda qué se simula: el Protocolo 3 (PAR, Positive Acknowledgement with Retransmission) del libro, sobre un camino que puede tener varios saltos."),
    (3, "Calculadora de enlace", "Abre la otra página. La calculadora empieza con su propio ejemplo (el satélite del libro), no con los datos que haya en el simulador."),
    (4, "Fondo oscuro", "Cambia el tema visual. No afecta a nada de la simulación."),
])

h3("Panel de control")
fig("A03-control.png", "Bloque de control, con la simulación parada.", 9.5)
items([
    (1, "Estado", "En qué está el emisor: Inactivo, Transmitiendo, Esperando ACK, Timeout o Completado. Cambia de color según el estado."),
    (2, "Reloj", "Tiempo simulado en milisegundos. No es tiempo real: la simulación puede ir más rápida o más lenta que el reloj de pared, pero los milisegundos que se muestran son los del protocolo."),
    (3, "Barra del temporizador", "Se llena cuando el emisor arma el temporizador al enviar una trama y se va vaciando. Si llega a cero antes de que vuelva la confirmación, expira y se retransmite."),
    (4, "Iniciar / Pausar / Continuar", "Arranca la simulación. Mientras corre, el mismo botón pausa; en pausa, continúa. En pausa es cuando se puede tocar la trama que va por el canal."),
    (5, "Un paso", "Avanza una fracción pequeña de tiempo simulado (una sesentava parte del ciclo) y vuelve a quedarse quieto. Sirve para seguir el protocolo despacio. Desde parado, el primer paso arranca la simulación ya en pausa."),
    (6, "Reiniciar", "Vuelve al principio con los mismos parámetros: contadores a cero, bitácora vacía, diagrama limpio."),
    (7, "Velocidad", "Cuánto tiempo simulado transcurre por segundo real, de 0,25× a 4×. A 1× un ciclo completo del protocolo dura unos seis segundos en pantalla, independientemente de sus milisegundos. Solo cambia la animación; no cambia ningún resultado."),
    (8, "Lectura de la velocidad", "El factor actual del control anterior."),
    (9, "Ráfaga (ms)", "Duración, en milisegundos simulados, de la ráfaga de ruido que dispara el botón de abajo."),
    (10, "Ráfaga de ruido", "Ensucia el canal entero durante esos milisegundos. Es un fallo del canal, no de una trama: si hay algo en vuelo dentro de esa ventana, sus bits se arruinan; si no hay nada, no pasa nada. Se explica en la Parte 2."),
])
fig("A14-control-pausa.png", "El mismo bloque con la simulación en pausa: el estado es «Transmitiendo», el reloj está detenido y la barra del temporizador muestra lo que queda.", 9.5)
items([
    (1, "Estado", "«Transmitiendo»: la trama está en el canal. Cuando llegue al receptor pasará a «Esperando ACK», y si el temporizador expira, a «Timeout»."),
    (2, "Reloj", "Detenido en el instante de la pausa."),
    (3, "Temporizador", "La parte llena es el tiempo que aún le queda antes de expirar."),
    (4, "Continuar", "El botón cambia de texto para indicar que reanuda desde ese instante."),
])

h3("Diagrama tiempo–espacio y leyenda")
fig("A10-diagrama-feliz.png", "Diagrama tras enviar tres tramas sin ningún fallo.")
items([
    (1, "Eje de tiempo", "Milisegundos simulados, de arriba abajo. La escala se adapta al camino: la ventana visible abarca unos tres ciclos del protocolo."),
    (2, "Línea del emisor (A)", "Todo lo que sale de A nace en esta vertical."),
    (3, "Línea del receptor (B)", "Donde llegan las tramas y de donde salen las confirmaciones. Con puntos intermedios aparecen más verticales (R1, R2…)."),
    (4, "Trama de datos", "Flecha verde de A hacia B. Su inclinación es el tiempo de propagación; el grosor de su inicio, el tiempo de transmisión. La etiqueta (F0, F1) es el número de secuencia."),
    (5, "Confirmación", "Flecha azul de B hacia A. ACK1 confirma la trama 0 y pide la 1; ACK0 confirma la 1 y pide la 0. Con ACK de 0 bits la flecha es una línea sin grosor."),
])
fig("A07-leyenda.png", "Bloque «Cómo leer el diagrama».", 9.5)
items([
    (1, "Leyenda", "Cada tipo de trazo del diagrama: datos aceptados (verde), confirmaciones (azul), descartadas por CRC o duplicadas (rojo discontinuo), destruidas (rojo con aspa), expiración del temporizador (ámbar punteado), inversión del medio en half duplex (barra ámbar) y ráfaga de ruido (banda roja)."),
    (2, "Navegación", "Rueda del ratón sobre el diagrama para mirar hacia atrás en el tiempo (aparece el aviso «histórico»); Ctrl + rueda para acercar la escala; doble clic para volver al presente."),
])

h3("Cadena del camino")
fig("A06-cadena-dos-tramos.png", "Cadena con un punto intermedio: A → R1 → B.")
items([
    (1, "Nodo A", "El emisor."),
    (2, "Datos del tramo", "Distancia y velocidad de transmisión del tramo. Cambian al editar el bloque Camino."),
    (3, "Nodo intermedio (R1)", "Un punto de paso. Recibe la trama entera antes de reenviarla (almacenamiento y reenvío)."),
    (4, "Nodo B", "El receptor final."),
])

h3("Trama en el canal (inspector)")
para("Este bloque enseña la trama que está viajando en ese momento, bit a bit. Solo tiene contenido cuando hay algo en vuelo, "
     "y solo se puede modificar con la simulación en pausa. Para la figura se ha usado una trama de 64 bits; con el tamaño por "
     "defecto (1000 bits) la rejilla es mucho más alta y se desplaza dentro del bloque.")
fig("A11-inspector-sano.png", "Trama F0 en vuelo, en pausa, sin tocar.", 9.5)
items([
    (1, "Selector de tramas", "Un botón por cada cosa que hay en el canal (normalmente una). Con varios saltos puede haber más de una a la vez; se pulsa la que se quiere inspeccionar."),
    (2, "Tipo", "FRAME (datos), ACK o NAK."),
    (3, "Secuencia", "Número de secuencia que lleva la trama: 0 o 1."),
    (4, "Tramo", "Entre qué dos nodos está ahora mismo."),
    (5, "CRC recalculado", "Lo que obtendría el receptor al comprobar la trama tal como está ahora: «cuadra» o «no cuadra». Se recalcula solo cada vez que se cambia un bit."),
    (6, "Bits de la trama", "La trama completa. Los últimos 16, en azul, son el CRC. Las líneas verticales separan bytes."),
    (7, "Instrucción", "Recuerda que pulsar un bit lo voltea, es decir, mete un error a mano."),
])
fig("A12-inspector-volteado.png", "El mismo bloque después de pulsar un bit: el CRC deja de cuadrar y aparecen las acciones.", 9.5)
items([
    (1, "Bit volteado", "Se marca en rojo. Se puede volver a pulsar para dejarlo como estaba."),
    (2, "Veredicto", "«no cuadra»: el receptor la descartará al llegar. No hay ninguna marca oculta de «venía dañada»; el receptor lo descubre por su cuenta."),
    (3, "Bits del CRC", "También se pueden voltear. Dañar el CRC tiene el mismo efecto que dañar la carga: la comprobación falla."),
    (4, "Dañar un bit al azar", "Voltea un bit cualquiera de la trama. Equivale a pulsar uno a mano, pero sin elegirlo."),
    (5, "Destruir", "La trama desaparece del canal: nunca llega. Simula una pérdida total."),
    (6, "Retrasar", "La trama sigue viajando pero tarda mucho más de lo normal. Sirve para provocar confirmaciones que llegan tarde."),
    (7, "Forzar seq 0", "Cambia el número de secuencia de la trama a 0, sea cual sea. El CRC se recalcula para que siga cuadrando: el receptor la verá como una trama válida con ese número."),
    (8, "Forzar seq 1", "Igual, con el 1."),
    (9, "Ver el CRC paso a paso", "Despliega el cálculo del CRC de la trama tal como está ahora (siguiente apartado)."),
])

h3("CRC paso a paso")
fig("A13-crc-pasos.png", "Desglose del CRC-16 con el primer byte desplegado.", 12)
items([
    (1, "Polinomio y método", "El polinomio generador que se usa (x¹⁶ + x¹² + x⁵ + 1, el CRC-16/CCITT) y cómo se procesa: registro inicial 0xFFFF, un byte de la carga cada vez, ocho desplazamientos por byte."),
    (2, "Cabecera de la tabla", "Una fila por byte: su valor, el registro antes de procesarlo y después."),
    (3, "Fila de un byte", "Se pulsa para abrir su detalle. Abrir otra cierra la anterior."),
    (4, "Los ocho desplazamientos", "Para el byte abierto: el resultado de la operación XOR inicial y, en cada desplazamiento, el registro, si sale un uno por la izquierda y si por tanto se aplica el polinomio."),
    (5, "Veredicto", "Lo que calcula el receptor frente a lo que trae la trama. Si no coinciden, la descarta. Con la trama sana el texto es verde y dice que coinciden."),
])

h3("Protocolo")
fig("A04-protocolo.png", "Bloque de parámetros del protocolo.", 9.5)
items([
    (1, "Tramas a enviar", "Cuántas tramas de datos tiene que entregar el emisor (1 a 30). La simulación termina cuando la última está confirmada."),
    (2, "Tamaño de trama (bits)", "Longitud total de cada trama, L. Debe ser múltiplo de 8 y de al menos 24 bits: la carga va en bytes enteros y los últimos 16 bits son el CRC. Si se escribe un valor no válido, se ajusta al más cercano y se avisa."),
    (3, "Tamaño del ACK (bits)", "Longitud de la confirmación. Con 0 se considera despreciable: la confirmación tarda en propagarse pero no en transmitirse. Con un valor mayor, su tiempo de transmisión se suma al ciclo."),
    (4, "Timeout (ms simulados)", "Cuánto espera el emisor la confirmación antes de retransmitir. Al cambiar el camino se ajusta solo (RTT más un 50 % de margen). Si se escribe uno a mano, se respeta y el aviso de abajo dice qué margen queda."),
    (5, "Canal", "Full duplex (los dos sentidos a la vez) o half duplex (un sentido cada vez, y hay que invertir el medio antes de cada respuesta)."),
    (6, "Enviar NAK cuando el CRC falla", "Apagado (por defecto) es el Protocolo 3 del libro: el receptor descarta en silencio y el emisor solo se entera cuando expira el temporizador. Encendido, el receptor devuelve un NAK y el emisor retransmite al recibirlo, sin esperar."),
    (7, "Aviso del temporizador", "Explica cómo se ha fijado el timeout y, si es menor que el RTT, advierte de que habrá retransmisiones inútiles y duplicados."),
])

h3("Camino")
fig("A05-camino.png", "Bloque Camino con dos tramos (A → R1 → B).", 9.5)
items([
    (1, "Añadir punto", "Inserta un nodo intermedio al final del camino, copiando los datos del último tramo. Cada punto intermedio añade una vertical al diagrama."),
    (2, "Nombre del tramo", "Entre qué nodos va: A → R1, R1 → B…"),
    (3, "Quitar", "Elimina ese tramo (y el nodo intermedio correspondiente). Con un solo tramo el botón queda desactivado."),
    (4, "Distancia (km)", "Longitud física del tramo, d. Con la velocidad de propagación determina el tiempo de propagación."),
    (5, "Velocidad de transmisión (bits/s)", "R: a cuántos bits por segundo pone el nodo los datos en el medio. Con el tamaño de trama determina el tiempo de transmisión."),
    (6, "Velocidad de propagación (km/s)", "V: a qué velocidad viaja la señal por el medio (200 000 km/s es el valor típico de cobre y fibra, dos tercios de la luz en el vacío)."),
    (7, "Vuelta del medio (ms)", "Solo cuenta en half duplex: lo que tarda el tramo en invertir el sentido antes de cada respuesta."),
    (8, "Segundo tramo", "Cada tramo tiene sus propios cuatro valores; pueden ser distintos entre sí."),
    (9, "Nota", "Recuerda las dos reglas del camino: cada punto intermedio recibe la trama entera antes de reenviarla, y en half duplex cada inversión cuesta el tiempo de vuelta."),
])
box("cuidado", "Cualquier cambio en Protocolo o Camino reinicia la simulación", [
    "Al modificar un valor de estos dos bloques la simulación vuelve al principio, con contadores a cero. Conviene fijar los parámetros antes de pulsar Iniciar.",
])

h3("Telemetría")
fig("A08-telemetria.png", "Telemetría al terminar de enviar tres tramas sin fallos.", 9.5)
items([
    (1, "Tramas entregadas", "Cuántas tramas de datos distintas ha aceptado el receptor y subido a la capa de red, sobre el total pedido."),
    (2, "Transmisiones", "Cuántas veces ha salido una trama de datos del emisor, contando repeticiones."),
    (3, "Retransmisiones", "Cuántas de esas transmisiones fueron repeticiones (por timeout o por NAK)."),
    (4, "ACK recibidos", "Confirmaciones que llegaron al emisor y se aceptaron."),
    (5, "NAK recibidos", "Confirmaciones negativas recibidas (solo con la opción de NAK encendida)."),
    (6, "CRC incorrectos", "Tramas que el receptor descartó porque el CRC no cuadraba."),
    (7, "Duplicadas descartadas", "Tramas correctas pero repetidas (mismo número de secuencia que la anterior): el receptor las descarta y repite la confirmación."),
    (8, "ACK fuera de tiempo", "Confirmaciones que llegaron cuando el emisor ya había retransmitido o ya esperaba otra: se descartan."),
    (9, "Destruidas a mano", "Tramas y confirmaciones eliminadas con el botón Destruir."),
    (10, "Bits arruinados por ráfaga", "Bits que las ráfagas de ruido han volteado en total. Depende solo de la duración de la ráfaga y de la velocidad de transmisión: bits = R · t."),
    (11, "Utilización teórica", "Fracción del ciclo en la que el emisor está de verdad transmitiendo datos, U = Tt / ciclo. Es el valor teórico del camino sin fallos; los fallos no lo cambian."),
    (12, "RTT del camino", "Tiempo de ida y vuelta calculado para el camino: lo que tarda en volver la confirmación desde que empieza a salir la trama."),
])

h3("Qué ha pasado (bitácora)")
fig("A09-bitacora.png", "Bitácora de una simulación sin fallos. Lo más reciente arriba.", 9.5)
items([
    (1, "Instante", "Milisegundo simulado en que ocurrió el suceso."),
    (2, "Suceso", "Qué pasó, en una línea. En negro los envíos, en verde las aceptaciones y confirmaciones, en ámbar las retransmisiones y las intervenciones manuales, en rojo los errores y las expiraciones del temporizador."),
])

# ---------------- 1.2 Calculadora ----------------
page_break()
h2("1.2 La calculadora de enlace")
para("La calculadora no anima nada: toma los datos de un camino y devuelve tiempos, utilización y caudal, con el desarrollo "
     "completo. Al abrirla ya viene cargado el ejemplo del satélite del libro. Cualquier cambio en un dato recalcula todo al instante.")

h3("Vista general")
fig("B01-vista-general.png", "La calculadora recién abierta, con el ejemplo del satélite cargado.")
items([
    (1, "Cabecera", "Título, enlace de vuelta al simulador y fondo oscuro."),
    (2, "Datos", "Parámetros generales, el camino tramo a tramo y los ejemplos precargados."),
    (3, "Cómo se han leído los datos", "Repite en palabras lo que se ha entendido de los datos, para detectar un error de tecleo antes de fiarse del resultado."),
    (4, "Resultado", "Los tres números principales y el reparto del ciclo."),
    (5, "Desarrollo", "El cálculo paso a paso, que se puede abrir de uno en uno o todo a la vez. Debajo, y solo cuando se activan, aparecen los bloques de Ráfaga de ruido y Transferencia."),
])

h3("Datos y camino")
fig("B02-datos.png", "Bloque de datos completo.")
items([
    (1, "Tamaño de la trama · L (bits)", "Longitud de la trama de datos. La calculadora usa el valor tal cual, sin redondearlo a bytes enteros; si no fuera construible, avisa debajo con el tamaño que usaría el simulador."),
    (2, "Tamaño del ACK (bits)", "0 = despreciable (solo se propaga). Mayor que 0 añade su tiempo de transmisión al viaje de vuelta."),
    (3, "Modo del canal", "Full duplex o half duplex. En half duplex se suman dos tiempos de vuelta por ciclo."),
    (4, "Procesamiento por nodo intermedio (ms)", "Retardo fijo que cada punto intermedio añade antes de reenviar. Solo tiene efecto con dos o más saltos."),
    (5, "Ráfaga de ruido (ms)", "Duración de una ráfaga. Con un valor mayor que 0 aparece el bloque Ráfaga de ruido más abajo."),
    (6, "Añadir salto", "Añade un tramo al final del camino, copiando el anterior."),
    (7, "Nombre", "Etiqueta libre del tramo; solo sirve para leer mejor el desarrollo."),
    (8, "Velocidad de transmisión R (bits/s)", "Bits por segundo que el nodo pone en el medio en ese tramo."),
    (9, "Distancia d (km)", "Longitud del tramo."),
    (10, "Velocidad de propagación V (km/s)", "Velocidad de la señal en ese medio."),
    (11, "Tiempo de vuelta (ms)", "Inversión del medio en half duplex. Se ignora en full duplex."),
    (12, "Quitar", "Elimina el tramo. Con uno solo, avisa y no borra."),
    (13, "Satélite · Tanenbaum p. 200", "Carga el ejemplo del libro: 50 kbit/s, 1000 bits, 500 ms de ida y vuelta."),
    (14, "Casa → satélite → casa", "Dos tramos en serie por un satélite geoestacionario, con velocidades distintas en cada uno."),
    (15, "LAN 10 Mbps · 1 km", "El ejemplo de clase con a = 0,1. La nota al lado avisa de que la letra a y la fórmula U = 1/(1+2a) son de Stallings, no de Tanenbaum."),
])

h3("Cómo se han leído los datos")
fig("B03-interpretacion.png", "Interpretación de los datos del satélite.")
items([
    (1, "Resumen en palabras", "Tamaño de trama, cómo se trata el ACK, cuántos tramos hay y en qué modo está el canal, y una línea por tramo con distancia, velocidad de transmisión y velocidad de propagación en unidades legibles. Si aquí algo no coincide con lo que se quería, el error está en los datos."),
])

h3("Resultado")
fig("B04-resultado.png", "Resultado del satélite: U = 3,846 %, ciclo de 520 ms, caudal de 1,923 kbit/s.")
items([
    (1, "Utilización del canal", "U: qué fracción del ciclo el emisor está transmitiendo datos. Es el número principal. Con varios saltos se llama «utilización del enlace del emisor» porque mide el primer tramo."),
    (2, "Tiempo de ciclo", "Lo que tarda un envío completo: desde que empieza a salir la trama hasta que llega su confirmación (más las inversiones del medio, en half duplex)."),
    (3, "Caudal útil", "Bits de datos por segundo que de verdad se consiguen: L / ciclo."),
    (4, "Reparto del ciclo", "Barra que divide el ciclo en «transmitiendo» y «esperando». Al pasar el ratón muestra los milisegundos de cada parte."),
])

h3("Desarrollo")
fig("B05-desarrollo-cerrado.png", "Bloque Desarrollo, cerrado.")
items([
    (1, "Mostrar el primer paso / siguiente", "Abre los pasos de uno en uno. El texto del botón cambia al siguiente paso."),
    (2, "Mostrar todos", "Abre los once pasos a la vez (trece si hay errores de canal en el modelo). Cuando hay pasos abiertos aparece «Ocultar»."),
    (3, "Contador", "Cuántos pasos hay y por cuál se va."),
])
fig("B06-paso-abierto.png", "Un paso con su detalle desplegado.")
items([
    (1, "Título del paso", "Qué se calcula."),
    (2, "Cadena de igualdades", "La fórmula, los datos sustituidos con sus unidades, la cancelación de unidades, el cambio a milisegundos (el factor 1000) y el resultado."),
    (3, "Motivo de cada línea", "A la derecha de cada igualdad, por qué se hace ese paso."),
    (4, "Nota", "Qué significa el resultado, en una frase."),
    (5, "Ver / Ocultar el detalle", "Despliega el cálculo hecho con los números de cada tramo. Abrir el detalle de un paso cierra el que estuviera abierto."),
    (6, "Detalle", "Una línea por tramo y comprobaciones adicionales (por ejemplo, la forma cerrada de Stallings en la utilización)."),
])
fig("B07-desarrollo-todos.png", "Todos los pasos abiertos; se marcan el ciclo y la utilización.")
items([
    (1, "Ocultar", "Cierra todos los pasos."),
    (2, "Paso 6 · Ciclo completo", "Donde se suman ida y vuelta; en half duplex la fórmula cambia y añade las dos inversiones del medio."),
    (3, "Paso 7 · Utilización", "El resultado principal, con la cancelación de unidades y el paso a por ciento."),
])

h3("Ráfaga de ruido")
fig("B08-rafaga.png", "Bloque Ráfaga con 2 ms sobre el satélite.")
items([
    (1, "Bits que arruina la ráfaga", "bits = R · t, con t en segundos. Es exactamente el número que el simulador contará en «Bits arruinados por ráfaga» con esa duración y esa velocidad."),
    (2, "Tramas que abarca la ráfaga", "Cuántas tramas caben en esos bits, redondeando hacia arriba: ⌈bits / L⌉. Si la ráfaga es más corta que una trama, sigue siendo una trama dañada."),
])

h3("Transferencia de un fichero completo")
fig("B09-transferencia.png", "Bloque Transferencia con 100 KB sobre el satélite.")
items([
    (1, "Tamaño total", "Cuántos bits, KB o MB hay que enviar en total."),
    (2, "Unidad", "bits, KB (1000 bytes) o MB (1000 KB)."),
    (3, "Tres pasos", "Tramas necesarias ⌈bits / L⌉, tiempo total = tramas × ciclo, y el caudal conseguido = bits / tiempo (que coincide con el caudal útil del resultado)."),
])
box("cuidado", "Este bloque no se puede activar desde la interfaz en la versión actual", [
    "El bloque Transferencia solo aparece cuando el tamaño es mayor que 0, pero el campo para escribir el tamaño está dentro del propio bloque. "
    "Resultado: el usuario no tiene forma de verlo. Para la figura se ha rellenado el campo desde fuera. Está anotado como corrección pendiente.",
])

h3("Avisos y errores")
fig("B10-error.png", "Un dato inválido (velocidad de transmisión = 0) muestra el aviso en lugar de un resultado sin sentido.")
items([
    (1, "Caja de error", "Explica qué dato falla y por qué. Mientras esté visible, el resultado y el desarrollo no se actualizan."),
])
fig("B11-lan-nota.png", "Nota informativa con el ejemplo de LAN: la trama de 500 bits no es construible.")
items([
    (1, "Nota bajo los datos", "No es un error. Avisa de que una trama con esa longitud no se puede construir con bytes enteros más 16 bits de CRC, y dice qué tamaño usaría el simulador (504). La calculadora calcula con los 500 bits para conservar el número del libro."),
])

# =====================================================================
# PARTE 2 — FUNCIONAMIENTO
# =====================================================================
page_break()
h1("Parte 2 — Funcionamiento")
para("Cada apartado es un ejercicio: qué tocar, qué se ve y por qué pasa, con la fórmula que lo explica. Salvo que se diga "
     "otra cosa, se parte de los valores por defecto del simulador: 1000 bits por trama, ACK despreciable, un tramo de "
     "2000 km a 100 kbit/s con propagación a 200 000 km/s, full duplex, timeout automático. En los ejercicios se han "
     "enviado 3 tramas en lugar de 4 para que todo el recorrido quepa en una pantalla.")

# ---- 2.1
h2("2.1 Un ciclo del protocolo: tiempos, RTT y utilización")
box("paso", "Ejercicio", [
    "1. Pulsar Reiniciar y dejar los valores por defecto.",
    "2. Pulsar Iniciar y esperar a que el estado diga «Completado».",
    "3. Leer en Telemetría el RTT del camino y la utilización teórica; comparar con el diagrama.",
])
fig("s12-diagram-feliz-inicio.png", "Tres tramas sin fallos. Cada zigzag verde–azul es un ciclo de 30 ms.", source=SHOTS)
para("Cada envío tiene tres tiempos. El emisor tarda en poner los 1000 bits en el medio (tiempo de transmisión), el primer bit "
     "tarda en llegar al otro extremo (tiempo de propagación) y la confirmación tarda en volver (otra propagación; su transmisión "
     "es despreciable porque el ACK mide 0 bits).")
formula("Tt = L / R = 1000 bits / 100 000 bit/s = 10 ms", "tiempo de transmisión: no depende de la distancia")
formula("Tp = d / V = 2000 km / 200 000 km/s = 10 ms", "tiempo de propagación: no depende del tamaño de la trama")
formula("RTT = Tt + Tp + Tp = 30 ms", "ida (transmitir y propagar) más vuelta (propagar el ACK)")
para("Durante esos 30 ms el emisor solo está transmitiendo los 10 primeros. El resto espera. Esa fracción es la utilización:")
formula("U = Tt / ciclo = 10 / 30 = 33,33 %")
para("En el diagrama se ve directamente: la flecha verde arranca en A a los 0 ms con un grosor de 10 ms (lo que tarda en salir "
     "entera), llega a B a los 20 ms, y la azul vuelve a A a los 30 ms. La siguiente trama no sale hasta ese instante. "
     "La bitácora lo cuenta en ese mismo orden: «Envía trama #1» a 0 ms, «Receptor acepta F0» a 20 ms, «ACK1 confirma la "
     "trama #1» a 30 ms y, en el mismo instante, «Envía trama #2».")
box("fuente", "De dónde sale", [
    "Tanenbaum, cap. 3, § 3.4.3 (Protocolo 3) y § 3.4.4 (el ejemplo del satélite, p. 200): el emisor queda bloqueado esperando la confirmación y ese bloqueo es lo que desperdicia el canal.",
])
box("cuidado", "Dos velocidades distintas", [
    ("Velocidad de transmisión (R): ", "cuántos bits por segundo salen del nodo. Fija Tt."),
    ("Velocidad de propagación (V): ", "a qué velocidad viaja la señal. Fija Tp."),
    "Subir R acorta Tt pero no toca Tp; acortar la distancia acorta Tp pero no toca Tt. Por eso un enlace muy rápido y muy largo tiene una utilización muy baja.",
])

# ---- 2.2
h2("2.2 El número de secuencia y la alternancia 0/1")
box("paso", "Ejercicio", [
    "1. Con la simulación anterior terminada, mirar las etiquetas del diagrama: F0, F1, F0… y ACK1, ACK0, ACK1…",
    "2. Pausar en mitad de un envío y leer «Secuencia» en el inspector.",
])
para("Stop & Wait solo necesita un bit de secuencia: como nunca hay más de una trama pendiente, basta con distinguir «esta» de "
     "«la anterior». La trama lleva 0 o 1 y el receptor recuerda cuál espera. La confirmación lleva el número de la siguiente "
     "trama que el receptor quiere recibir: ACK1 significa «recibí la 0, mándame la 1».")
para("Si al receptor le llega una trama correcta con el número que no esperaba, es una repetición: la descarta sin entregarla y "
     "vuelve a mandar la misma confirmación, porque la anterior debió de perderse. Esta regla es la que evita duplicados en la "
     "capa de red, y se ve funcionar en los apartados 2.7 y 2.8.")
box("fuente", "De dónde sale", [
    "Tanenbaum, § 3.4.3, Protocolo 3 (PAR), con MAX_SEQ = 1: «un número de secuencia de 1 bit es suficiente».",
])

# ---- 2.3
h2("2.3 Detección de errores: el CRC")
box("paso", "Ejercicio", [
    "1. Reiniciar. Poner Tamaño de trama = 64 para que la rejilla de bits quepa entera (con 1000 bits funciona igual).",
    "2. Iniciar, y pausar en cuanto la trama F0 esté en el canal.",
    "3. En «Trama en el canal», pulsar un bit cualquiera. Leer «CRC recalculado».",
    "4. Pulsar «Ver el CRC paso a paso» y abrir la fila de un byte.",
])
fig("A12-inspector-volteado.png", "Un bit de la carga volteado: el CRC ya no cuadra.", 9)
para("Los últimos 16 bits de cada trama son un código de redundancia cíclica (CRC). El emisor los calcula a partir de la carga; "
     "el receptor repite el mismo cálculo al recibir la trama y compara. Si un solo bit cambió por el camino, el resultado no "
     "coincide y la trama se descarta. No hay ninguna marca de «esta viene mal»: el receptor lo descubre solo.")
para("El código usado es el CRC-16/CCITT, con el polinomio generador:")
formula("G(x) = x¹⁶ + x¹² + x⁵ + 1   (0x1021)")
para("El cálculo se hace byte a byte sobre un registro de 16 bits que empieza en 0xFFFF: se combina el byte con la parte alta del "
     "registro mediante XOR y se desplaza ocho veces; cada vez que sale un uno por la izquierda se aplica el polinomio. El "
     "desglose del inspector enseña exactamente eso, byte a byte y desplazamiento a desplazamiento, y termina con el veredicto: "
     "«El receptor calcula X pero la trama trae Y: no coinciden, la descarta».")
box("fuente", "De dónde sale", [
    "Tanenbaum, § 3.2.2, códigos polinomiales (pp. 184–185): un código con r bits de verificación detecta cualquier error sencillo y cualquier ráfaga de longitud ≤ r. Con r = 16, cualquier ráfaga de hasta 16 bits seguidos se detecta siempre.",
])
box("cuidado", "Voltear un bit del CRC también rompe la comprobación", [
    "La carga y el CRC son un conjunto: si cambia cualquiera de los dos, la división ya no da resto cero. Por eso da igual dónde se meta el error.",
])

# ---- 2.4
h2("2.4 Trama dañada sin NAK: el temporizador la rescata")
box("paso", "Ejercicio", [
    "1. Con «Enviar NAK» apagado (es lo normal), volver a voltear un bit de F0 en pausa y pulsar Continuar.",
    "2. Observar el diagrama: F0 llega discontinua y roja, no vuelve nada, y a los 45 ms aparece la marca «timeout» y una F0 nueva.",
    "3. Comprobar en Telemetría: CRC incorrectos = 1, Retransmisiones = 1, Transmisiones = 4 (3 tramas + 1 repetición).",
])
fig("s21-diagram-crc-timeout-inicio.png", "F0 descartada por CRC (roja discontinua); el temporizador expira y se retransmite.", source=SHOTS)
para("Este es el comportamiento del Protocolo 3: el receptor descarta la trama dañada y no dice nada. El emisor no tiene manera de "
     "saberlo salvo por el silencio: había armado un temporizador al enviar, y cuando expira sin confirmación retransmite la misma "
     "trama con el mismo número de secuencia. En la bitácora: «CRC incorrecto en F0: el receptor la descarta» y luego «Expiró el "
     "temporizador esperando ACK1» seguido de «Retransmite trama #1 (seq=0)».")
para("El coste es todo el timeout. Con el valor automático (RTT más 50 %) la recuperación cuesta 45 ms en lugar de los 30 de un "
     "ciclo normal.")
formula("timeout automático = 1,5 × RTT = 1,5 × 30 ms = 45 ms")
box("fuente", "De dónde sale", [
    "Tanenbaum, § 3.4.3: «cuando el temporizador expira, el emisor reenvía la trama». El receptor del Protocolo 3 no envía confirmaciones negativas.",
])

# ---- 2.5
h2("2.5 Trama dañada con NAK: recuperación inmediata")
box("paso", "Ejercicio", [
    "1. Encender «Enviar NAK cuando el CRC falla». Reiniciar.",
    "2. Repetir el ejercicio anterior: pausar, voltear un bit de F0, continuar.",
    "3. Comparar: ahora vuelve una flecha azul etiquetada NAK y la retransmisión sale al recibirla, mucho antes del timeout.",
])
fig("s24-diagram-nak-inicio.png", "Con NAK: el receptor avisa del CRC incorrecto y el emisor retransmite sin esperar al temporizador.", source=SHOTS)
para("La confirmación negativa es una variante que el simulador ofrece para comparar. En la telemetría se ve la diferencia: "
     "NAK recibidos = 1 y la retransmisión sale en cuanto llega, así que la simulación entera termina antes. La bitácora registra "
     "el NAK en lugar de la expiración del temporizador. El temporizador sigue armado por si el propio NAK se perdiera.")

# ---- 2.6
h2("2.6 Trama destruida en el canal")
box("paso", "Ejercicio", [
    "1. Apagar NAK. Reiniciar con 1000 bits por trama.",
    "2. Iniciar, pausar con F0 en vuelo y pulsar Destruir. Continuar.",
])
fig("s27-diagram-destruida-inicio.png", "F0 destruida (aspa roja): al receptor no le llega nada; el temporizador expira y se retransmite.", source=SHOTS)
para("Una trama destruida es el caso de pérdida total: ni siquiera hay CRC que comprobar porque no llega nada. Para el emisor es "
     "indistinguible del caso anterior: silencio, expiración a los 45 ms y retransmisión. Telemetría: Destruidas a mano = 1, "
     "Retransmisiones = 1, CRC incorrectos = 0.")
para("Lo mismo se puede hacer con una confirmación: pausar cuando la flecha azul esté en el canal y destruirla. El receptor ya "
     "entregó la trama, pero el emisor no lo sabe; retransmite, y el receptor la descarta como duplicada y repite el ACK "
     "(apartado 2.7). La trama no se entrega dos veces.")

# ---- 2.7
h2("2.7 Confirmación retrasada y duplicados")
box("paso", "Ejercicio", [
    "1. Reiniciar. Iniciar a velocidad 1× y pausar cuando el ACK1 esté volviendo hacia A (entre los 20 y los 30 ms).",
    "2. Pulsar Retrasar. Continuar.",
    "3. Leer la bitácora de abajo arriba.",
])
fig("s29-diagram-retrasada-inicio.png", "ACK1 retrasado: el emisor retransmite F0, el receptor la descarta como duplicada y el ACK viejo llega mucho después.", source=SHOTS)
para("Secuencia de sucesos: el receptor aceptó F0 a los 20 ms y envió ACK1, pero ese ACK viaja ahora muy lento. A los 45 ms expira "
     "el temporizador y el emisor retransmite F0. A los 64,8 ms el receptor recibe una F0 correcta pero con el número que ya "
     "tenía: «F0 duplicada: se descarta y se repite el ACK». Ese segundo ACK1 llega a los 74,8 ms y el emisor sigue con F1.")
box("cuidado", "Lo que enseña este ejercicio sobre el bit de secuencia", [
    "Con un solo bit, la confirmación no dice a qué trama confirma: solo dice «mándame la 0» o «mándame la 1». Si el ACK viejo tarda más de un ciclo entero, puede llegar cuando el emisor está esperando otro ACK con el mismo número y darse por buena una trama que aún no ha llegado. "
    "En esta ejecución ocurre exactamente eso al final: el ACK1 retrasado aterriza a los 105,5 ms, justo cuando el emisor acaba de enviar la trama #3 (seq 0) y espera precisamente un ACK1; la da por confirmada y termina, y Telemetría muestra «Tramas entregadas 2 / 3». "
    "Es una limitación real del protocolo con retardos muy variables, no un fallo del simulador: por eso los protocolos reales usan números de secuencia más largos o acotan el tiempo de vida de las tramas.",
])

# ---- 2.8
h2("2.8 Forzar el número de secuencia")
box("paso", "Ejercicio", [
    "1. Reiniciar. Iniciar a 1× y pausar cuando la segunda trama (F1) esté en el canal, pasados los 30 ms.",
    "2. Pulsar Forzar seq 0. Continuar.",
])
fig("s30-diagram-duplicada-inicio.png", "F1 convertida en F0: el receptor la ve como repetida y responde ACK1; el emisor, que esperaba ACK0, lo descarta y retransmite al expirar.", source=SHOTS)
para("Al forzar el número de secuencia la trama sigue siendo válida (el CRC se recalcula), pero lleva el número que el receptor "
     "ya tiene. El receptor la descarta como duplicada y repite ACK1. Al emisor le llega un ACK1 cuando espera ACK0: «ACK1 llegó "
     "fuera de tiempo: el emisor lo descarta». Nada avanza hasta que expira el temporizador a los 75 ms y retransmite la trama #2, "
     "esta vez con su número correcto. Telemetría: Duplicadas descartadas = 1, ACK fuera de tiempo = 1, Retransmisiones = 1.")
para("El mismo botón sirve para el caso contrario: forzar seq 1 en la primera trama hace que el receptor, que espera la 0, la "
     "trate como repetida sin haber recibido nunca nada.")

# ---- 2.9
h2("2.9 Un temporizador demasiado corto")
box("paso", "Ejercicio", [
    "1. Reiniciar. Escribir Timeout = 20 (menor que el RTT de 30 ms). Leer el aviso en rojo bajo el bloque Protocolo.",
    "2. Iniciar y mirar cuántas transmisiones hacen falta para tres tramas.",
])
fig("s42-protocolo-timeout-corto.png", "El aviso explica lo que va a pasar antes de pulsar Iniciar.", 9.5, source=SHOTS)
fig("s43-diagram-timeout-corto-inicio.png", "Con timeout = 20 ms cada trama se retransmite antes de que pueda volver su ACK.", source=SHOTS)
para("El temporizador expira a los 20 ms, cuando la trama acaba de llegar a B y el ACK ni siquiera ha salido. El emisor "
     "retransmite; el receptor descarta la copia como duplicada y repite el ACK; al emisor le llegan dos ACK, el segundo «fuera de "
     "tiempo». Cada trama cuesta varias transmisiones. En la ejecución de la figura: Transmisiones = 9 para 3 tramas, "
     "Retransmisiones = 6, Duplicadas descartadas = 2, ACK fuera de tiempo = 2. Todas se entregan, pero el trabajo se multiplica.")
formula("timeout ≥ RTT", "condición mínima; el simulador usa por defecto 1,5 × RTT")
box("fuente", "De dónde sale", [
    "Tanenbaum, § 3.4.3: si el temporizador es demasiado corto, «el emisor retransmitirá tramas cuyo ACK todavía viene en camino» y el receptor tendrá que reconocer los duplicados. Es el paso 11 del desarrollo de la calculadora.",
])

# ---- 2.10
h2("2.10 Canal half duplex")
box("paso", "Ejercicio", [
    "1. Reiniciar con Timeout en blanco o automático. En Protocolo, poner Canal = Half duplex. El tramo por defecto ya tiene 5 ms de vuelta del medio.",
    "2. Iniciar. Aparecen barras ámbar verticales antes de cada ACK y antes de cada trama siguiente.",
    "3. Comparar en Telemetría: RTT sigue en 30 ms, pero la utilización baja de 33,33 % a 25 %.",
])
fig("s33-diagram-half-inicio.png", "Half duplex: cada inversión del medio (barra ámbar) cuesta 5 ms y no transporta nada.", source=SHOTS)
para("En half duplex el medio solo lleva señal en un sentido a la vez. Antes de que B pueda responder hay que invertir el sentido, y "
     "antes de que A mande la siguiente trama hay que invertirlo otra vez. Esas dos inversiones se suman al ciclo aunque el RTT (lo "
     "que tarda la señal en ir y volver) no cambie.")
formula("ciclo = RTT + 2 × vuelta = 30 + 2 × 5 = 40 ms")
formula("U = Tt / ciclo = 10 / 40 = 25 %")
para("En la bitácora cada inversión queda registrada: «Half duplex: invirtiendo el medio (5 ms)» a los 20 ms (antes del ACK) y a los "
     "35 ms (antes de la trama #2), que sale a los 35 ms en lugar de a los 30.")

# ---- 2.11
h2("2.11 Ráfaga de ruido")
box("paso", "Ejercicio", [
    "1. Reiniciar en full duplex. Dejar Ráfaga (ms) = 5.",
    "2. Iniciar a 1× y, con F0 en vuelo, pulsar «Ráfaga de ruido» (no hace falta pausar).",
    "3. Ver la banda roja horizontal en el diagrama y leer «Bits arruinados por ráfaga» en Telemetría.",
])
fig("s35-diagram-rafaga-inicio.png", "La banda roja es el canal sucio durante 5 ms; la trama que estaba dentro llega con CRC incorrecto.", source=SHOTS)
para("La ráfaga no elige una trama: ensucia el canal durante un tiempo. Todo bit que esté pasando por el medio en esa ventana se "
     "voltea. Por eso el número de bits arruinados depende solo de la duración y de la velocidad de transmisión, no de la "
     "velocidad de la animación ni de cuántas tramas haya:")
formula("bits arruinados = R × t = 100 000 bit/s × 0,005 s = 500 bits")
para("En la figura, F0 estaba en el canal: 500 de sus 1000 bits quedan volteados (en el inspector se ven como un bloque rojo "
     "seguido), el CRC no cuadra al llegar y se descarta; el temporizador expira a los 45 ms y se retransmite. Si la ráfaga "
     "coincide con un momento en que el canal está vacío, no arruina nada. La calculadora da el mismo 500 para 5 ms a 100 kbit/s "
     "(apartado 2.15).")
box("fuente", "De dónde sale", [
    "Tanenbaum, § 3.2, errores en ráfaga: en la práctica los errores vienen agrupados, y un CRC de 16 bits detecta toda ráfaga de longitud ≤ 16. Una ráfaga de 500 bits se detecta con probabilidad 1 − 2⁻¹⁶, es decir, prácticamente siempre.",
])

# ---- 2.12
h2("2.12 Camino de varios saltos")
box("paso", "Ejercicio", [
    "1. Reiniciar. En Camino, pulsar «Añadir punto». Aparece el tramo R1 → B con los mismos datos que A → R1.",
    "2. Observar que el Timeout se ha ajustado solo (RTT 60 ms + 50 % = 90 ms).",
    "3. Iniciar. La trama cruza dos verticales y hay dos flechas por sentido.",
])
fig("s40-diagram-dos-tramos-inicio.png", "Dos tramos: la trama se recibe entera en R1 antes de reenviarse, así que paga dos veces el tiempo de transmisión.", source=SHOTS)
para("Un punto intermedio funciona por almacenamiento y reenvío: recibe la trama completa, la comprueba y la vuelve a transmitir. "
     "Por tanto el viaje de ida suma el tiempo de transmisión y el de propagación de cada tramo; la vuelta del ACK, al ser "
     "despreciable en transmisión, solo suma propagaciones.")
formula("ida = ΣTt + ΣTp = (10 + 10) + (10 + 10) = 40 ms")
formula("vuelta = ΣTt(ACK) + ΣTp = 0 + (10 + 10) = 20 ms")
formula("RTT = 40 + 20 = 60 ms      U = Tt(emisor) / RTT = 10 / 60 = 16,67 %")
para("Telemetría confirma RTT del camino = 60,0 ms y utilización teórica = 16,67 %. Con dos tramos también puede haber dos "
     "cosas en el canal a la vez (por ejemplo, la trama en R1 → B y nada en A → R1): el selector del inspector muestra un botón por "
     "cada una.")
box("cuidado", "Si el timeout se había fijado a mano", [
    "Al escribir un timeout el simulador deja de ajustarlo. Si luego se añade un punto, el RTT sube a 60 ms y un timeout de 45 se queda corto: aparecen retransmisiones y duplicados como en 2.9. El aviso bajo el bloque Protocolo lo dice en rojo.",
])

# ---- 2.13
page_break()
h2("2.13 La calculadora, paso a paso: el satélite de Tanenbaum")
box("paso", "Ejercicio", [
    "1. Abrir la calculadora (enlace de la cabecera). Ya viene cargado «Satélite · Tanenbaum p. 200».",
    "2. Leer «Cómo se han leído los datos» y el Resultado.",
    "3. Pulsar «Mostrar todos» en Desarrollo y abrir el detalle del paso 7.",
])
para("Datos del ejemplo: tramas de 1000 bits, canal de 50 kbit/s, distancia de 50 000 km con propagación a 200 000 km/s (lo que "
     "da los 250 ms por sentido que usa el libro), ACK despreciable, full duplex.")
fig("B03-interpretacion.png", "Interpretación de los datos del satélite: un solo tramo de 50 000 km a 50 kbit/s.")
para("Los once pasos del desarrollo, con sus fórmulas y el número que sale para el satélite:")
items([
    (1, "Tiempo de transmisión", "Tt = L / R = 1000 / 50 000 = 0,02 s = 20 ms. Lo que tarda el emisor en empujar la trama entera al medio."),
    (2, "Tiempo de propagación", "Tp = d / V = 50 000 / 200 000 = 0,25 s = 250 ms. Lo que tarda la señal en recorrer el enlace."),
    (3, "Parámetro del enlace", "a = Tp / Tt = 250 / 20 = 12,5. Cuántas veces cabe el tiempo de transmisión en el de propagación. Equivale a a = (R·d)/(V·L)."),
    (4, "Viaje de ida", "ida = ΣTt + ΣTp = 20 + 250 = 270 ms."),
    (5, "Viaje de vuelta", "vuelta = ΣTt(ACK) + ΣTp = 0 + 250 = 250 ms."),
    (6, "Ciclo completo", "ciclo = RTT = ida + vuelta = 520 ms. En half duplex: ciclo = RTT + 2 × vuelta del medio."),
    (7, "Utilización", "U = Tt / ciclo = 20 / 520 = 0,0385 = 3,846 %. El canal está ocioso el 96,15 % del tiempo."),
    (8, "Caudal útil", "caudal = L / ciclo = 1000 bits / 520 ms = 1923 bit/s. De los 50 kbit/s del enlace se aprovechan 1,9."),
    (9, "Producto ancho de banda por retardo", "BD = R × Tp = 50 000 × 0,25 = 12 500 bits = 12,5 tramas. Lo que cabe en el canal en un sentido."),
    (10, "Ventana necesaria", "ventana = 2 × BD + 1 = 26 tramas. Lo que un protocolo de ventana deslizante tendría que tener en vuelo para no parar nunca. Stop & Wait tiene ventana 1."),
    (11, "Temporizador mínimo", "timeout ≥ RTT = 520 ms. Por debajo, retransmisiones inútiles y duplicados."),
], head=("Paso", "Qué se calcula", "Fórmula y resultado"))
fig("B07-desarrollo-todos.png", "Los pasos 6 y 7 en pantalla: ciclo y utilización.")
box("fuente", "De dónde sale", [
    "Tanenbaum, p. 200: canal de satélite de 50 kbps con retardo de ida y vuelta de 500 ms, tramas de 1000 bits; la confirmación vuelve a los 520 ms y el emisor «estuvo bloqueado 500/520, o 96 % del tiempo»; «sólo se usó 4 % del ancho de banda».",
    "Tanenbaum, p. 201: el producto ancho de banda–retardo BD = 12,5 tramas y la ventana 2BD + 1 = 26 tramas.",
])
box("cuidado", "Lo que no es de Tanenbaum", [
    "La letra a y la forma cerrada U = 1 / (1 + 2a) son de Stallings. El detalle del paso 7 la usa solo como comprobación: 1 / (1 + 2 × 12,5) = 3,846 %, el mismo número. Tanenbaum razona con los tiempos crudos y nunca define a.",
])

# ---- 2.14
h2("2.14 Los otros ejemplos: LAN y casa → satélite → casa")
box("paso", "Ejercicio", [
    "1. Pulsar «LAN 10 Mbps · 1 km». Leer el resultado y la nota bajo los datos.",
    "2. Pulsar «Casa → satélite → casa». Ver que el camino tiene dos tramos con velocidades distintas.",
    "3. Volver al satélite, cambiar Modo del canal a half duplex y poner 10 ms de tiempo de vuelta.",
])
fig("B11b-lan-resultado.png", "LAN de 10 Mbit/s y 1 km con tramas de 500 bits: U = 83,33 %.")
para("En la LAN el tiempo de transmisión (500 / 10⁷ = 50 µs) es diez veces mayor que el de propagación (1 km / 200 000 km/s = 5 µs), "
     "así que a = 0,1 y el ciclo son 60 µs: el emisor está transmitiendo el 83,33 % del tiempo. Stop & Wait funciona bien "
     "cuando el enlace es corto o lento; funciona mal cuando es largo o rápido. La nota bajo los datos avisa de que 500 bits no "
     "es una trama construible (el simulador usaría 504): la calculadora conserva el número del libro de clase.")
formula("U = 1 / (1 + 2a) = 1 / (1 + 0,2) = 83,33 %", "forma cerrada de Stallings, válida con un salto y ACK despreciable")
fig("B12c-casa-resultado.png", "Casa → satélite → casa: dos tramos de 35 786 km, a 1 Mbit/s y 500 kbit/s. U = 0,207 %.")
para("Con dos tramos la calculadora suma tramo a tramo, como el simulador, y este ejemplo añade 1 ms de procesamiento en el "
     "satélite en cada sentido: ida = (1 + 119,3) + (2 + 119,3) + 1 = 242,6 ms, vuelta = 119,3 + 119,3 + 1 = 239,6 ms, "
     "RTT = 482,1 ms. La utilización mide el enlace del emisor: 1 ms de cada 482 = 0,207 %.")
fig("B13-half-resultado.png", "Satélite en half duplex con 10 ms de vuelta: el ciclo pasa de 520 a 540 ms y U baja a 3,704 %.")
formula("ciclo = RTT + 2 × vuelta = 520 + 20 = 540 ms      U = 20 / 540 = 3,704 %")

# ---- 2.15
h2("2.15 Ráfaga y transferencia en la calculadora")
box("paso", "Ejercicio", [
    "1. Con el satélite cargado, escribir Ráfaga de ruido = 2. Aparece el bloque Ráfaga de ruido.",
    "2. Cambiar a 5 ms y comparar con los 500 bits que contó el simulador en 2.11 (allí R era 100 kbit/s, aquí 50 kbit/s).",
])
fig("B08-rafaga.png", "2 ms de ráfaga a 50 kbit/s: 100 bits, que caben en una sola trama.")
formula("bits = R × t = 50 000 × 0,002 = 100 bits      tramas = ⌈100 / 1000⌉ = 1")
para("El bloque Transferencia responde a la pregunta práctica: cuánto tarda un fichero entero. Con 100 KB (800 000 bits) y tramas "
     "de 1000 bits hacen falta 800 tramas; a 520 ms por ciclo, 416 s (casi siete minutos) por un enlace de 50 kbit/s.")
fig("B09-transferencia.png", "100 KB por el satélite: 800 tramas, 416 s, 1,923 kbit/s conseguidos.")
formula("tramas = ⌈bits / L⌉ = 800      tiempo = tramas × ciclo = 800 × 0,52 s = 416 s      goodput = 800 000 / 416 = 1923 bit/s")
para("El caudal conseguido coincide con el caudal útil del Resultado: es la misma magnitud vista desde el fichero completo en lugar "
     "de desde una sola trama. Ver en la Parte 1 la nota sobre este bloque: en la versión actual el campo de tamaño no está "
     "accesible desde la interfaz.")

doc.save(OUT)
print("guardado", OUT, "figuras:", FIG_N[0])
