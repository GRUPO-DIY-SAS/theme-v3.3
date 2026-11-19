import puppeteer from '/Users/juan/.nvm/versions/node/v20.20.0/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFileSync } from 'node:fs';
// Latencia REAL en pantalla: del toque (marca de tiempo del hardware) al primer frame
// dibujado con el panel abierto. Sale de la traza del navegador, no de sondas en la pagina
// (que se atrasan justo cuando el hilo principal esta ocupado).
// Uso: node visual.mjs <url> <cart|menu|search> [--profile=fast4g|slow4g|mobile|desktop] [--delay=0]
//      [--runs=3] [--warm] [--patch=<modulo.mjs>] [--assetDelay=ms] [--theme=<id>] [--json]
const args = process.argv.slice(2);
const url = args[0];
const mode = args[1] || 'cart';
const opt = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const flag = (n) => args.includes(`--${n}`);
const profile = opt('profile', 'fast4g');
const delay = Number(opt('delay', '0'));
const runs = Number(opt('runs', '3'));
const warm = flag('warm');
const themeId = opt('theme', '');
const assetDelay = Number(opt('assetDelay', '0'));
const patchPath = opt('patch', '');
const patch = patchPath ? await import(new URL(patchPath, `file://${process.cwd()}/`).href) : null;
const PROFILES = {
  fast4g: { mobile: true, cpu: 4, net: { latency: 165, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 } },
  slow4g: { mobile: true, cpu: 4, net: { latency: 562, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (0.75 * 1024 * 1024) / 8 } },
  mobile: { mobile: true, cpu: 1, net: null },
  desktop: { mobile: false, cpu: 1, net: null },
};
const P = PROFILES[profile];
const TARGET = { cart: { trigger: '#cart-icon-bubble', cls: 'open-minicart' }, menu: { trigger: '.nav-toggle', cls: 'nav-open' }, search: { trigger: '.top-search-toggle', cls: 'open-search' } }[mode];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const host = new URL(url).hostname;
const cookieValue = encodeURIComponent(JSON.stringify({ verified: true, dob: '1990-01-01', id: '123456789', sig: 'test', added_at: new Date().toISOString(), exp: Date.now() + 86400000 }));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });

async function once(i) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (P.mobile) { await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); }
  else await page.setViewport({ width: 1440, height: 900 });
  await page.setCookie({ name: 'age_verified_diyvape', value: cookieValue, domain: host, path: '/' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 140)));
  if (themeId) { await page.goto(`${new URL(url).origin}/?preview_theme_id=${themeId}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}); await sleep(1500); }
  if (warm) { await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {}); await sleep(6000); }
  const client = await page.createCDPSession();
  if (patch) {
    await client.send('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Response' }, ...Object.keys(patch.assets || {}).map((name) => ({ urlPattern: `*/cdn/shop/t/*/assets/${name}*`, requestStage: 'Request' }))] });
    client.on('Fetch.requestPaused', async (ev) => {
      try {
        const u = ev.request.url;
        const asset = /\/cdn\/shop\/t\//.test(u) ? Object.keys(patch.assets || {}).find((name) => u.includes(`/assets/${name}`)) : null;
        if (asset && ev.responseStatusCode == null) { await sleep(assetDelay); await client.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: asset.endsWith('.css') ? 'text/css' : 'application/javascript' }, { name: 'access-control-allow-origin', value: '*' }], body: readFileSync(patch.assets[asset]).toString('base64') }); return; }
        if (ev.resourceType === 'Document' && ev.responseStatusCode === 200 && patch.patchHtml && new URL(u).hostname === host) {
          const res = await client.send('Fetch.getResponseBody', { requestId: ev.requestId });
          const html = res.base64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body;
          await client.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 200, responseHeaders: ev.responseHeaders.filter((h) => !/^content-(length|encoding)$/i.test(h.name)), body: Buffer.from(patch.patchHtml(html, { url: u }), 'utf8').toString('base64') });
          return;
        }
        await client.send('Fetch.continueRequest', { requestId: ev.requestId });
      } catch (e) { try { await client.send('Fetch.continueRequest', { requestId: ev.requestId }); } catch (_) {} }
    });
  }
  await client.send('Network.enable');
  // La visita que fija el tema en preview calienta la cache: se vacia para medir en frio.
  if (themeId && !warm) await client.send('Network.clearBrowserCache');
  if (P.net) await client.send('Network.emulateNetworkConditions', { offline: false, ...P.net });
  if (P.cpu > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  await page.evaluateOnNewDocument((target) => {
    const m = (window.__m = {});
    const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const tick = () => { if (!m.rect) { for (const el of document.querySelectorAll(target.trigger)) { const v = visible(el); if (v) { m.rect = v; m.visibleAt = Math.round(performance.now()); break; } } } if (!m.rect) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    // La marca del toque usa la hora del evento (hardware), no la de cuando corre el listener.
    document.addEventListener('pointerdown', (e) => { if (!m.tap && e.target.closest && e.target.closest(target.trigger)) { m.tap = Math.round(e.timeStamp); performance.mark('qa-pointerdown', { startTime: e.timeStamp }); } }, true);
    const arm = () => { new MutationObserver(() => { if (!m.open && document.documentElement.classList.contains(target.cls)) { m.open = Math.round(performance.now()); performance.mark('qa-open'); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); };
    const iv = setInterval(() => { if (document.documentElement) { clearInterval(iv); arm(); } }, 1);
    window.addEventListener('diyvape:deferred-assets-loaded', () => { m.assetsLoaded = Math.round(performance.now()); });
  }, TARGET);
  await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'loading'] });
  const nav = page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
  const read = async () => { try { return await page.evaluate(() => (window.__m ? { ...window.__m, path: location.pathname, theme: window.Shopify && Shopify.theme ? Shopify.theme.id : null } : null)); } catch (e) { return null; } };
  let st = null; const t0 = Date.now();
  while (Date.now() - t0 < 60000) { st = await read(); if (st && st.rect) break; await sleep(30); }
  if (!st || !st.rect) { await page.tracing.stop().catch(() => {}); await ctx.close(); return { run: i, error: 'disparador no visible' }; }
  await sleep(delay);
  // La cabecera puede moverse mientras cargan los estilos: se toca en la posicion actual y,
  // si el toque no cayo sobre el disparador, se reintenta (hasta 3 veces).
  const fresh = () => page.evaluate((sel) => { for (const el of document.querySelectorAll(sel)) { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none') return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } return null; }, TARGET.trigger).catch(() => null);
  let retaps = 0;
  for (let k = 0; k < 4; k++) {
    const pos = (k === 0 ? st.rect : await fresh()) || st.rect;
    if (P.mobile) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y);
    await sleep(250);
    const now = await read();
    if (now && (now.tap != null || (now.path || '').startsWith('/cart'))) break;
    retaps = k + 1;
  }
  const t1 = Date.now(); let navigated = false;
  while (Date.now() - t1 < 20000) { st = await read(); if (st && st.path && st.path.startsWith('/cart')) { navigated = true; break; } if (st && st.open) break; await sleep(50); }
  await sleep(1400);
  const fin = (await read()) || {};
  const buf = await page.tracing.stop();
  await nav; await ctx.close();
  const ev = JSON.parse(Buffer.from(buf).toString('utf8')).traceEvents;
  const mark = (name) => ev.filter((e) => e.name === name && e.cat && e.cat.includes('blink.user_timing')).sort((a, b) => a.ts - b.ts)[0];
  const tapEv = mark('qa-pointerdown'); const openEv = mark('qa-open');
  const out = { run: i, theme: fin.theme, retaps, visibleAt: fin.visibleAt, tap: fin.tap, assetsLoaded: fin.assetsLoaded, navigated: navigated || (fin.path || '').startsWith('/cart'), errors };
  if (!tapEv) return { ...out, error: 'sin marca de toque' };
  if (!openEv) return { ...out, opened: false };
  const pid = openEv.pid;
  // Primer commit del hilo principal con el estado abierto y primer frame dibujado despues.
  const commits = ev.filter((e) => e.pid === pid && e.tid === openEv.tid && e.name === 'Commit' && e.ts >= openEv.ts).sort((a, b) => a.ts - b.ts);
  const commit = commits[0];
  const draws = ev.filter((e) => e.pid === pid && e.name === 'DrawFrame' && commit && e.ts >= commit.ts + (commit.dur || 0)).sort((a, b) => a.ts - b.ts);
  const ms = (a, b) => (a != null && b != null ? Math.round((a - b) / 1000) : null);
  // Trabajo de render entre poner la clase y el commit (estilos + layout del arbol entero).
  const render = ev.filter((e) => e.pid === pid && e.tid === openEv.tid && e.ph === 'X' && commit && e.ts >= openEv.ts && e.ts <= commit.ts && ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize'].includes(e.name));
  const sum = (name) => Math.round(render.filter((e) => e.name === name).reduce((a, e) => a + e.dur, 0) / 1000);
  const disp = (type) => ev.filter((e) => e.pid === pid && e.tid === openEv.tid && e.name === 'EventDispatch' && e.args && e.args.data && e.args.data.type === type && e.ts >= tapEv.ts - 2000).sort((a, b) => a.ts - b.ts)[0];
  const click = disp('click');
  const between = ev.filter((e) => e.pid === pid && e.tid === openEv.tid && e.ph === 'X' && e.name === 'RunTask' && e.dur >= 20000 && e.ts + e.dur > tapEv.ts && e.ts < openEv.ts).map((t) => {
    const kids = ev.filter((k) => k.pid === pid && k.tid === t.tid && k.ph === 'X' && k !== t && k.ts >= t.ts && k.ts + k.dur <= t.ts + t.dur + 1 && ['EvaluateScript', 'v8.evaluateModule', 'FunctionCall', 'UpdateLayoutTree', 'Layout', 'EventDispatch', 'TimerFire', 'ParseHTML', 'RunMicrotasks', 'FireAnimationFrame', 'ParseAuthorStyleSheet', 'v8.compile'].includes(k.name)).sort((a, b) => b.dur - a.dur)[0];
    const d = kids && kids.args && (kids.args.data || kids.args.beginData) || {};
    const u = d.url || (d.stackTrace && d.stackTrace[0] && d.stackTrace[0].url) || '';
    // Dentro de un despacho de evento, que funciones corren (nombre@archivo:linea).
    const fns = ev.filter((k) => k.pid === pid && k.tid === t.tid && k.ph === 'X' && k.name === 'FunctionCall' && k.ts >= t.ts && k.ts + k.dur <= t.ts + t.dur + 1 && k.dur >= 3000).sort((a, b) => b.dur - a.dur).slice(0, 3).map((k) => { const fd = (k.args && k.args.data) || {}; return `${fd.functionName || '(anon)'}@${String(fd.url || '').replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 30)}:${fd.lineNumber}=${Math.round(k.dur / 1000)}ms`; });
    return `${Math.round((t.ts - tapEv.ts) / 1000)}+${Math.round(t.dur / 1000)}ms ${kids ? kids.name : '?'}${d.type ? ':' + d.type : ''}${u ? ' ' + u.replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 34) : ''}${fns.length ? ' {' + fns.join(', ') + '}' : ''}`;
  });
  out.tapToClick = click ? ms(click.ts, tapEv.ts) : null;
  out.clickToClass = click ? ms(openEv.ts, click.ts) : null;
  out.tasks = between;
  return { ...out, opened: true, tapToClass: ms(openEv.ts, tapEv.ts), tapToCommit: commit ? ms(commit.ts + (commit.dur || 0), tapEv.ts) : null, tapToDraw: draws[0] ? ms(draws[0].ts, tapEv.ts) : null, estilos: sum('UpdateLayoutTree'), layout: sum('Layout'), pintura: sum('PrePaint') + sum('Paint') + sum('Layerize'), earlyTap: fin.assetsLoaded == null || fin.tap < fin.assetsLoaded };
}

const out = [];
for (let i = 1; i <= runs; i++) out.push(await once(i));
await browser.close();
if (flag('json')) console.log(JSON.stringify(out, null, 1));
else {
  const med = (k) => { const v = out.map((o) => o[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  console.log(`\n${url} [${mode}] perfil=${profile} delay=${delay}ms ${warm ? 'cache caliente' : 'cache fria'}${patch ? ` PARCHE(${patchPath})` : ''}${themeId ? ` tema=${themeId}` : ''}`);
  for (const o of out) console.log(`  #${o.run} visible=${o.visibleAt} toque=${o.tap} scriptsListos=${o.assetsLoaded} ${o.earlyTap ? '(toque temprano)' : '(ya cargado)'} | toque->clase ${o.tapToClass}ms | toque->frame ${o.tapToDraw}ms [estilos ${o.estilos} layout ${o.layout} pintura ${o.pintura}]${o.tapToClick != null ? ` | clic despachado a +${o.tapToClick}ms, clase ${o.clickToClass}ms despues` : ''}${o.retaps ? ` (toque repetido ${o.retaps}x)` : ''}${o.opened === false ? ' NO ABRIO' : ''}${o.navigated ? ' NAVEGO A /cart' : ''}${o.error ? ' ERROR ' + o.error : ''}${o.errors && o.errors.length ? ' jsErr=' + o.errors.length : ''}`);
  if (flag('tasks')) for (const o of out) console.log(`     #${o.run} tareas entre toque y clase: ${(o.tasks || []).join(' ; ')}`);
  const opened = out.filter((o) => o.opened).length;
  console.log(`  RESUMEN (tema ${[...new Set(out.map((o) => o.theme))].join(',')}): abrio ${opened}/${out.length} | mediana toque->clase ${med('tapToClass')}ms, toque->primer frame ${med('tapToDraw')}ms`);
}

// Algun temporizador interno deja vivo el proceso tras cerrar el navegador y atasca los lotes.
process.exit(0);
