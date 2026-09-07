# 05 — Runbook

Comandos y procedimientos, para copiar y pegar. Si un comando cambia, se cambia acá el mismo día.
Todo se ejecuta desde la raíz del repo salvo que se diga otra cosa.

## Ejecutar el v2 (calculadora, donde se trabaja)

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

Pruebas del motor, con el runner nativo de Node (**no instala nada**):

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

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
node --test simulador_stop_and_wait_v2/tests/network.test.js
node --check simulador_stop_and_wait_v2/js/network.js
node --check simulador_stop_and_wait_v2/js/calc.js
node --check simulador_stop_and_wait_web/js/protocol.js
node --check simulador_stop_and_wait_web/js/app.js
python -m py_compile simulador_stop_and_wait_python/*.py
```

Baseline 2026-09-07, Node v24.11.1 y Python 3.13.14: **15 pruebas verdes, 0 fallas**; el resto,
limpio. La interfaz no tiene pruebas automáticas: se verifica con el render sin cabeza y con el
checklist de humo.

## Verificar la interfaz sin Chrome instalado

Playwright no encuentra Chrome en este PC, pero su Chromium **ya está descargado**. Se puede
renderizar la página de verdad (ejecuta el JavaScript) y volcar el DOM resultante:

```bash
CH="C:/Users/gogam/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"
python -m http.server 8123 --directory simulador_stop_and_wait_v2 &
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom http://localhost:8123/ > dom.html
"$CH" --disable-gpu --no-sandbox --virtual-time-budget=5000 --window-size=1280,2200 --screenshot=calc.png http://localhost:8123/
```

Comprobación rápida de que los números son los del libro:

```bash
grep -o 'id="out-u">[^<]*' dom.html      # -> 3.85 %
grep -o 'id="out-bdp">[^<]*' dom.html    # -> 26000 bits · 26.00 tramas
```

También conviene comprobar que todo `getElementById` del JS tiene su `id` en el HTML: es la
gotcha más habitual de este proyecto y no da error visible.

## Checklist de humo del v2 (calculadora)

1. Los tres presets cargan y dan: **satélite** U = 3,85 % y BDP 26 tramas · **LAN** a = 0,1 y
   U = 83,33 % · **casa → satélite → casa** RTT = 482,15 ms, a = 79,52 y U = 0,207 % con 2 saltos.
2. "Añadir salto" y "Quitar" funcionan; con un solo salto, "Quitar" avisa y no borra.
3. Un valor inválido (R = 0, V = 0, P = 1,5) muestra el mensaje de error, no un `NaN`.
4. Cambiar a half duplex con tiempo de vuelta > 0 sube el ciclo y baja U, **sin mover el RTT**.
5. El desarrollo paso a paso coincide con las casillas de arriba.

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
| Un control nuevo no responde y la consola dice `Cannot read properties of undefined` | El elemento no se registró en `_cacheDom()` (`js/app.js:141`) | Agregarle `id` en `index.html` y su línea en `_cacheDom()` |
| Se edita un `.js` y el navegador sigue mostrando lo viejo | Caché del navegador | Recarga dura (`Ctrl+F5`) o DevTools con *Disable cache* |
| La pestaña en segundo plano deja la animación "atrasada" | El navegador limita `requestAnimationFrame` fuera de foco | Es del navegador, no del simulador: no perseguirlo |
| `python main.py` falla con `ModuleNotFoundError: tkinter` | Python sin soporte Tk | Usar el instalador oficial de Python; no afecta a la versión web |
| El temporizador corre aunque no se haya provocado ninguna pérdida | **Correcto**: `timerActive` corre siempre; `isWaitingTimeout` es solo para la pérdida explícita (`js/protocol.js:13-21`) | No "corregirlo" |
