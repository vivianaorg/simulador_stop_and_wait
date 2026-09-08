// mathml.js
// Traduce una estructura de fórmula a MathML nativo. Sin librería: se comprobó
// en el Chromium del proyecto que el navegador dibuja la fracción de verdad
// —numerador apilado, raya, anchos igualados— sin cargar ni un fichero. KaTeX o
// MathJax violarían la regla de cero dependencias.
//
// Va en dos capas a propósito:
//   describir(expr) -> objetos planos. PURA, y es lo que prueban los tests.
//   render(expr, doc) -> nodos MathML. Necesita navegador; se comprueba en
//                        banco-interfaz.html.
// Sin esa partición habría que meter jsdom, que es una dependencia.
//
// `render` construye con createElementNS y asigna texto con textContent: un
// valor de entrada nunca se interpreta como markup.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MathMLModel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NS = "http://www.w3.org/1998/Math/MathML";

  const hoja = (tag, texto) => ({ tag, texto: String(texto) });
  const rama = (tag, hijos) => ({ tag, hijos });

  // Espacio fino delante de la unidad, como se escribe en física: "20 ms".
  const conUnidad = (nodo, u) => (u ? rama("mrow", [nodo, hoja("mtext", `\u2009${u}`)]) : nodo);

  function describir(expr) {
    if (!expr || typeof expr !== "object") return hoja("mtext", String(expr));

    switch (expr.t) {
      case "sim":
        return hoja("mi", expr.v);
      case "num":
        return conUnidad(hoja("mn", expr.v), expr.u);
      case "op":
        return hoja("mo", expr.v);
      case "frac":
        return rama("mfrac", [describir(expr.num), describir(expr.den)]);
      case "pot10":
        return conUnidad(
          rama("mrow", [
            hoja("mn", expr.mantisa),
            hoja("mo", "\u00d7"),
            rama("msup", [hoja("mn", "10"), hoja("mn", expr.exponente)]),
          ]),
          expr.u
        );
      case "fila":
        return rama("mrow", (expr.partes || []).map(describir));
      default:
        // Una forma que no se entiende se enseña como texto en vez de
        // desaparecer: un hueco en blanco en la pizarra es peor que un feo.
        return hoja("mtext", expr.v === undefined ? "?" : String(expr.v));
    }
  }

  function construir(desc, doc) {
    const el = doc.createElementNS(NS, desc.tag);
    if (desc.hijos) desc.hijos.forEach((h) => el.appendChild(construir(h, doc)));
    else el.textContent = desc.texto;
    return el;
  }

  function render(expr, doc) {
    const math = doc.createElementNS(NS, "math");
    math.setAttribute("display", "inline");
    math.appendChild(construir(describir(expr), doc));
    return math;
  }

  return { describir, render, NS };
});
