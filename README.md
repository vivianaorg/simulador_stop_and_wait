# simulador_stop_and_wait

Simulador visual del protocolo de control de flujo Stop & Wait (transmisión de tramas, ACKs, pérdidas simuladas y temporizador de timeout).

Documentación interna del proyecto en [`docs/`](docs/00-INDEX.md) (arquitectura, convenciones,
runbook, pendientes e historial).

## Qué contiene el repositorio

| Carpeta | Qué es | Estado |
|---|---|---|
| `simulador_stop_and_wait_v2/` | **La versión que se entrega.** Simulador con diagrama tiempo-espacio, camino de varios puntos, detección de errores por CRC y calculadora | En desarrollo |
| `simulador_stop_and_wait_web/` | Simulador web de partida | **Se conserva como registro. No se mantiene** |
| `simulador_stop_and_wait_python/` | Versión de escritorio en Tkinter | **Se conserva como registro. No se mantiene** |

Las dos últimas son el **trabajo de partida del grupo**, sobre el que se construyó la versión
mejorada. Se conservan a propósito para que el repositorio muestre de dónde viene el trabajo; la
autoría de cada una está en el historial de git:

```bash
git log --format="%an %ad %s" --date=short -- simulador_stop_and_wait_web simulador_stop_and_wait_python
```

**Conservar no es mantener:** no se les añaden funciones, no se les escriben pruebas y no se
corrigen sus fallos conocidos. Lo que se entrega y se defiende es `simulador_stop_and_wait_v2/`.

## La versión que se entrega (`simulador_stop_and_wait_v2/`)

HTML + CSS + JavaScript, **sin dependencias, sin build, sin base de datos y sin login**.

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

`index.html` es el simulador; `calculadora.html`, la calculadora de enlace.
Detalle y pruebas: [`simulador_stop_and_wait_v2/README.md`](simulador_stop_and_wait_v2/README.md).

## Versiones de partida (se conservan, no se mantienen)

**Web** — HTML + CSS + JavaScript puro, sin dependencias ni build:

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_web
```

**Escritorio** — Tkinter sobre la biblioteca estándar de Python 3:

```bash
python simulador_stop_and_wait_python/main.py
```

Sus fallos conocidos están anotados en
[`docs/07-historial.md`](docs/07-historial.md) y **no se van a corregir**: quedan como parte del
registro de por dónde pasó el trabajo.
