#!/usr/bin/env node
// lint-docs.js — comprueba que la documentación no mienta en lo que se puede
// comprobar con una máquina. Sin dependencias: solo Node.
//
// Qué caza:
//   1. Enlaces Markdown a documentos que no existen.
//   2. Rutas citadas entre comillas invertidas que no existen.
//   3. Citas `archivo.js:NN` con la línea fuera de rango.
//   4. Conteos de pruebas fuera de su fuente única, o que no coinciden con las
//      pruebas que hay de verdad.
//
// Qué NO caza, y conviene tener presente: una frase que describe un
// comportamiento que el código no tiene. Eso solo lo ve alguien leyendo el
// texto contra el código. Este script da confianza sobre lo mecánico, no sobre
// lo semántico.

"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");

// Documentos que se revisan.
const DOCUMENTOS = [
  "CLAUDE.md",
  "AGENTS.md",
  "README.md",
  "simulador_stop_and_wait_v2/README.md",
  ...listarMarkdown(path.join(RAIZ, "docs")),
];

// Fuente única del conteo de pruebas.
const FUENTE_DEL_CONTEO = "docs/05-runbook.md";

// Los documentos fechados son registros, no estado: describen lo que era cierto
// ese día y no se reescriben. Por eso no se les exige ni el conteo ni las
// rutas: un spec puede citar un archivo que después se borró, y corregirlo
// falsificaría el archivo. Los enlaces sí se comprueban en todos: un enlace
// roto no informa de nada, solo estorba.
const REGISTROS = [/^docs[\\/]07-historial\.md$/, /^docs[\\/]superpowers[\\/]/];

// Nombres genéricos que aparecen dentro de una regla o un ejemplo, no como
// referencia a un archivo real.
const MARCADORES = /^(archivo|fichero|ejemplo|AAAA)[.-]/i;

// Una línea marcada así cita a propósito algo que NO existe (por ejemplo, para
// decir que el proyecto no tiene ese archivo).
const ESCAPE_RUTA = "<!-- lint:ruta-ausente -->";

const errores = [];

function listarMarkdown(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...listarMarkdown(completo));
    else if (entrada.name.endsWith(".md")) salida.push(path.relative(RAIZ, completo));
  }
  return salida;
}

function esRegistro(relativo) {
  return REGISTROS.some((r) => r.test(relativo));
}

function fallo(documento, linea, mensaje) {
  errores.push(`${documento}:${linea}  ${mensaje}`);
}

// ---------- 1 · Enlaces Markdown ----------

function revisarEnlaces(documento, texto) {
  const lineas = texto.split("\n");
  lineas.forEach((linea, i) => {
    for (const [, destino] of linea.matchAll(/\]\(([^)\s#]+\.md)[^)]*\)/g)) {
      if (/^(https?:|file:|mailto:)/.test(destino)) continue;
      const objetivo = path.resolve(RAIZ, path.dirname(documento), destino);
      if (!fs.existsSync(objetivo)) fallo(documento, i + 1, `enlace roto → ${destino}`);
    }
  });
}

// ---------- 2 y 3 · Rutas y líneas citadas ----------

// Parece una ruta de archivo del proyecto: tiene extensión conocida y no es
// una orden de terminal ni un comodín.
const EXTENSIONES = ["js", "html", "css", "py", "md", "json"];
const PATRON_RUTA = new RegExp(
  `\`([A-Za-z0-9_./\\\\-]+\\.(?:${EXTENSIONES.join("|")}))(?::(\\d+)(?:-(\\d+))?)?\``,
  "g"
);

// Índice de todos los archivos del repositorio, para poder resolver una cita
// corta como `network.js` sin exigir la ruta entera.
let indiceArchivos = null;

function indexar(dir, acumulado) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === ".git" || entrada.name === "__pycache__" || entrada.name === "node_modules") continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) indexar(completo, acumulado);
    else acumulado.push(path.relative(RAIZ, completo).split(path.sep).join("/"));
  }
  return acumulado;
}

function resolverRuta(documento, ruta) {
  if (indiceArchivos === null) indiceArchivos = indexar(RAIZ, []);

  const directo = path.resolve(RAIZ, path.dirname(documento), ruta);
  if (fs.existsSync(directo) && fs.statSync(directo).isFile()) return directo;

  const normalizada = ruta.split(path.sep).join("/").replace(/^\.\//, "");
  const coincidencias = indiceArchivos.filter(
    (f) => f === normalizada || f.endsWith("/" + normalizada)
  );
  return coincidencias.length > 0 ? path.join(RAIZ, coincidencias[0]) : null;
}

function revisarRutas(documento, texto) {
  const lineas = texto.split("\n");
  lineas.forEach((linea, i) => {
    if (linea.trimStart().startsWith(">")) return; // citas textuales
    if (linea.includes(ESCAPE_RUTA)) return; // ausencia declarada a propósito
    for (const coincidencia of linea.matchAll(PATRON_RUTA)) {
      const [, ruta, desde, hasta] = coincidencia;
      if (ruta.includes("*") || ruta.startsWith("~") || ruta.includes("AAAA")) continue;
      if (MARCADORES.test(path.basename(ruta))) continue;

      const resuelta = resolverRuta(documento, ruta);
      if (!resuelta) {
        fallo(documento, i + 1, `ruta citada que no existe → ${ruta}`);
        continue;
      }

      if (desde) {
        const total = fs.readFileSync(resuelta, "utf8").split("\n").length;
        const ultima = Number(hasta || desde);
        if (Number(desde) < 1 || ultima > total) {
          fallo(
            documento,
            i + 1,
            `línea fuera de rango → ${ruta}:${desde}${hasta ? "-" + hasta : ""} (el archivo tiene ${total})`
          );
        } else {
          fallo(
            documento,
            i + 1,
            `cita por número de línea → ${ruta}:${desde}${hasta ? "-" + hasta : ""}. Usa el nombre de la función: los números se pudren en la edición siguiente`
          );
        }
      }
    }
  });
}

// ---------- 4 · Conteo de pruebas ----------

const PATRON_CONTEO = /(\d+)\s+pruebas/gi;

function pruebasReales() {
  const dir = path.join(RAIZ, "simulador_stop_and_wait_v2", "tests");
  if (!fs.existsSync(dir)) return null;
  let total = 0;
  for (const nombre of fs.readdirSync(dir)) {
    if (!nombre.endsWith(".test.js")) continue;
    const texto = fs.readFileSync(path.join(dir, nombre), "utf8");
    total += (texto.match(/^test\(/gm) || []).length;
  }
  return total;
}

function revisarConteos(documento, texto) {
  if (esRegistro(documento)) return;
  const relativo = documento.split(path.sep).join("/");
  const lineas = texto.split("\n");

  lineas.forEach((linea, i) => {
    for (const [, numero] of linea.matchAll(PATRON_CONTEO)) {
      if (relativo !== FUENTE_DEL_CONTEO) {
        fallo(
          documento,
          i + 1,
          `conteo de pruebas fuera de su fuente única (${FUENTE_DEL_CONTEO}) → "${numero} pruebas". Enlaza en vez de repetirlo`
        );
        continue;
      }
      const reales = pruebasReales();
      if (reales !== null && Number(numero) !== reales) {
        fallo(documento, i + 1, `el conteo dice ${numero} pruebas y hay ${reales}`);
      }
    }
  });
}

// ---------- Ejecución ----------

for (const documento of DOCUMENTOS) {
  const completo = path.join(RAIZ, documento);
  if (!fs.existsSync(completo)) continue;
  const texto = fs.readFileSync(completo, "utf8");
  revisarEnlaces(documento, texto);
  if (!esRegistro(documento)) revisarRutas(documento, texto);
  revisarConteos(documento, texto);
}

if (errores.length > 0) {
  console.error(`lint-docs: ${errores.length} problema(s)\n`);
  for (const error of errores) console.error("  " + error);
  process.exit(1);
}

const reales = pruebasReales();
console.log(
  `lint-docs: ${DOCUMENTOS.length} documentos revisados, sin problemas` +
    (reales === null ? "" : ` (${reales} pruebas contadas en el repositorio)`)
);
