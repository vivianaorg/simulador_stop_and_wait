# Spec — Ráfaga de ruido determinista y bloque de transferencia

Fecha: 2026-09-07 · Estado: **aprobado, sin implementar**

## Problema

El ruido del canal de hoy no sirve para explicar nada delante de un aula. Es una tirada de
probabilidad por tramo (`applyChannelNoise` en `simulador_stop_and_wait_v2/js/sim.js`): puede
pasar o no pasar. Quien enseña el simulador necesita lo contrario — apuntar a un intervalo y que
el daño ocurra, siempre, exactamente igual.

Y falta el ejercicio que hace todo el mundo en clase: *"una ráfaga de t ms sobre un canal de R
bps arruina cuántos bits, y cuántas tramas"*. Hoy no se puede contestar ni en el simulador ni en
la calculadora.

Se pide:

- Ruido **de ráfaga**, disparado a mano, medido en milisegundos, **sin azar de ninguna clase**.
- Que conviva con el daño de **un solo bit**, que ya existe y se conserva.
- El mismo ejercicio en la calculadora, con su desarrollo.
- Un bloque de **transferencia**: tamaño total y tamaño de trama → número de tramas y tiempo.

## Decisiones tomadas (con quién y por qué)

| Decisión | Motivo |
|---|---|
| **La ráfaga es determinista, sin generador ni semilla** | Petición explícita del usuario (2026-09-07): es material de explicación, y «no puedo fiarme de que pueda o no pasar». No entra en conflicto con la regla de `04` §B.1 —que prohíbe `Math.random` y exige repetibilidad— porque una ráfaga sin tirada es más repetible que una con semilla: no hay nada que sortear |
| **La ventana puede abarcar más de una trama** | Es la forma del ejercicio del libro: la respuesta cuenta tramas consecutivas, no una sola. Recortar a la trama en vuelo daría un número distinto al de la cuenta |
| **Un solo tamaño de trama: `frameBits` manda** | Hoy hay dos que no se hablan (ver abajo). Con dos, el número que enseña la calculadora y lo que ocurre en pantalla no son el mismo hecho, y eso se cae en la primera pregunta |
| **Los bits dañados son contiguos** | Es lo que hace una ráfaga: ensucia un intervalo de tiempo, y en el cable el tiempo es posición |
| **El bloque de transferencia ignora los errores** | `N × ciclo`, sin reenvíos esperados. Meter `1/(1−p)` es otra fórmula, otra prueba y otro concepto; queda fuera y se decide después de la entrega |
| **Los dos bloques de la calculadora van separados** | Cada uno contesta una pregunta y se calla. Mezclarlos convierte dos ejercicios claros en uno confuso |

## El nudo: hay dos tamaños de trama y no se hablan

Es lo que condiciona el diseño entero, y conviene dejarlo escrito porque no se ve leyendo el
código por encima.

- **`frameBits` (L)** — lo que escribe el usuario. Alimenta los **tiempos**: `Tt = L/R`, en
  `transmissionMs` (`js/network.js`). Es un número; no hay bits detrás.
- **La trama real** — la que construye `createFrame` (`js/frame.js`), con su carga y su CRC de
  16 bits. Es la que se dibuja en la tira y la que se puede dañar. Su tamaño sale de
  `payloadBytes`, que la interfaz pasa **fijo a 8**: 80 bits en total.

Una ráfaga de 10 ms a 100 kbps son 1000 bits. La trama de tiempos, con el valor por defecto, mide
1000 bits: cuadra. La real mide 80. No hay dónde meterlos.

**Se unifican: `frameBits` manda y la trama real se construye a partir de él.** Como el CRC son
16 bits fijos (`CRC_BITS` en `js/frame.js`), la carga es `(frameBits − 16) / 8` bytes.

Consecuencia: no todo valor de L es representable. Hace falta `L ≥ 24` y que `L − 16` sea
múltiplo de 8. **Un valor no representable se redondea al múltiplo válido más cercano y la
interfaz lo dice**, en vez de rechazarse: en un ejercicio nadie quiere pelearse con el
formulario, pero tampoco que le mientan sobre qué se calculó.

Alternativas descartadas:

| Alternativa | Por qué no |
|---|---|
| Dejar los dos tamaños y recortar la ráfaga a la trama real | La calculadora diría 1000 bits y la pantalla dañaría 80. Dos hechos distintos con el mismo nombre |
| Escalar el daño en proporción | Es una traducción inventada. No está en ningún libro y no se puede verificar contra ningún número publicado |

## Alcance

### Dentro

1. Tamaño de trama unificado, con redondeo avisado.
2. Volteo de un tramo contiguo de bits en `js/frame.js`.
3. Fórmula `bits = R · t` en `js/network.js`.
4. Ráfaga en el simulador: control, ventana en el reloj, banda en el diagrama, contador.
5. Calculadora: bloque de ráfaga y bloque de transferencia, cada uno con su desarrollo.
6. Pruebas de las tres fórmulas nuevas contra números publicados.

### Fuera

- Reenvíos esperados `1/(1−p)` en el tiempo total.
- Ráfagas programadas por adelantado o repetidas.
- Tocar el v1 o la versión Tkinter (congelados, `04` §B.1).

## Diseño

### 1 · Tamaño de trama unificado

La interfaz deja de pasar `payloadBytes` fijo y lo deriva de `frameBits`. La validación del
formulario acepta el valor, lo ajusta si hace falta y muestra el ajuste.

Las pruebas que hoy dependen del tamaño por defecto pasan a pedirlo explícitamente, así que
siguen valiendo sin cambiar lo que comprueban.

### 2 · El tramo de bits

Función nueva en `js/frame.js`, hermana de `flipBit`: voltea `n` bits contiguos desde un índice
dado. Si el tramo se sale del final de la trama **se corta ahí y devuelve cuántos llegó a
tocar** — el simulador lo necesita para saber si a la ráfaga le sobró alcance para la siguiente
trama.

No recibe generador. No hay ninguno que pasarle.

### 3 · La fórmula

En `js/network.js`, con el resto: `bitsDañados = R · t`, con `t` en segundos. Y la derivada,
`tramasAbarcadas`, que reparte esos bits sobre tramas de L bits.

### 4 · La ráfaga en el simulador

Un botón **«Ráfaga de ruido»** con su campo en milisegundos, junto a los de daño manual de
`index.html`. **No necesita trama seleccionada**, y ahí está la diferencia: la ráfaga es del
canal, no de una trama.

Al dispararla, el canal queda sucio durante esos milisegundos de reloj simulado. Lo que viaje
dentro de la ventana se lleva su parte; lo que entre mientras siga abierta, también.

**Este es el trozo con riesgo.** Hoy el ruido se aplica una sola vez, al entrar en el tramo
(`applyChannelNoise`). La ráfaga no puede: tiene que morder según el reloj, así que su cierre
entra en `proximoSucesoMs` (`js/sim.js`) como un suceso más, al lado del temporizador. Ese bucle
es lo que hace avanzar el simulador entero: si se rompe, no se rompe el ruido, se rompe todo.

En el diagrama, una **banda horizontal** que cruza el escenario marcando el intervalo sucio. En
telemetría, un contador de bits arruinados por ráfaga. El color, el rojo de error que ya está
declarado en `04` §B.1; sin degradados.

### 5 · La calculadora

Dos bloques nuevos e independientes en `calculadora.html`, con el mismo patrón de desarrollo
plegable que usan los demás (`js/steps.js` produce, `js/calc.js` pinta; `calc.js` no calcula).

**Transferencia** — entra tamaño total y sale: tramas `⌈total / L⌉`, tiempo `N × ciclo`, y el
caudal conseguido frente a R.

**Ráfaga** — entra duración y sale: bits `R · t` y tramas abarcadas.

## Pruebas

`04` §B.1 exige un número publicado por fórmula que llegue a la interfaz. Son tres nuevas: bits
de ráfaga, tramas abarcadas y tiempo total de transferencia.

**Se buscará el ejercicio concreto del libro y se citará en la prueba.** Si alguna de las tres no
encuentra respaldo publicado, **no se muestra en la interfaz** hasta decidirlo con el usuario. No
se inventa un número y se le llama «del libro».

Además, dos pruebas de comportamiento sin libro de por medio:

| Se comprueba | Cómo |
|---|---|
| La ráfaga es determinista | Dos simulaciones con la misma ráfaga producen los mismos bits volteados, sin pasar semilla |
| El tramo se corta en el borde | Una ráfaga más larga que la trama devuelve el número de bits realmente tocados, no el pedido |

## Definición de terminado

1. El tamaño de trama es uno solo, y un valor no representable se redondea con aviso visible.
2. La ráfaga daña siempre lo mismo, sin generador.
3. Cada fórmula nueva en pantalla tiene su prueba con número publicado, o no está en pantalla.
4. Suite verde con la salida vista, `node --check` limpio y lint de documentación en verde.
5. Comprobado en el navegador, no solo en las pruebas.
6. `07-historial.md` con qué, por qué y cómo revertir.

## Riesgos

| Riesgo | Qué lo dispara | Mitigación |
|---|---|---|
| El bucle de sucesos deja de avanzar | Meter el cierre de la ráfaga en `proximoSucesoMs` | Se implementa con prueba antes que código, y es lo primero que se verifica en el navegador |
| La tira de bits se vuelve ilegible | Tramas de 1000 bits en vez de 80 | Por encima de un umbral se pinta agrupada por bytes, con el tramo dañado marcado en bloque. Para enseñar una ráfaga es **más** legible que 1000 casillas |
| No aparece número publicado para alguna fórmula | La búsqueda en el libro falla | La fórmula no llega a la interfaz. Está en la definición de terminado |
| No entra antes del 2026-09-09 | Cinco piezas y dos días | Orden de corte declarado: lo primero que se retira es el bloque de transferencia de la calculadora, que es el único del que no depende nada más |

---

## Actualización del 2026-09-07 · la ráfaga se mide en bits

Nada de lo anterior se reescribe: `04` §A.3 regla 4. Esto es lo que cambió y por qué.

**Qué se buscó.** El texto de arriba daba por hecho que `R · t` era «la fórmula del libro». Se
comprobó contra Tanenbaum, *Redes de computadoras*, 5.ª edición, las 819 páginas. **No está.** El
libro mide las ráfagas **en bits**, nunca en milisegundos: los problemas del capítulo 3 hablan de
ráfagas de 24 y de 35 bits. No hay ningún ejercicio que dé una duración y una tasa.

**Qué sí está, y es mejor.** En la sección de códigos polinomiales, dos afirmaciones exactas:

1. Un código polinomial con **r** bits de verificación detecta **todos** los errores en ráfaga de
   longitud ≤ r.
2. Una ráfaga de longitud **r + 1** solo pasa desapercibida si es **idéntica a G(x)**.

Este proyecto usa CRC-16/CCITT, así que **r = 16** y `G(x) = 0x1021`. De ahí salen dos hechos
verificables sobre el código que ya existe en `frame.js`:

- Toda ráfaga de **hasta 16 bits** la detecta el CRC. Sin excepciones.
- De todas las ráfagas de **17 bits** que empiezan en una posición dada, **exactamente una** se
  cuela: la que reproduce el polinomio. Es un caso concreto, no una probabilidad.

**Decisión.** La unidad de la ráfaga pasa a ser el **bit**. Los milisegundos siguen en la
interfaz, porque es como se explica en clase (petición del usuario, 2026-09-07: «mi profe lo
explicó con R y t»), pero como **conversión declarada**, no como fórmula atribuida al libro:
`bits = R · t` se justifica por análisis dimensional —bits/s × s = bits—, y así se escribe en el
código y en el desarrollo de la calculadora.

**Lo que esto resuelve.** La Tarea 0 del plan pedía elegir entre citar a Tanenbaum sin haberlo
encontrado, citar a Forouzan, o justificar por forma cerrada. Con esta decisión ya no hace falta
prestar ninguna fuente: la afirmación fuerte que llega a la interfaz —el límite de los 16 bits—
es del libro de la asignatura, y la conversión desde milisegundos no necesita libro porque no
afirma nada más que su propio análisis dimensional.

**Lo que añade al alcance.** Dos pruebas sobre `frame.js` que antes no existían: que ninguna
ráfaga de longitud ≤ 16 sobrevive al CRC, y que la ráfaga de 17 bits igual a `0x11021` sí lo hace.
La segunda es el mejor material de explicación que ha salido de todo este diseño: enseña de un
golpe hasta dónde protege un CRC y dónde deja de hacerlo.
