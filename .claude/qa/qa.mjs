import puppeteer from '/Users/juan/.nvm/versions/node/v20.20.0/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { writeFileSync } from 'node:fs';
// QA de la seccion 7 de ARRANQUE-TIENDA-NUEVA.md sobre un tema sin publicar.
// Uso: STORE_URL=https://www.tienda.com THEME_ID=123 OUT_DIR=/tmp/qa node .claude/qa/qa.mjs
// Cubre los dos estados del gate (pasa por el formulario real), errores JS por tipo de pagina,
// carruseles montados, minicart/buscador, fuentes y logo, y deja capturas + report.json en OUT_DIR.
const BASE = process.env.STORE_URL || 'https://www.vaporizadoresherbales.com';
const THEME_ID = Number(process.env.THEME_ID || 151079157966);
const OUT = (process.env.OUT_DIR || new URL('./out/', import.meta.url).pathname).replace(/\/?$/, '/');
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'collection', path: '/collections/dynavap' },
  { name: 'product', path: '/products/dynavap-the-m7-xl' },
  { name: 'page', path: '/pages/faqs', alt: ['/pages/preguntas-frecuentes', '/pages/contact', '/pages/contacto', '/pages/wishlist'] },
  { name: '404', path: '/pages/qa-no-existe-404' },
  { name: 'blog', path: '/blogs/noticias' },
];
const report = { pages: {}, unverified: {}, gate: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent(MOBILE_UA);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push({ type: 'pageerror', msg: String(e.message || e).slice(0, 200) }));
page.on('console', (m) => { if (m.type() === 'error') errors.push({ type: 'console', msg: m.text().slice(0, 200) }); });
const drain = () => { const e = errors.splice(0); return e; };

async function themeAssets() {
  return page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /\/cdn\/shop\/t\//.test(n)).map((n) => n.replace(/^.*\/assets\//, '').replace(/\?.*$/, '')));
}
async function pageFacts() {
  return page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const headerSec = document.querySelector('[id^="shopify-section-"][id$="__header"]');
    const headerEl = headerSec ? (headerSec.querySelector('header, .header, [class*="header"]') || headerSec.firstElementChild) : null;
    const logo = document.querySelector('[id$="__header"] img[src*="logo" i], [id$="__header"] img');
    const topbar = document.querySelector('[id^="shopify-section-"][id$="__top_bar_CbXNYj"]');
    const h = document.querySelector('h1, h2');
    return {
      themeId: (window.Shopify && window.Shopify.theme && window.Shopify.theme.id) || null,
      title: document.title,
      htmlClass: document.documentElement.className,
      slideSections: document.querySelectorAll('slide-section').length,
      swiperInit: document.querySelectorAll('.swiper-initialized').length,
      swiperDefined: typeof window.Swiper !== 'undefined',
      productFormDefined: !!customElements.get('product-form'),
      bodyFont: cs(document.body) && cs(document.body).fontFamily.slice(0, 60),
      headingFont: h ? cs(h).fontFamily.slice(0, 60) : null,
      headerBg: headerEl ? cs(headerEl).backgroundColor : null,
      topbarBg: topbar && topbar.firstElementChild ? cs(topbar.firstElementChild).backgroundColor : null,
      logoSrc: logo ? logo.getAttribute('src') : null,
      gatePresent: !!document.querySelector('age-verification-gate'),
      gateVisible: (() => { const o = document.querySelector('.ai-age-verify-overlay'); return o ? getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden' : false; })(),
      cartIcon: !!document.querySelector('#cart-icon-bubble'),
    };
  });
}
async function goto(path) {
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 90000 }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 60) }));
  await sleep(3000);
  return typeof res.status === 'function' ? res.status() : res;
}
function stateSnapshot() {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[class*="open"], [class*="active"], [class*="show"], [aria-expanded="true"], [aria-hidden="false"], [open]').forEach((el) => {
      const id = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
      out.push(id);
    });
    return out;
  });
}
async function clickAndDiff(label, finder) {
  const before = new Set(await stateSnapshot());
  const clicked = await page.evaluate(finder);
  await sleep(1500);
  const after = await stateSnapshot();
  const gained = after.filter((x) => !before.has(x)).slice(0, 8);
  return { clicked, gained, url: page.url() };
}

// 0) preview cookie
await page.goto(`${BASE}/?preview_theme_id=${THEME_ID}`, { waitUntil: 'domcontentloaded', timeout: 90000 });

// 1) UNVERIFIED: gate up, no theme assets, cart navigates natively
report.unverified.status = await goto('/');
report.unverified.facts = await pageFacts();
report.unverified.assets = await themeAssets();
report.unverified.errors = drain();
await page.screenshot({ path: OUT + 'gate-mobile.png' });
report.unverified.cartClick = await clickAndDiff('cart', () => { const el = document.querySelector('#cart-icon-bubble'); if (!el) return 'no #cart-icon-bubble'; el.click(); return 'clicked'; });
await sleep(2500);
report.unverified.cartUrlAfterClick = page.url();

// 2) pass the real gate
await goto('/');
report.gate.step1 = await page.evaluate(() => { const b = document.querySelector('age-verification-gate [data-action="yes"]'); if (!b) return 'no yes button'; b.click(); return 'yes clicked'; });
await sleep(800);
report.gate.step2 = await page.evaluate(() => {
  const gate = document.querySelector('age-verification-gate'); if (!gate) return 'no gate';
  const dob = gate.querySelector('[data-dob-input]'); const id = gate.querySelector('[data-id-input]'); const form = gate.querySelector('[data-age-form]');
  if (!dob || !id || !form) return `missing fields dob=${!!dob} id=${!!id} form=${!!form}`;
  dob.value = '1990-05-15'; dob.dispatchEvent(new Event('input', { bubbles: true })); dob.dispatchEvent(new Event('change', { bubbles: true }));
  id.value = '1020304050'; id.dispatchEvent(new Event('input', { bubbles: true }));
  const submit = gate.querySelector('.ai-age-verify-submit'); if (submit) submit.click(); else form.requestSubmit();
  return 'submitted';
});
await sleep(5000);
report.gate.afterSubmit = await pageFacts();
report.gate.cookie = (await page.cookies()).filter((c) => c.name === 'age_verified_diyvape').map((c) => ({ domain: c.domain, len: c.value.length }));
report.gate.errors = drain();
await page.screenshot({ path: OUT + 'home-after-gate-mobile.png' });

// 3) VERIFIED pages
for (const p of PAGES) {
  let status = await goto(p.path); let used = p.path;
  if (p.alt && status === 404) { for (const a of p.alt) { status = await goto(a); used = a; if (status !== 404) break; } }
  const facts = await pageFacts();
  const r = { path: used, status, facts, assets: (await themeAssets()).filter((a) => /theme\.js|global\.js|swiper|age-verification|main-product|collection\.js/.test(a)), errors: drain() };
  if (p.name === 'home') {
    r.cart = await clickAndDiff('cart', () => { const el = document.querySelector('#cart-icon-bubble'); if (!el) return 'no #cart-icon-bubble'; el.click(); return 'clicked'; });
    await page.keyboard.press('Escape'); await sleep(600);
    r.search = await clickAndDiff('search', () => { const el = [...document.querySelectorAll('header a, header button, [id$="__header"] a, [id$="__header"] button')].find((e) => /search|buscar/i.test((e.getAttribute('aria-label') || '') + ' ' + e.className + ' ' + (e.getAttribute('href') || ''))); if (!el) return 'no search trigger'; el.click(); return 'clicked ' + (el.getAttribute('aria-label') || el.className).slice(0, 40); });
    await page.keyboard.press('Escape'); await sleep(600);
    r.menu = await clickAndDiff('menu', () => { const el = [...document.querySelectorAll('header button, [id$="__header"] button, header a, [id$="__header"] a')].find((e) => /menu|menú|hamburger|drawer|nav/i.test((e.getAttribute('aria-label') || '') + ' ' + e.className + ' ' + (e.getAttribute('aria-controls') || ''))); if (!el) return 'no menu trigger'; el.click(); return 'clicked ' + (el.getAttribute('aria-label') || el.className).slice(0, 40); });
    await page.keyboard.press('Escape'); await sleep(400);
    await page.screenshot({ path: OUT + 'home-verified-mobile.png', fullPage: false });
  }
  if (p.name === 'product' || p.name === 'collection') await page.screenshot({ path: OUT + `${p.name}-verified-mobile.png` });
  report.pages[p.name] = r;
}
// desktop home screenshot
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1, isMobile: false });
await goto('/'); await page.screenshot({ path: OUT + 'home-verified-desktop.png' });
await browser.close();
writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
