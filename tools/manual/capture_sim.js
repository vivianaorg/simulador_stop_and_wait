const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2];
const EXE = 'C:/Users/gogam/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = 'http://localhost:8765/';

function out(n) { return path.join(OUT, n + '.png'); }

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const shot = async (name, sel) => {
    if (sel) await p.locator(sel).first().screenshot({ path: out(name) });
    else await p.screenshot({ path: out(name) });
    console.log('shot', name);
  };
  const full = async (name) => { await p.screenshot({ path: out(name), fullPage: true }); console.log('full', name); };
  const block = (n) => `aside.rail section.block:nth-of-type(${n})`;
  const setSpeed = async (v) => { await p.locator('#speed').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); };
  const state = async () => p.locator('#state-name').textContent();
  const waitDone = async (ms = 40000) => { await p.waitForFunction(() => document.getElementById('state-name').textContent === 'Completado', null, { timeout: ms }); };
  const setNum = async (sel, v) => { await p.locator(sel).fill(String(v)); await p.locator(sel).dispatchEvent('change'); };
  const diag = async (name) => {
    await shot(name, '.diagram-wrap');
    await p.locator('#diagram').hover({ position: { x: 300, y: 300 } });
    for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(20); }
    await p.waitForTimeout(150);
    await shot(name + '-inicio', '.diagram-wrap');
    await p.locator('#diagram').dblclick({ position: { x: 300, y: 300 } });
    await p.waitForTimeout(100);
  };
  const reset = async () => { await p.click('#btn-reset'); await p.waitForTimeout(150); };

  // ---------------- SIMULADOR ----------------
  await p.goto(BASE + 'index.html');
  await p.waitForTimeout(400);
  await full('s00-full');
  await setNum('#total-frames', 3); await p.waitForTimeout(150);
  await shot('s01-header', 'header.bar');
  await shot('s02-control', block(1));
  await shot('s03-inspector-vacio', block(2));
  await shot('s04-protocolo', block(3));
  await shot('s05-camino', block(4));
  await shot('s06-telemetria', block(5));
  await shot('s07-bitacora', block(6));
  await shot('s08-leyenda', block(7));
  await shot('s09-stage-vacio', '.stage');
  await shot('s10-chain', '.chain-wrap');
  await shot('s11-diagram-vacio', '.diagram-wrap');

  // Camino feliz a 4x
  await setSpeed(4);
  await p.click('#btn-run');
  await waitDone();
  await p.waitForTimeout(300);
  await diag('s12-diagram-feliz');
  await shot('s13-telemetria-feliz', block(5));
  await shot('s14-bitacora-feliz', block(6));
  await shot('s15-control-completado', block(1));
  await reset(); await setSpeed(1); await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run');
  await shot('s15b-inspector-1000', '#inspector');

  // Trama en vuelo, inspector
  await reset(); await setNum('#frame-bits', 64); await p.waitForTimeout(150); await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run'); // pausa
  await shot('s16-control-pausa', block(1));
  await shot('s17-inspector-trama', block(2));
  await shot('s17b-bits', '#bits');
  await p.evaluate(() => document.querySelectorAll('#bits button')[3].click());
  await p.waitForTimeout(100);
  await shot('s18-inspector-bit-volteado', block(2));
  await p.click('#btn-crc-steps'); await p.waitForTimeout(200);
  await shot('s19-crc-pasos', '#inspector');
  await p.evaluate(() => { const b = document.querySelector('#crc-steps button, #crc-steps summary'); if (b) b.click(); });
  await p.waitForTimeout(200);
  await shot('s20-crc-pasos-abierto', '#inspector');
  await p.click('#btn-crc-steps');
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s21-diagram-crc-timeout');
  await shot('s22-telemetria-crc', block(5));
  await shot('s23-bitacora-crc', block(6));

  // NAK activado
  await reset(); await p.check('#nak-toggle'); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run');
  await p.evaluate(() => document.querySelectorAll('#bits button')[3].click());
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s24-diagram-nak');
  await shot('s25-telemetria-nak', block(5));
  await p.uncheck('#nak-toggle');

  // Dañar un bit al azar
  await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run');
  await p.click('#btn-noise-bit'); await p.waitForTimeout(100);
  await shot('s26-inspector-bit-azar', block(2));

  // Destruir
  await reset(); await setNum('#frame-bits', 1000); await p.waitForTimeout(150); await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(700); await p.click('#btn-run');
  await p.click('#btn-destroy');
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s27-diagram-destruida');

  // Retrasar (sobre el ACK: hay que pausar cuando el ACK va de vuelta). ACK tiene 0 bits: pausa en propagación de vuelta.
  await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(4500); await p.click('#btn-run');
  await shot('s28-inspector-ack', block(2));
  await p.click('#btn-delay');
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s29-diagram-retrasada');

  // Forzar seq: segunda trama (seq 1) en vuelo, forzar 0 -> duplicada
  await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(6800); await p.click('#btn-run');
  await p.click('#btn-seq0');
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s30-diagram-duplicada');
  await shot('s31-telemetria-duplicada', block(5));

  // Half duplex
  await reset(); await p.selectOption('#duplex-mode', 'half'); await p.waitForTimeout(150);
  await shot('s32-protocolo-half', block(3));
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s33-diagram-half');
  await p.selectOption('#duplex-mode', 'full');

  // Ráfaga de ruido
  await reset(); await setSpeed(1);
  await p.click('#btn-run'); await p.waitForTimeout(500); await p.click('#btn-burst'); await p.waitForTimeout(300);
  await p.click('#btn-run'); // pausa
  await shot('s34-inspector-rafaga', block(2));
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s35-diagram-rafaga');
  await shot('s36-telemetria-rafaga', block(5));

  // Multi-salto
  await reset(); await p.click('#btn-add-hop'); await p.waitForTimeout(200);
  await shot('s37-camino-dos-tramos', block(4));
  await shot('s38-chain-dos-tramos', '.chain-wrap');
  await shot('s39-protocolo-timeout-ajustado', block(3));
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s40-diagram-dos-tramos');
  await shot('s41-telemetria-dos-tramos', block(5));
  await p.locator('.hop-head button').nth(1).click(); await p.waitForTimeout(200);

  // Timeout manual demasiado corto
  await reset(); await setNum('#timeout-ms', 20); await p.waitForTimeout(150);
  await shot('s42-protocolo-timeout-corto', block(3));
  await setSpeed(4); await p.click('#btn-run'); await waitDone(); await p.waitForTimeout(300);
  await diag('s43-diagram-timeout-corto');
  await setNum('#timeout-ms', 45);

  // Un paso
  await reset(); await p.click('#btn-step'); await p.click('#btn-step'); await p.click('#btn-step'); await p.waitForTimeout(150);
  await shot('s44-control-un-paso', block(1));

  // Fondo oscuro
  await p.check('#theme-switch'); await p.waitForTimeout(200);
  await shot('s45-oscuro', null);
  await p.uncheck('#theme-switch');

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
