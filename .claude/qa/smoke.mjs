import puppeteer from '/Users/juan/.nvm/versions/node/v20.20.0/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
// Prueba de aceptacion de los paneles (carrito, menu, buscador) y del gate sobre un tema
// publicado o en preview. Uso: node smoke.mjs <url base> [--theme=<id>] [--collection=/collections/x] [--product=/products/y]
// Imprime una linea por comprobacion: OK / FALLA / NOTA.
const args = process.argv.slice(2);
const base = args[0].replace(/\/$/, '');
const opt = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const themeId = opt('theme', '');
const host = new URL(base).hostname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok === true ? 'OK   ' : ok === false ? 'FALLA' : 'NOTA '} ${name}${detail ? ' — ' + detail : ''}`); };
const cookie = () => ({ name: 'age_verified_diyvape', value: encodeURIComponent(JSON.stringify({ verified: true, dob: '1990-01-01', id: '123456789', sig: 'test', added_at: new Date().toISOString(), exp: Date.now() + 86400000 })), domain: host, path: '/' });
const IGNORE = /shop_events_listener|\/wpm\/|Failed to fetch|Load failed|NetworkError|ResizeObserver|Script error\.?$/i;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });

async function newPage(mobile, verified, width = 390) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (mobile) { await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'); await page.setViewport({ width, height: width > 500 ? 1024 : 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); }
  else await page.setViewport({ width: 1440, height: 900 });
  page.__errors = [];
  page.on('pageerror', (e) => { const m = String(e.message || e).slice(0, 160); if (!IGNORE.test(m)) page.__errors.push(m); });
  if (themeId) { await page.goto(`${base}/?preview_theme_id=${themeId}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}); await sleep(1200); }
  if (verified) await page.setCookie(cookie());
  page.__mobile = mobile; page.__ctx = ctx;
  return page;
}
const st = (page) => page.evaluate(() => {
  const c = document.documentElement.classList;
  const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 40 && r.right > 30 && r.left < innerWidth - 30 && r.bottom > 30 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5; };
  return {
    theme: window.Shopify && Shopify.theme ? Shopify.theme.id : null, path: location.pathname,
    nav: c.contains('nav-open') && vis(document.querySelector('.navigation.mobile')),
    cart: c.contains('open-minicart') && vis(document.querySelector('#minicart_wrapper .minicart__wrapper')),
    search: c.contains('open-search') && vis(document.querySelector('#search-form')),
    drawer: c.contains('open-drawer'), suppress: ['minicart', 'search', 'nav'].filter((k) => c.contains('diyvape-suppress-' + k)).join(','),
    verified: c.contains('age-gate-verified'), loaded: c.contains('diyvape-deferred-assets-loaded'),
    gate: (() => { const o = document.querySelector('.ai-age-verify-overlay'); return !!o && getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden'; })(),
    busy: !!document.querySelector('[aria-busy="true"]'),
    lazySwipers: document.querySelectorAll('.lazy-loading-swiper-after').length, swipers: document.querySelectorAll('.swiper-initialized').length,
    themeJs: performance.getEntriesByType('resource').filter((r) => /\/cdn\/shop\/t\/\d+\/assets\/(theme|global|cart-components|swiper-bundle\.min|motion\.min)\.js/.test(r.name)).length,
    cartCount: (document.querySelector('.cart-count-drawer') || {}).textContent?.replace(/\D/g, '') || null,
    items: document.querySelectorAll('#minicart_wrapper .cart-item, #minicart_wrapper [data-cart-item], #minicart_wrapper .minicart__item').length,
  };
}).catch((e) => ({ error: String(e).slice(0, 80) }));
async function point(page, sel) {
  return page.evaluate((s) => { for (const el of document.querySelectorAll(s)) { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && b.top >= 0 && b.top < innerHeight) return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } return null; }, sel).catch(() => null);
}
async function tap(page, sel) { const p = await point(page, sel); if (!p) return false; if (page.__mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); return true; }
async function tapXY(page, x, y) { if (page.__mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
async function waitFor(page, pred, ms = 6000) { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await st(page); if (s && !s.error && pred(s)) return s; await sleep(80); } return s; }
async function earlyTap(page, path, sel) {
  // Toca el disparador en cuanto se pinta, sin esperar a que cargue nada mas.
  // El documento anterior sigue vivo un instante tras goto(): solo vale el disparador
  // del documento NUEVO (otro timeOrigin), o se tocaria una cabecera que aun no existe.
  const oldOrigin = await page.evaluate(() => performance.timeOrigin).catch(() => 0);
  const nav = page.goto(base + path, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
  const t = Date.now(); let p = null;
  while (Date.now() - t < 30000 && !p) {
    p = await page.evaluate((s, old) => { if (performance.timeOrigin === old) return null; for (const el of document.querySelectorAll(s)) { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none') { const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (top && el.contains(top)) return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } } return null; }, sel, oldOrigin).catch(() => null);
    if (!p) await sleep(25);
  }
  if (p) await tapXY(page, p.x, p.y);
  return { nav, tapped: !!p };
}
async function panels(page, label) {
  // Abre y cierra cada panel con la pagina ya cargada.
  if (page.__mobile) {
    await tap(page, '.nav-toggle'); let s = await waitFor(page, (x) => x.nav, 3000); check(`${label}: menu abre`, !!s.nav);
    const closed = await page.evaluate(() => { const el = [...document.querySelectorAll('close-menu')].find((e) => e.getBoundingClientRect().width > 0); if (!el) return 'sin boton visible'; el.click(); return 'clic'; });
    s = await waitFor(page, (x) => !x.nav, 3000); check(`${label}: menu cierra con su boton`, !s.nav, closed);
    await sleep(600);
  }
  await tap(page, '#cart-icon-bubble'); let s = await waitFor(page, (x) => x.cart, 3000); check(`${label}: carrito abre`, !!s.cart);
  await sleep(500); await tapXY(page, page.__mobile ? 195 : 200, 450);
  if (page.__mobile) { await page.evaluate(() => { const b = document.querySelector('#minicart_wrapper .close-cart-button'); if (b) b.click(); }); }
  s = await waitFor(page, (x) => !x.cart && !x.drawer, 4000); check(`${label}: carrito cierra`, !s.cart && !s.drawer);
  await sleep(500);
  await tap(page, '.top-search-toggle'); s = await waitFor(page, (x) => x.search, 3000); check(`${label}: buscador abre`, !!s.search);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.btn-search-close')].find((e) => e.getBoundingClientRect().width > 0) || document.querySelector('.btn-search-close'); if (b) b.click(); });
  s = await waitFor(page, (x) => !x.search && !x.drawer, 4000); check(`${label}: buscador cierra`, !s.search && !s.drawer);
}

// ---------- A) sin verificar ----------
console.log(`\n${base}${themeId ? ' (preview ' + themeId + ')' : ' (tema publicado)'}\nA) sin verificar`);
{
  const page = await newPage(true, false);
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await sleep(2500);
  let s = await st(page);
  check('tema esperado', !themeId || String(s.theme) === String(themeId), `Shopify.theme.id=${s.theme}`);
  check('gate visible', s.gate === true && !s.verified);
  check('ningun script del tema cargado', s.themeJs === 0, `${s.themeJs} scripts`);
  const covered = await page.evaluate(() => { const el = document.querySelector('#cart-icon-bubble'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(top && el.contains(top)); });
  check('el gate tapa el icono del carrito (no se puede tocar)', covered);
  await page.evaluate(() => document.querySelector('#cart-icon-bubble').click()); await sleep(2500);
  s = await st(page); check('el enlace del carrito sigue nativo a /cart (clic programatico)', s.path === '/cart', s.path);

  // ---------- B) flujo real del gate ----------
  console.log('B) verificacion real');
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await sleep(1500);
  await page.evaluate(() => { const b = document.querySelector('age-verification-gate [data-action="yes"]'); if (b) b.click(); });
  await sleep(800);
  await page.evaluate(() => { const g = document.querySelector('age-verification-gate'); const dob = g.querySelector('[data-dob-input]'); const id = g.querySelector('[data-id-input]'); dob.value = '1990-05-15'; dob.dispatchEvent(new Event('input', { bubbles: true })); dob.dispatchEvent(new Event('change', { bubbles: true })); id.value = '1020304050'; id.dispatchEvent(new Event('input', { bubbles: true })); const b = g.querySelector('.ai-age-verify-submit'); if (b) b.click(); else g.querySelector('[data-age-form]').requestSubmit(); });
  await sleep(250);
  s = await st(page); check('gate cerrado y verificado', s.verified && !s.gate);
  check('ventana del toque fantasma activa (0,25 s)', s.suppress.includes('nav'), s.suppress || 'ninguna');
  await tap(page, '.nav-toggle'); await sleep(300);
  s = await st(page); check('toque dentro de esa ventana se descarta', !s.nav);
  s = await waitFor(page, (x) => x.suppress === '', 3000); check('supresion retirada tras la ventana', s.suppress === '', s.suppress || 'ninguna');
  s = await waitFor(page, (x) => x.loaded, 15000); check('scripts del tema cargados tras verificar', s.loaded && s.themeJs > 0, `${s.themeJs} scripts`);
  await panels(page, 'tras verificar');
  const attrs = await page.evaluate(async () => { try { const c = await (await fetch('/cart.js', { headers: { accept: 'application/json' } })).json(); return Object.keys(c.attributes || {}); } catch (e) { return ['ERR']; } });
  check('atributos de edad sincronizados al carrito', attrs.some((k) => /verified/i.test(k)) && attrs.some((k) => /dob/i.test(k)) && attrs.some((k) => /id/i.test(k)), `${attrs.length} atributos`);
  const ck = (await page.cookies()).filter((c) => c.name === 'age_verified_diyvape');
  check('cookie de verificacion escrita', ck.length === 1, ck.map((c) => c.domain).join(','));
  check('sin errores JS (sin verificar + gate)', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.__ctx.close();
}

// ---------- C) verificado, movil ----------
let collection = opt('collection', ''); let product = opt('product', '');
console.log('C) verificado, movil');
{
  const page = await newPage(true, true);
  let r = await earlyTap(page, '/', '#cart-icon-bubble');
  let s = await waitFor(page, (x) => x.cart || x.path === '/cart', 12000);
  check('home: toque temprano al carrito abre el panel', !!s.cart, s.path === '/cart' ? 'navego a /cart' : `suppress=${s.suppress} busy=${s.busy}`);
  await r.nav; s = await waitFor(page, (x) => x.loaded, 15000);
  s = await st(page); check('home: el panel sigue abierto al terminar la carga', !!s.cart);
  await page.evaluate(() => { const b = document.querySelector('#minicart_wrapper .close-cart-button'); if (b) b.click(); });
  s = await waitFor(page, (x) => !x.cart && !x.drawer, 4000); check('home: cierra con su boton tras la carga', !s.cart && !s.drawer);

  r = await earlyTap(page, '/', '.nav-toggle');
  s = await waitFor(page, (x) => x.nav, 12000); check('home: toque temprano al menu lo abre', !!s.nav, `suppress=${s.suppress} busy=${s.busy}`);
  await r.nav; await waitFor(page, (x) => x.loaded, 15000);
  s = await st(page); check('home: el menu sigue abierto al terminar la carga', !!s.nav);
  await page.evaluate(() => { const el = [...document.querySelectorAll('close-menu')].find((e) => e.getBoundingClientRect().width > 0); if (el) el.click(); });
  s = await waitFor(page, (x) => !x.nav && !x.drawer, 3000); check('home: el menu abierto temprano cierra con su boton tras la carga', !s.nav && !s.drawer);

  r = await earlyTap(page, '/', '.top-search-toggle');
  s = await waitFor(page, (x) => x.search, 15000); check('home: toque temprano al buscador termina abriendolo', !!s.search, `suppress=${s.suppress}`);
  await r.nav;
  await page.evaluate(() => { const b = document.querySelector('.btn-search-close'); if (b) b.click(); }); await sleep(900);

  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await waitFor(page, (x) => x.loaded, 15000); await sleep(1200);
  const before = await st(page);
  await panels(page, 'home');
  await sleep(1500); s = await st(page);
  check('home: carruseles diferidos montados tras el primer gesto', s.lazySwipers === 0 && s.swipers >= before.swipers, `pendientes ${before.lazySwipers}->${s.lazySwipers}, montados ${before.swipers}->${s.swipers}`);
  if (!collection) collection = await page.evaluate(() => [...document.querySelectorAll('a[href*="/collections/"]')].map((x) => new URL(x.href).pathname).find((p) => /^\/collections\/[^/]+$/.test(p) && !/\/(all|vendors)$/.test(p)) || '/collections/all');
  check('home: sin errores JS', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | ')); page.__errors.length = 0;

  await page.goto(base + collection, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await waitFor(page, (x) => x.loaded, 15000); await sleep(1000);
  await panels(page, `coleccion ${collection}`);
  if (!product) {
    // Primer producto de la coleccion con boton de compra activo (hasta 6 intentos).
    const candidates = await page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href*="/products/"]')].map((x) => new URL(x.href).pathname.replace(/^\/collections\/[^/]+/, '')).filter((p) => /^\/products\/[^/]+$/.test(p)))].slice(0, 6));
    for (const c of candidates) {
      const ok = await page.evaluate(async (path) => { try { const j = await (await fetch(path + '.js')).json(); return j.available === true; } catch (e) { return false; } }, c);
      if (ok) { product = c; break; }
    }
    if (!product) product = candidates[0] || null;
  }
  check('coleccion: sin errores JS', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | ')); page.__errors.length = 0;

  if (product) {
    r = await earlyTap(page, product, '#cart-icon-bubble');
    s = await waitFor(page, (x) => x.cart || x.path === '/cart', 12000); check('PDP: toque temprano al carrito abre el panel', !!s.cart, s.path);
    await r.nav; await waitFor(page, (x) => x.loaded, 15000);
    await page.evaluate(() => { const b = document.querySelector('#minicart_wrapper .close-cart-button'); if (b) b.click(); }); await waitFor(page, (x) => !x.cart, 3000); await sleep(600);
    const addable = await page.evaluate(() => { const b = document.querySelector('button[name="add"]'); return b ? !b.disabled : null; });
    if (addable) {
      await page.evaluate(() => document.querySelector('button[name="add"]').scrollIntoView({ block: 'center' })); await sleep(400);
      await tap(page, 'button[name="add"]'); s = await waitFor(page, (x) => x.cart && x.items > 0, 9000);
      check('PDP: agregar al carrito abre el panel con el producto', !!s.cart && s.items > 0, `items=${s.items}`);
      const plus = await page.evaluate(() => { const q = document.querySelector('#minicart_wrapper quantity-input button[name="plus"], #minicart_wrapper .quantity__button[name="plus"], #minicart_wrapper button.plus'); if (!q) return false; q.click(); return true; });
      if (plus) { await sleep(2500); const n = await page.evaluate(() => Number((document.querySelector('#minicart_wrapper input[name="updates[]"]') || {}).value)); check('PDP: cantidad +1 en el minicart', n === 2, `cantidad=${n}`); }
      else check('PDP: cantidad +1 en el minicart', null, 'sin boton de cantidad');
      await page.evaluate(() => { const b = document.querySelector('#minicart_wrapper .close-cart-button'); if (b) b.click(); }); await waitFor(page, (x) => !x.cart, 3000);
    } else check('PDP: agregar al carrito', null, addable === null ? 'sin boton' : 'producto agotado');
    check(`PDP ${product}: sin errores JS`, page.__errors.length === 0, page.__errors.slice(0, 3).join(' | ')); page.__errors.length = 0;
  }
  await page.goto(base + '/cart', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await waitFor(page, (x) => x.loaded, 15000); await sleep(800);
  await tap(page, '#cart-icon-bubble'); await sleep(1800);
  s = await st(page); check('pagina de carrito: el icono no abre panel (se queda en /cart)', s.path === '/cart' && !s.cart);
  check('pagina de carrito: sin errores JS', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | ')); page.__errors.length = 0;
  for (const p of ['/pages/no-existe-smoke', '/search?q=vaporizador', '/blogs/noticias']) {
    await page.goto(base + p, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    await waitFor(page, (x) => x.loaded, 15000); await sleep(700);
    await tap(page, '#cart-icon-bubble'); s = await waitFor(page, (x) => x.cart, 3000);
    check(`${p}: carrito abre y sin errores JS`, !!s.cart && page.__errors.length === 0, page.__errors.slice(0, 2).join(' | ')); page.__errors.length = 0;
  }
  await page.__ctx.close();
}

// ---------- T) verificado, tableta (el menu no ocupa todo el ancho) ----------
console.log('T) verificado, tableta 768 px');
{
  const page = await newPage(true, true, 768);
  let r = await earlyTap(page, '/', '.nav-toggle');
  let s = await waitFor(page, (x) => x.nav, 12000); check('tableta: toque temprano al menu lo abre', !!s.nav);
  await tapXY(page, 700, 600); s = await waitFor(page, (x) => !x.nav && !x.drawer, 3000); check('tableta: tocar fuera cierra el menu abierto temprano', !s.nav && !s.drawer);
  await r.nav; await waitFor(page, (x) => x.loaded, 15000); await sleep(800);
  s = await st(page); check('tableta: sigue cerrado y en la home al terminar la carga', !s.nav && s.path === '/', s.path);
  await tap(page, '.nav-toggle'); s = await waitFor(page, (x) => x.nav, 3000); check('tableta: menu abre tras la carga', !!s.nav);
  await tapXY(page, 700, 600); s = await waitFor(page, (x) => !x.nav && !x.drawer, 3000); check('tableta: tocar fuera lo cierra tras la carga', !s.nav && !s.drawer && s.path === '/', s.path);
  r = await earlyTap(page, '/', '#cart-icon-bubble');
  s = await waitFor(page, (x) => x.cart, 12000); check('tableta: toque temprano al carrito abre el panel', !!s.cart);
  await tapXY(page, 120, 600); s = await waitFor(page, (x) => !x.cart && !x.drawer, 4000); check('tableta: tocar fuera cierra el carrito abierto temprano', !s.cart && !s.drawer && s.path === '/', s.path);
  await r.nav; await waitFor(page, (x) => x.loaded, 15000); await sleep(800);
  await tap(page, '#cart-icon-bubble'); s = await waitFor(page, (x) => x.cart, 3000); check('tableta: carrito abre tras la carga', !!s.cart);
  await sleep(500); await tapXY(page, 120, 600); s = await waitFor(page, (x) => !x.cart && !x.drawer, 4000); check('tableta: tocar fuera lo cierra tras la carga', !s.cart && !s.drawer && s.path === '/', s.path);
  check('tableta: sin errores JS', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.__ctx.close();
}

// ---------- D) verificado, escritorio ----------
console.log('D) verificado, escritorio');
{
  const page = await newPage(false, true);
  for (let i = 1; i <= 3; i++) {
    const r = await earlyTap(page, '/', '#cart-icon-bubble');
    const s = await waitFor(page, (x) => x.cart || x.path === '/cart', 10000);
    check(`home: clic temprano al carrito abre (intento ${i})`, !!s.cart, s.path === '/cart' ? 'navego a /cart' : `suppress=${s.suppress} busy=${s.busy}`);
    await r.nav; await waitFor(page, (x) => x.loaded, 15000);
    const s2 = await st(page); check(`home: sigue abierto al terminar la carga (intento ${i})`, !!s2.cart);
  }
  await page.goto(base + '/', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await waitFor(page, (x) => x.loaded, 15000); await sleep(1000);
  await panels(page, 'home');
  const mega = await page.evaluate(() => { const li = [...document.querySelectorAll('.navigation.horizontal li')].find((l) => l.querySelector('.submenu') && l.getBoundingClientRect().width > 0); if (!li) return null; const b = li.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  if (mega) { await page.mouse.move(mega.x, mega.y); await sleep(900); const open = await page.evaluate(() => [...document.querySelectorAll('.navigation.horizontal .submenu')].some((s) => { const cs = getComputedStyle(s); const r = s.getBoundingClientRect(); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5 && r.height > 20; })); check('home: el menu de escritorio despliega al pasar el cursor', open); await page.mouse.move(700, 700); }
  else check('home: menu de escritorio con submenus', null, 'sin submenus');
  check('escritorio: sin errores JS', page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.__ctx.close();
}
await browser.close();
const fails = results.filter((r) => r.ok === false);
console.log(`\nRESULTADO: ${results.filter((r) => r.ok === true).length} OK, ${fails.length} fallas, ${results.filter((r) => r.ok === null).length} notas${fails.length ? '\n  ' + fails.map((f) => f.name).join('\n  ') : ''}`);
process.exit(fails.length ? 1 : 0);
