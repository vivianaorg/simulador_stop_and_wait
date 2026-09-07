# Simulador Stop &amp; Wait — v2 (calculadora de enlace multi-salto)

Sitio estático. **Sin build, sin dependencias, sin base de datos y sin login.**
Se despliega copiando esta carpeta.

## Ejecutar en local

```bash
python -m http.server 8000 --directory simulador_stop_and_wait_v2
```

Abrir `http://localhost:8000`.

> Servir la carpeta, no abrir `index.html` con doble clic: con `file://` el navegador
> aplica restricciones que no reflejan cómo se verá desplegado.

## Desplegar

Cualquier hosting estático sirve tal cual: GitHub Pages, Netlify, Vercel, Cloudflare Pages.
No hay paso de compilación ni variables de entorno.

- **GitHub Pages:** publicar la rama y apuntar Pages a esta carpeta. El archivo `.nojekyll`
  ya está para que no se filtren rutas.
- **Netlify / Vercel:** *publish directory* = `simulador_stop_and_wait_v2`, *build command* = vacío.

## Pruebas

El motor de cálculo (`js/network.js`) se prueba con el runner nativo de Node —**no añade
ninguna dependencia**:

```bash
node --test simulador_stop_and_wait_v2/tests/network.test.js
```

Cada fórmula que aparece en la interfaz tiene su caso con un número publicado:

| Caso | Comprobación |
|---|---|
| Satélite de Tanenbaum: 50 kbps, 1000 bits, 500 ms de RTT | Tt = 20 ms, ciclo = 520 ms, **U = 3,846 %** |
| LAN: 10 Mbps, 1 km, V = 2·10⁸ m/s, 500 bits | **a = 0,1 · U = 0,8333** |
| Reducción a la forma del libro | `U = 1/(1+2a)` con un salto y ACK despreciable |
| `a` frente a su forma cerrada | `a = (R·d)/(V·L)` |
| Cadena casa → satélite → casa | RTT = suma de tramos (store-and-forward) |
| Half duplex | + 2 × tiempo de vuelta por ciclo |
| Con errores | `U_efectiva = (1−P)/(1+2a)`, intentos = `1/(1−P)` |
| BDP del satélite | 26 000 bits = **26 tramas** en el canal |

## Estructura

```
index.html          calculadora
css/style.css       estilos propios
js/network.js       modelo: tiempos, utilización, errores (sin DOM)
js/calc.js          interfaz: lee controles, pinta resultados
tests/              pruebas del modelo
```

`js/network.js` es el **dueño único** de las fórmulas. `js/calc.js` las consume; no
recalcula nada.

## Alcance

Protocolo 3 de Tanenbaum (**Stop &amp; Wait con ARQ**). No entra ventana deslizante
(Go-Back-N, Selective Repeat): queda fuera del alcance de la asignatura.

Documentación del proyecto: [`../docs/00-INDEX.md`](../docs/00-INDEX.md).
