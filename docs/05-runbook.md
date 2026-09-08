# 05 — Runbook

Comandos y procedimientos, para copiar y pegar. Si un comando cambia, se cambia acá el mismo día.
Todo se ejecuta desde la raíz del repo salvo que se diga otra cosa.

## Ejecutar el v2 (donde se trabaja)

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

`index.html` es el simulador; `calculadora.html`, la calculadora.

Pruebas, con el runner nativo de Node (**no instala nada**):

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
```

**Nombrar los archivos, no la carpeta:** `node --test tests/` falla en este equipo con
`Cannot find module ...	ests`.

## Ejecutar el v1 (simulador animado)

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_web
```

Abrir `http://localhost:8000`. No hay build ni instalación.

> **Servirla, no abrirla con doble clic.** Con `file://` el navegador aplica restricciones que
> pueden romper la carga; además así se prueba en las mismas condiciones que en un hosting.

Para entregarla como sitio estático (GitHub Pages, Netlify, Vercel): se publica la carpeta
`simulador_stop_and_wait_web/` tal cual, sin pasos de build.

## Ejecutar la versión Tkinter (congelada, solo referencia)

```bash
python simulador_stop_and_wait_python/main.py
```

Requiere un Python con Tk (el instalador oficial de Windows lo trae). No se desarrolla más:
ver [04-convenciones.md](04-convenciones.md) § B.1.

## Verificación (pipeline)

```bash
node --test simulador_stop_and_wait_v2/tests/frame.test.js simulador_stop_and_wait_v2/tests/network.test.js simulador_stop_and_wait_v2/tests/sim.test.js simulador_stop_and_wait_v2/tests/steps.test.js simulador_stop_and_wait_v2/tests/bordes.test.js
node tools/lint-docs.js
for f in simulador_stop_and_wait_v2/js/*.js; do node --check "$f"; done
node --check simulador_stop_and_wait_web/js/protocol.js
node --check simulador_stop_and_wait_web/js/app.js
python -m py_compile simulador_stop_and_wait_python/*.py
```

Baseline 2026-09-07, Node v24.11.1 y Python 3.13.14: **95 pruebas verdes, 0 fallas**; el banco de
interfaz con 54 comprobaciones sin problemas; el lint de documentación limpio; el resto, sin
avisos.

> **Este archivo es la fuente única del conteo de pruebas.** Ningún otro documento lo repite: lo
> enlazan. El lint falla si aparece en otro sitio, y también si el número escrito aquí no coincide
> con las pruebas que hay de verdad en el repositorio.

## Lint de documentación

```bash
node tools/lint-docs.js
```

Sin dependencias. Comprueba cuatro cosas mecánicas: enlaces rotos entre documentos, rutas citadas
que no existen, citas del tipo `archivo.js:NN` (que además desaconseja: mejor el nombre de la
función) y el conteo de pruebas fuera de su fuente única o desactualizado.

**No comprueba** si una frase describe algo que el código no hace. Eso solo lo ve alguien leyendo
el texto contra el código, y por eso sigue siendo una regla de `04-convenciones.md` y no una
tarea del script.

Los documentos fechados —`07-historial.md` y `docs/superpowers/`— se libran de las comprobaciones
de rutas y conteos: son registros de su momento, y corregirlos falsificaría el archivo. Sus
enlaces sí se comprueban.

Para citar a propósito un archivo que **no** existe (por ejemplo, para decir que el proyecto no
tiene `package.json`), se marca la línea con `<!-- lint:ruta-ausente -->`. La interfaz no tiene pruebas automáticas: se verifica con el render sin cabeza y con el
checklist de humo.

## Banco de pruebas de la interfaz

`simulador_stop_and_wait_v2/banco-interfaz.html` carga el simulador y la calculadora en dos
iframes, los maneja como lo haría una persona —clics, valores inválidos, rueda del ratón— y
comprueba lo que queda en pantalla. Sin dependencias.

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
# abrir http://localhost:8000/banco-interfaz.html
```

El resumen sale arriba del todo. Al 2026-09-07: **54 comprobaciones, 0 problemas**, y repetible:
espera a que cada iframe termine de montarse en vez de dormir un rato fijo.

**No sustituye a probarlo a mano.** Ve si el comportamiento es el esperado, no si algo se ve mal:
el selector de canal cortado o una etiqueta encima de otra solo se ven mirando.

## Verificar la interfaz sin Chrome instalado

Playwright no encuentra Chrome en este PC, pero su Chromium **ya está descargado**. Se puede
renderizar la página de verdad (ejecuta el JavaScript) y volcar el DOM resultante:

```bash
CH="C:/Users/gogam/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"
python -m http.server 8123 --directory simulador_stop_and_wait_v2 &
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom http://localhost:8123/calculadora.html > dom.html
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --window-size=1280,2200 --screenshot=calc.png http://localhost:8123/calculadora.html
```

**Para el simulador hace falta un truco.** Bajo tiempo virtual, `requestAnimationFrame` apenas
corre, así que la animación no avanza sola. Se empuja con el botón *Un paso* desde una página
temporal que carga el simulador en un `iframe` y pulsa los botones; luego se captura esa página
y se borra el archivo. Con ~350 pulsaciones se ven varios ciclos completos.

Comprobación rápida de que los números son los del libro:

```bash
grep -o 'id="out-u">[^<]*' dom.html      # -> 3.85 %
grep -o 'id="out-bdp">[^<]*' dom.html    # -> 26000 bits · 26.00 tramas
```

También conviene comprobar que todo `getElementById` del JS tiene su `id` en el HTML: es la
gotcha más habitual de este proyecto y no da error visible.

## Checklist de humo del v2 (simulador)

1. Con un solo tramo: al pulsar *Iniciar*, el diagrama dibuja trama, ACK y la alternancia 0/1,
   y termina en «Completado».
2. *Añadir punto* mete un nodo intermedio: la trama se dibuja atravesándolo (dos flechas por
   sentido) y el RTT crece.
3. En pausa, pulsar un bit del inspector lo pone en rojo y el CRC pasa a «no cuadra»; al llegar
   al receptor se descarta y hay que esperar el temporizador.
4. Con *Enviar NAK* activado, ese mismo caso se recupera sin esperar el temporizador.
5. *Destruir* y *Retrasar* dejan su marca en el diagrama (aspa y ACK que llega tarde).
6. *Forzar seq* hace que el receptor la trate como duplicada y repita el ACK.
7. El timeout se ajusta solo al cambiar el camino; si se escribe uno a mano, se respeta y el
   aviso dice cuánto margen queda sobre el RTT.
8. La misma semilla con la misma configuración da la misma simulación.
9. Con el canal en **half duplex** y tiempo de vuelta > 0, aparecen barras verticales ámbar
   antes de cada ACK y de cada trama siguiente, y el ciclo se alarga sin que cambie el RTT.
10. La rueda del ratón sobre el diagrama muestra el aviso «histórico» y deja ver lo anterior;
    el doble clic vuelve al presente.
11. Con el **ruido apagado** (por defecto), la probabilidad de cada tramo aparece deshabilitada y
    no ocurre ningún error solo; al encenderlo, se habilita y empiezan a aparecer.
12. *Dañar un bit al azar* deja el CRC en «no cuadra», igual que pulsar un bit a mano.
13. *Ver el CRC paso a paso* muestra el polinomio, una fila por byte y el veredicto; al desplegar
    una fila salen sus ocho desplazamientos, y abrir otra cierra la anterior.

## Checklist de humo del v2 (calculadora)

1. Los tres presets cargan y dan: **satélite** U = 3,846 % y BDP 26 tramas · **LAN** a = 0,1 y
   U = 83,33 % · **casa → satélite → casa** RTT = 482,15 ms, a = 79,52 y U = 0,207 % con 2 saltos.
2. "Añadir salto" y "Quitar" funcionan; con un solo salto, "Quitar" avisa y no borra.
3. Un valor inválido (R = 0, V = 0, P = 1,5) muestra el mensaje de error, no un `NaN`.
4. Cambiar a half duplex con tiempo de vuelta > 0 sube el ciclo y baja U, **sin mover el RTT**.
5. *Mostrar el siguiente paso* avanza de uno en uno y el contador dice "Paso N de M";
   *Mostrar todos* los abre y *Ocultar* los cierra.
6. Al abrir el detalle de un paso, **el que estuviera abierto se cierra**.
7. Con P de error > 0 aparecen los dos pasos extra (P del ciclo y utilización efectiva) y el
   titular añade la utilización efectiva.
8. La curva marca este enlace en el punto correcto y la tabla de debajo lo repite con la fila
   resaltada; al pasar el ratón sale la lectura `a → U`.
9. Con el tabulador se llega a la tabla de la curva y se ve el foco; el lector de pantalla
   anuncia los números de cada gráfica, no solo su título.

## Checklist de humo del v1 (simulador animado)

Se corre entero, en el navegador, sobre la versión servida. Cada línea se marca solo si se vio.

1. **Camino feliz** — `Iniciar` con los valores por defecto: las tramas viajan, cada una recibe
   su ACK, el número de secuencia alterna 0/1 y al terminar el estado queda en `FINISHED`.
2. **Pérdida de trama** — durante un envío, `Destruir trama en tránsito`: expira el temporizador, se cuenta
   una retransmisión y la misma secuencia se reenvía y se entrega.
3. **Pérdida de ACK** — `Destruir ACK en tránsito`: el emisor retransmite, el receptor **descarta el
   duplicado** (no incrementa las tramas entregadas) y responde ACK otra vez.
4. **ACK retrasado** — `Retrasar ACK (desincronización)`: se retransmite, el ACK tardío llega después y queda
   contado en `ACKs tardíos` sin romper la secuencia.
5. **Pausa y reset** — `Pausar` congela la animación y el temporizador; `Reiniciar` deja los
   contadores en cero y el estado en `IDLE`.
6. **Parámetros del enlace** — cambiar L, R, D o V actualiza Tt, Tp, `a`, U y la barra de
   ocio/uso. Con D grande (o R alto) U cae: es el resultado esperado, no un bug.
7. **Formulario** — nº de tramas y timeout fuera de rango o vacíos no dejan la simulación en un
   estado inconsistente.
8. **Tema y tamaño** — alternar claro/oscuro y redimensionar la ventana: el canvas se redibuja
   sin recortar los nodos.

Lo que falle se anota en [06-pendientes.md](06-pendientes.md) con lo que se vio, no se "arregla
de paso" en medio del checklist.

## Gotchas operativas

| Síntoma | Causa | Qué hacer |
|---|---|---|
| Un control nuevo no responde y la consola dice `Cannot read properties of undefined` | El elemento no se registró en `_cacheDom()` | Agregarle `id` en `index.html` y su línea en `_cacheDom()` |
| Se edita un `.js` y el navegador sigue mostrando lo viejo | Caché del navegador | Recarga dura (`Ctrl+F5`) o DevTools con *Disable cache* |
| La pestaña en segundo plano deja la animación "atrasada" | El navegador limita `requestAnimationFrame` fuera de foco | Es del navegador, no del simulador: no perseguirlo |
| `python main.py` falla con `ModuleNotFoundError: tkinter` | Python sin soporte Tk | Usar el instalador oficial de Python; no afecta a la versión web |
| El temporizador corre aunque no se haya provocado ninguna pérdida | **Correcto**: `timerActive` corre siempre; `isWaitingTimeout` es solo para la pérdida explícita | No "corregirlo" |
