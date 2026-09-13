// Capturas con cajas de los elementos a anotar. Cada figura -> PNG + JSON con
// las cajas (en px de imagen, DPR 2) relativas al contenedor capturado.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const EXE = 'C:/Users/gogam/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = 'http://localhost:8765/';
const DPR = 2;

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: DPR });
  const p = await ctx.newPage();

  // marks: [ [label, selector, anchor?] ]  anchor: 'tl' | 'tr' | 'l' | 'r' (default 'tl')
  async function fig(name, container, marks, opts = {}) {
    const loc = p.locator(container).first();
    await loc.scrollIntoViewIfNeeded();
    await p.waitForTimeout(80);
    const shotOpts = { path: path.join(OUT, name + '.png') };
    if (opts.fullPage) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ ...shotOpts, fullPage: true }); }
    else await loc.screenshot(shotOpts);
    const boxes = await p.evaluate(({ container, marks, fullPage }) => {
      const c = document.querySelector(container);
      const cr = fullPage ? { left: -window.scrollX, top: -window.scrollY } : c.getBoundingClientRect();
      return marks.map(([label, sel, anchor]) => {
        const el = typeof sel === 'string' ? document.querySelector(sel) : null;
        if (!el) return { label, missing: sel };
        const r = el.getBoundingClientRect();
        return { label, anchor: anchor || 'tl', x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
      });
    }, { container, marks, fullPage: !!opts.fullPage });
    const missing = boxes.filter((x) => x.missing);
    if (missing.length) console.log('  MISSING', name, JSON.stringify(missing));
    fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ dpr: DPR, boxes, manual: opts.manual || [] }, null, 1));
    console.log('fig', name);
  }
  const setNum = async (sel, v) => { await p.locator(sel).fill(String(v)); await p.locator(sel).dispatchEvent('change'); };
  const setSpeed = async (v) => { await p.locator('#speed').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); };
  const reset = async () => { await p.click('#btn-reset'); await p.waitForTimeout(150); };
  const waitDone = async () => { await p.waitForFunction(() => document.getElementById('state-name').textContent === 'Completado', null, { timeout: 60000 }); };
  const block = (n) => `aside.rail section.block:nth-of-type(${n})`;

  // ================= SIMULADOR =================
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(400);
  await setNum('#total-frames', 3);

  await fig('A01-vista-general', 'body', [
    [1, 'header.bar'], [2, '.diagram-wrap'], [3, '.chain-wrap'], [4, 'aside.rail'],
  ], { fullPage: true });

  await fig('A02-cabecera', 'header.bar', [
    [1, 'header.bar h1'], [2, 'header.bar .where'], [3, 'header.bar nav a'], [4, 'header.bar .switch'],
  ]);

  await fig('A03-control', block(1), [
    [1, '#state-name'], [2, '#clock', 'tr'], [3, '.timer-track'], [4, '#btn-run'], [5, '#btn-step'], [6, '#btn-reset'],
    [7, '#speed'], [8, '#speed-label', 'tr'], [9, '#burst-ms', 'tr'], [10, '#btn-burst'],
  ]);

  await fig('A04-protocolo', block(3), [
    [1, '#total-frames', 'tr'], [2, '#frame-bits', 'tr'], [3, '#ack-bits', 'tr'], [4, '#timeout-ms', 'tr'], [5, '#duplex-mode', 'tr'],
    [6, '#nak-toggle'], [7, '#timeout-hint'],
  ]);

  await p.click('#btn-add-hop'); await p.waitForTimeout(200);
  await fig('A05-camino', block(4), [
    [1, '#btn-add-hop', 'tr'], [2, '.hop:nth-child(1) .hop-head span'], [3, '.hop:nth-child(1) .hop-head button', 'tr'],
    [4, '.hop:nth-child(1) .hop-fields label:nth-child(1) input'], [5, '.hop:nth-child(1) .hop-fields label:nth-child(2) input'],
    [6, '.hop:nth-child(1) .hop-fields label:nth-child(3) input'], [7, '.hop:nth-child(1) .hop-fields label:nth-child(4) input'],
    [8, '.hop:nth-child(2) .hop-head span'], [9, block(4) + ' > p.hint'],
  ]);
  await fig('A06-cadena-dos-tramos', '.chain-wrap', [], { manual: [] });
  await p.locator('.hop-head button').nth(1).click(); await p.waitForTimeout(200);

  await fig('A07-leyenda', block(7), [[1, block(7) + ' .legend'], [2, block(7) + ' p.hint']]);

  // Carrera completa para telemetría y bitácora
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  const dts = [];
  for (let i = 1; i <= 12; i++) dts.push([i, `${block(5)} dl.readout dt:nth-of-type(${i})`]);
  await fig('A08-telemetria', block(5), dts);
  await fig('A09-bitacora', block(6), [[1, '#log li:first-child time'], [2, '#log li:first-child span']]);
  await fig('A10-diagrama-feliz', '.diagram-wrap', [], { manual: [] });

  // Inspector con trama de 64 bits en vuelo y un bit volteado
  await reset(); await setNum('#frame-bits', 64); await p.waitForTimeout(150); await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run');
  await fig('A11-inspector-sano', block(2), [
    [1, '#targets'], [2, '#insp-kind', 'tr'], [3, '#insp-seq', 'tr'], [4, '#insp-hop', 'tr'], [5, '#insp-crc', 'tr'],
    [6, '#bits'], [7, '#bits-hint'],
  ]);
  await p.evaluate(() => document.querySelectorAll('#bits button')[3].click()); await p.waitForTimeout(100);
  await fig('A12-inspector-volteado', block(2), [
    [1, '#bits button[data-flipped="true"]'], [2, '#insp-crc', 'tr'], [3, '#bits button:nth-child(49)'],
    [4, '#btn-noise-bit'], [5, '#btn-destroy'], [6, '#btn-delay'], [7, '#btn-seq0'], [8, '#btn-seq1'], [9, '#btn-crc-steps'],
  ]);
  await p.click('#btn-crc-steps'); await p.waitForTimeout(200);
  await p.evaluate(() => { const b = document.querySelector('#crc-steps .crc-row'); if (b) b.click(); }); await p.waitForTimeout(200);
  await fig('A13-crc-pasos', '#crc-steps', [
    [1, '#crc-steps > p:first-child'], [2, '#crc-steps .crc-table thead'], [3, '#crc-steps .crc-row'], [4, '#crc-steps .crc-detail'], [5, '#crc-steps .crc-verdict'],
  ]);
  await p.click('#btn-crc-steps');

  // Estado en pausa con el temporizador corriendo (barra)
  await fig('A14-control-pausa', block(1), [[1, '#state-name'], [2, '#clock', 'tr'], [3, '#timer-fill'], [4, '#btn-run']]);

  // ================= CALCULADORA =================
  await p.setViewportSize({ width: 1000, height: 960 });
  await p.goto(BASE + 'calculadora.html'); await p.waitForTimeout(400);
  const pod = (n) => `main.calc section.pod:nth-of-type(${n})`;

  await fig('B01-vista-general', 'body', [
    [1, 'header.bar'], [2, pod(1)], [3, pod(2)], [4, pod(3)], [5, pod(4)],
  ], { fullPage: true });

  await fig('B02-datos', pod(1), [
    [1, '#frame-bits', 'tr'], [2, '#ack-bits', 'tr'], [3, '#duplex-mode', 'tr'], [4, '#processing-ms', 'tr'], [5, '#burst-ms', 'tr'],
    [6, '#btn-add-link', 'tr'], [7, '.link-row:nth-child(1) .link-field:nth-child(1) input'], [8, '.link-row:nth-child(1) .link-field:nth-child(2) input'],
    [9, '.link-row:nth-child(1) .link-field:nth-child(3) input'], [10, '.link-row:nth-child(1) .link-field:nth-child(4) input'],
    [11, '.link-row:nth-child(1) .link-field:nth-child(5) input'], [12, '.link-row:nth-child(1) .link-row-head button', 'tr'],
    [13, '[data-preset="satelite"]'], [14, '[data-preset="casa-satelite-casa"]'], [15, '[data-preset="lan"]'],
  ]);

  await fig('B03-interpretacion', pod(2), [[1, '#interpret']]);

  await fig('B04-resultado', pod(3), [
    [1, '.headline-item:nth-child(1)'], [2, '.headline-item:nth-child(2)'], [3, '.headline-item:nth-child(3)'], [4, '#cycle-chart'],
  ]);

  await fig('B05-desarrollo-cerrado', pod(4), [[1, '#btn-next-step'], [2, '#btn-all-steps'], [3, '#steps-progress']]);
  await p.click('#btn-all-steps'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelectorAll('#steps-list .step-more')[0].click()); await p.waitForTimeout(150);
  await fig('B06-paso-abierto', '#steps-list li.step:first-child', [
    [1, '#steps-list li.step:first-child .step-title'], [2, '#steps-list li.step:first-child .step-math'],
    [3, '#steps-list li.step:first-child .math-row:nth-child(2) .math-why', 'tr'], [4, '#steps-list li.step:first-child .step-note'],
    [5, '#steps-list li.step:first-child .step-more'], [6, '#steps-list li.step:first-child .step-detail'],
  ]);
  await fig('B07-desarrollo-todos', pod(4), [[1, '#btn-hide-steps'], [2, '#steps-list li.step:nth-child(6)'], [3, '#steps-list li.step:nth-child(7)']]);
  await p.click('#btn-hide-steps');

  await setNum('#burst-ms', 2); await p.waitForTimeout(200);
  await fig('B08-rafaga', '#burst-pod', [[1, '#burst-steps-list li:nth-child(1)'], [2, '#burst-steps-list li:nth-child(2)']]);
  await setNum('#burst-ms', 0);

  await p.evaluate(() => { const e = document.getElementById('transfer-size'); e.value = '100'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200);
  await fig('B09-transferencia', '#transfer-pod', [[1, '#transfer-size', 'tr'], [2, '#transfer-unit', 'tr'], [3, '#transfer-steps-list']]);

  await p.click('[data-preset="satelite"]'); await p.waitForTimeout(150);
  await setNum('.link-row:nth-child(1) .link-field:nth-child(2) input', 0); await p.waitForTimeout(200);
  await fig('B10-error', pod(1), [[1, '#error-box']]);
  await p.click('[data-preset="satelite"]'); await p.waitForTimeout(150);

  await p.click('[data-preset="lan"]'); await p.waitForTimeout(200);
  await fig('B11-lan-nota', pod(1), [[1, '#frame-bits-hint']]);
  await fig('B11b-lan-resultado', pod(3), []);
  await p.click('[data-preset="casa-satelite-casa"]'); await p.waitForTimeout(200);
  await fig('B12-casa-camino', pod(1), [[1, '.link-row:nth-child(1)'], [2, '.link-row:nth-child(2)']]);
  await fig('B12b-casa-interpretacion', pod(2), []);
  await fig('B12c-casa-resultado', pod(3), []);
  await p.click('[data-preset="satelite"]'); await p.waitForTimeout(150);
  await p.selectOption('#duplex-mode', 'half'); await setNum('.link-row:nth-child(1) .link-field:nth-child(5) input', 10); await p.waitForTimeout(200);
  await fig('B13-half-resultado', pod(3), []);
  await p.click('#btn-all-steps'); await p.waitForTimeout(150);
  await fig('B13b-half-ciclo', '#steps-list li.step:nth-child(6)', []);

  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
