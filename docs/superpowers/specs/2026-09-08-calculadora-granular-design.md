# Spec — Calculadora granular: fórmulas apiladas, unidades explícitas y fichero como entrada

Fecha: 2026-09-08 · Estado: **aprobado por el usuario, sin implementar**

## Problema

La calculadora da los números correctos pero **esconde el razonamiento**. Un paso es
*fórmula → sustitución → resultado*, y entre la sustitución y el resultado desaparecen dos
cosas que en un examen hay que saber escribir:

- La **cancelación de unidades**: `bits / (bit/s)` da segundos, y eso no se dice.
- El **factor 1000** que convierte `0,02 s` en `20 ms`. La pantalla salta de `1000 / 50000`
  a `20 ms` sin explicar de dónde sale el mil.

Además la fórmula se enseña como texto plano (`Tt = L / R`), no como la escribe el libro, con
numerador encima de denominador.

Se pide, por decisión del usuario del 2026-09-08:

1. Desarrollo **más granular**, con las conversiones de unidad visibles.
2. Fórmulas **apiladas como en un libro**, y notación científica junto a la unidad natural.
3. **Tamaño de fichero** y **tamaño de trama** como entradas de primera clase.
4. **Quitar la probabilidad de error de la calculadora** (no del simulador).

## Contexto de calendario, y por qué esto es un desvío

`06-pendientes.md` declara entrega el **2026-09-09** y un cierre en curso con el paso 3
abierto. La regla 8 de `04-convenciones.md` prohíbe abrir fichas durante un cierre: lo que
aparezca se anota como desvío y se decide en el momento. Se le expuso el calendario al usuario
y **decidió seguir adelante**. Queda anotado como desvío en el
[spec del cierre](2026-09-07-cierre-pendientes-design.md).

## Verificación previa — qué estaba bien y qué no

Antes de diseñar nada se comprobó el motor con **12 635 comprobaciones sobre valores
aleatorios** (no los presets): R de 1 kbit/s a 10 Gbit/s, d de 1 m a 400 000 km, L de 8 bits a
10 Mbit, caminos de 1 a 5 saltos. **Cero fallas** en las identidades del modelo:
`U = 1/(1+2a)` con un salto, `ciclo = Tt + 2Tp + Tt(ACK)`, el recomputo independiente del
multi-salto, la transferencia, la monotonía y los casos límite.

**El motor no tiene errores de cálculo.** Lo que sí aparecieron son seis defectos de
presentación y de atribución, y entran en este spec:

| # | Defecto | Evidencia |
|---|---|---|
| 1 | La `a` agregada del multi-salto (`ΣTp/ΣTt`) no reproduce `U` (`Tt₁/ciclo`), y la gráfica planta el punto sobre la curva `U=1/(1+2a)` igual. Peor caso hallado: 4 saltos, `a = 0,00025` → la curva dice 99,95 %, `U` real 0,00088 % | Barrido aleatorio, 1000 caminos |
| 2 | Se llama **BDP** a `R·RTT = 26 000 bits`. El BD del libro es `R·Tp = 12,5 kbit = 12,5 tramas`; **26 tramas es la ventana `2BD+1`**. Coinciden por la identidad `R·RTT = 2·BD + L`, no por ser lo mismo | Libro p. 201 |
| 3 | Se cita `U = 3,846 %` como número del libro. El libro dice 500/520 = 96 % bloqueado y **«sólo se usó 4 %»**. El 3,846 % es nuestro cálculo exacto, correcto pero no una cita | Libro p. 200 |
| 4 | El preset «LAN 10 Mbps · 1 km» (`a = 0,1`, `U = 83,33 %`) figura como ejemplo del libro. **`83,3` y `1 + 2a` no aparecen en las 820 páginas.** Es formulación de Stallings: Tanenbaum nunca define `a` | Búsqueda sobre el PDF completo |
| 5 | Con varios saltos, `U` es la del **enlace del emisor**, no «del canal». La etiqueta miente | Lectura de `network.js` |
| 6 | `tramas = ⌈fichero/L⌉` supone que los L bits son todos datos. Sin cabecera, el goodput de un fichero sale inflado | El propio libro usa 40 b de cabecera + 3960 de datos en sus ejercicios |

Lo que **sí** está bien citado y se confirmó en el PDF: Protocolo 3 = PAR (p. 194–195), el
satélite de 50 kbit/s con RTT de 500 ms y tramas de 1000 bits (p. 200), y que un código
polinomial con `r` bits de verificación detecta toda ráfaga de longitud ≤ `r` (p. 185).

## Decisiones tomadas (con quién y por qué)

| Decisión | Motivo |
|---|---|
| **MathML nativo** para las fórmulas, no KaTeX ni MathJax | La regla de cero dependencias y cero build es dura. Se verificó en el Chromium del proyecto que MathML dibuja la fracción de verdad (numerador apilado, raya, anchos igualados) **sin cargar un solo fichero** |
| **`steps.js` sigue devolviendo datos, no markup** | Su propia cabecera lo declara. La fórmula se emite como estructura y la traduce un módulo aparte. Si `steps.js` escupiera MathML, las pruebas tendrían que parsear HTML para comprobar un número |
| **Quitar solo `P error trama` y `P error ACK`, y solo de la calculadora** | Petición literal del usuario. El simulador conserva su ruido entero |
| **No borrar los pasos de error de `steps.js`** | Sin las P, `conErrores` es falso y los pasos se apagan solos. Borrar código que ya sabe apagarse es trabajo sin ganancia y rompería las pruebas que lo cubren |
| **`a_efectiva` en vez de esconder la gráfica en multi-salto** | Definida como `(ciclo − Tt₁)/(2·Tt₁)`, cumple `U = 1/(1+2a_ef)` **por construcción**, así que el punto cae siempre sobre la curva. Con un salto y ACK despreciable es la `a` de toda la vida: no se pierde el caso del libro |
| **Cabecera por defecto en 0** | Entra porque sin ella el goodput miente (defecto 6), pero apagada no cambia ningún número existente ni ninguna prueba |
| **La ráfaga de ruido y el `timeout ≥ RTT` se quedan** | El usuario acotó el recorte a las dos probabilidades |

## Diseño

### Módulos nuevos

**`js/unidades.js`** — la escalera de magnitudes, sin DOM.

Expone, para un valor y su dimensión, la cadena de conversión completa en vez del resultado
final: de qué unidad se parte, por qué factor se multiplica y a qué unidad se llega. Decimal
(1000), coherente con el resto del proyecto: 1 KB son 1000 bytes, no 1024. Devuelve también la
forma en notación científica.

**`js/mathml.js`** — traductor de estructura a nodos MathML.

Entiende un puñado de formas: fracción, igualdad, producto, número con unidad, potencia de
diez. Nada más; no es un motor de LaTeX. Construye nodos con `createElementNS`, no cadenas de
HTML, para que no haya inyección posible desde un valor de entrada.

### Cambio en `steps.js`

Cada paso gana un campo `derivacion`: una lista ordenada de renglones, cada uno con su
estructura de fórmula y su motivo. El paso deja de ser
*fórmula → sustitución → resultado* y pasa a ser una cadena:

```
Tt = L / R                          la fórmula
Tt = 1000 bits / 50 000 bit/s       sustituidos los datos, con unidades
Tt = 0,02 s                         bits / (bit/s) cancela: queda s
Tt = 0,02 s × 1000 ms/s             el factor que faltaba, dicho
Tt = 20 ms = 2 × 10⁻² s             resultado, en unidad natural y en científica
```

Los campos `formula`, `sustitucion` y `resultado` **se conservan** como texto plano: son lo que
comprueban las pruebas existentes y lo que se lee si MathML fallara.

### Cambios en la interfaz

- `Tamaño de la trama`, `Tamaño del fichero` y `Cabecera` suben al bloque **Datos**, siempre
  visibles. Hoy el fichero está escondido tras escribir un valor mayor que cero, y por eso el
  usuario no lo encontró.
- Los tres con selector de unidad: `bits / bytes / KB / MB`.
- Desaparecen los campos `P error trama` y `P error ACK` de cada tramo.
- El preset «LAN» sale de «Ejemplos verificados» y pasa a un rótulo propio que dice de dónde
  viene. El pie de página deja de atribuir a Tanenbaum lo que no es suyo.
- La fila del BDP se parte en dos: `BD = R·Tp` y `ventana = 2BD+1`.

### Qué NO entra

El simulador (`index.html`, `sim.js`, `ui.js`), la versión Python y el v1 no se tocan.
Tampoco entra Go-Back-N, ni piggybacking, ni cambiar el motor de tiempos: la verificación ya
dijo que está bien.

## Pruebas

TDD, y las nuevas van sobre valores aleatorios, no sobre los presets:

- `unidades.js`: la cadena de conversión reconstruye el valor original; la escalera es
  monótona; la científica y la natural son el mismo número.
- `mathml.js`: una fracción produce un `mfrac` con dos hijos; un valor con caracteres raros no
  inyecta nodos.
- `a_efectiva`: **invariante sobre caminos aleatorios de 1 a 5 saltos** — `1/(1+2a_ef)` debe
  dar `U` con tolerancia de coma flotante. Es la prueba que habría cazado el defecto 1.
- Cabecera: con cabecera 0 los números no cambian respecto de hoy; con cabecera > 0 el goodput
  baja y las tramas suben.
- Se ajustan los casos de `bordes.test.js` y `steps.test.js` que metían las P por la
  calculadora.

El conteo de pruebas se actualiza **solo** en `05-runbook.md`, su fuente única.

## Riesgo

El único real es el calendario: esto se aprueba la víspera de la entrega. Mitigación: el orden
del plan pone primero lo que corrige defectos reales (`a_efectiva`, BD contra ventana,
atribuciones) y después lo cosmético (MathML), de modo que si hay que parar a mitad, lo que
quede fuera sea lo decorativo y no lo incorrecto.
