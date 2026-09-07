# simulador_stop_and_wait

Simulador visual del protocolo de control de flujo Stop & Wait (transmisión de tramas, ACKs, pérdidas simuladas y temporizador de timeout).

Incluye dos versiones equivalentes:

## Versión web (`simulador_stop_and_wait_web/`)

HTML + CSS + JavaScript puro, sin dependencias ni build. Corre en cualquier navegador.

Para ejecutarla localmente:

```
cd simulador_stop_and_wait_web
python -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador. También puede desplegarse como sitio estático (GitHub Pages, Netlify, Vercel, etc.) sirviendo directamente la carpeta.

## Versión de escritorio (`simulador_stop_and_wait_python/`)

Aplicación Tkinter para Python.

```
cd simulador_stop_and_wait_python
python main.py
```
