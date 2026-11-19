# Vaporizadores Herbales — Shopify Theme (theme-v3.3, rama `vaporizadores-herbales`)

Tercera tienda sobre este tema. La rama sale del tema vivo de diyvape.co (commit `3729f83`, 22-09-2026). Contexto de arranque, trampas y ruta de QA: `ARRANQUE-TIENDA-NUEVA.md`.

## Tienda

- Shopify: `vaporizadoresherbales.myshopify.com`. Dominio primario: `www.vaporizadoresherbales.com`. Tema publicado: `theme-v3.3/vaporizadores-herbales` **#151079157966**, desde el 19-11-2026. El anterior, MINIMOG v4.0.0 `#130789146830`, sigue en la tienda sin publicar (de ahí salieron los datos de marca).
- **Cada push a `vaporizadores-herbales` es producción.** Los cambios se preparan en una rama aparte y se validan antes en una copia sin publicar del tema (`.claude/qa/theme-copy.py`), con `?preview_theme_id=<id>`.
- Catálogo: se clona desde DIY en otro proyecto. Ley 1480: solo productos, fotos y fichas reales; nada generado.
- Apps: Judge.me, Rapi, MercadoPago y LeadConnector se instalan en esta tienda, así que los grupos del cargador diferido se conservan.

## Commands

```bash
# `shopify theme *` no tiene acceso a esta tienda ("you don't have access to this dev store").
# Ruta que funciona: Admin GraphQL, solo con scopes de temas.
shopify store auth --store vaporizadoresherbales.myshopify.com --scopes read_themes,write_themes
# Mutaciones: --allow-mutations. El stdout trae ruido del spinner: leer siempre del --output-file,
# que contiene el objeto `data` directo (sin envoltorio).
shopify store execute --store vaporizadoresherbales.myshopify.com --query-file <f.graphql> --json --output-file <out.json>

# Validar templates/*.json antes de commitear (Shopify rechaza la plantilla entera en silencio)
python3 .claude/validate-template.py . templates/index.json

# Prueba de aceptación de paneles y gate: tema publicado, o una copia con --theme=<id>
node .claude/qa/smoke.mjs https://www.vaporizadoresherbales.com --collection=/collections/dynavap
# Latencia toque → primer frame del panel, sacada de la traza del navegador
node .claude/qa/visual.mjs https://www.vaporizadoresherbales.com/ cart --profile=fast4g --delay=0 --runs=5
# Copia desechable del tema (create / upsert / delete; nunca escribe un tema MAIN)
python3 .claude/qa/theme-copy.py create vaporizadoresherbales.myshopify.com 151079157966 "QA (borrar)"
# Contenido del tema contra una rama (sync-check.py solo compara nombres)
python3 .claude/qa/theme-diff.py vaporizadoresherbales.myshopify.com 151079157966 origin/vaporizadores-herbales

# Lighthouse 10-run median
bash ~/lighthouse-reports/lh-median.sh "https://www.vaporizadoresherbales.com/products/<handle>" 10 mobile
# Con cookie de edad verificada pre-seteada
node ~/lighthouse-reports/lh-with-cookie.mjs "<url>" 10 <outdir>
```

## Architecture

- **Shopify Liquid theme**. Standard structure: `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`.
- **Deferred asset loader** (`snippets/deferred-assets-loader.liquid`) gates third-party scripts (Rapi, MercadoPago, Judge.me, analytics) by age verification status + page type. Patches `Node.prototype.appendChild/insertBefore` for unverified or non-product pages; skipped for verified-on-PDP to preserve zero overhead.
- **Age gate** (`blocks/ai_gen_block_3f4d556.liquid`) is legally required (Ley 1581 de 2012). Cookie `age_verified_diyvape` stores DOB + ID + sig. Verification syncs to cart as attributes — never remove or bypass. Its `cookie_domain` in `sections/overlay-group.json` is empty (host-only), so the gate works on this domain without code changes.
- The cookie name and the `diyvape*` identifiers (`window.diyvapeDeferredAssets`, `diyvape-deferred-*` classes, `diyvape:*` events) are internal names inherited from the base theme, not user-visible. Renaming them is a large refactor with no return; Homesale kept them too.
- **Code shared across stores** lives in `sections/`, `snippets/`, `assets/`: cherry-pick fixes from `pagespeed-settings-improvements`. Identity lives in `config/settings_data.json`, `templates/*.json`, `sections/*-group.json`, `locales/*.json` and is never cherry-picked.

## Key Decisions

- **Age gate stays** (Ley 1581). This is the opposite of Homesale, which removed it.
- **Judge.me + Rapi restricted to product pages**: app embeds load via `content_for_header`, which can't be filtered server-side; the loader blocks them client-side on non-PDP pages.
- **DIY PDP kept** (`assets/diyvape-pdp-*`, `snippets/diyvape-pdp-*`, `blocks/_product-metadatos.liquid`): the catalog is cloned from DIY together with its metafields.
- **Shop Pay (`payment_button`) intact**: affects PDP UX and conversion.
- **LeadConnector** (`snippets/chat-widget-leadconnector.liquid`) uses the same widget ID as diyvape.co on purpose: one shared Grupo DIY account (confirmed by Juan, 22-09-2026).
- **Same company as DIY** (confirmed by Juan, 22-09-2026): legal entity `Grupo DIY S.A.S.`, NIT 901.476.931-3 and the WhatsApp line +57 320 668 2351 are shared with diyvape.co. The contact phone +57 301 355 2416 and ventas@vaporizadoresherbales.com are VH's own.
- **Blanked so Shopify accepts the templates in VH** (restore when the store has them): DIY hero videos in `templates/index.json`, and the dynamic source `collection.metafields.custom.collection_image_icon` (collection icons in `templates/collection*.json` and `index.json`) until the metafield definition exists in VH.
- **Validation route that shows the real error**: the GitHub sync rejects files silently; `themeFilesUpsert` on a throwaway `themeDuplicate` returns `userErrors` per file. Compare `theme.files` against `git ls-files` to find rejected files.
- **Shipping thresholds stay** (80.000 Bogotá / 250.000 nacional, confirmed by Juan 22-09-2026). Home is VH's (slideshow, brands, launches, mas-vendidos, blog `noticias`), colours follow VH green everywhere including the gate.
- **Cart and menu open from the loader, not from theme.js** (19-11-2026): `deferred-assets-loader.liquid` sets the same classes theme.js would (`nav-open`, `open-minicart`, `open-drawer`) in the click itself; theme.js takes over when it loads because it reads those classes. Search still waits for theme.js. Don't go back to holding the cart/menu tap until the deferred queue finishes (it cost 0,9–1,8 s on 4G).
- **Age-gate drawer suppression**: `suppressMinicartDrawer()` schedules its cleanup for the suppression that expires last (the shorter cart-sync call used to replace the timer and leave the three `diyvape-suppress-*` classes stuck: cart, search and mobile menu dead after verifying). The gate syncs the cart on every page load and suppresses cart/search for ~0,48 s; real clicks call `releaseSyncSuppression()` instead of being dropped. The ghost-click window (nav included) is still honoured.
- **`cart-components.js` is queued with `asset_url`**, before `theme.js`. Don't import it by relative path: that URL has no `?v=` and the CDN caches it for a year.
- **Home carousels init on first interaction by design** (`lazy-loading-swiper-after` in `global.js`/`slideshow-section.js` on `body.index`): a probe right after load shows them uninitialised; scroll or tap first.
- **Slideshow needs `motion-effect.js`** even with `scroll_animation: none`: the section enqueues it itself before `slideshow-section.js` (see the comment in `sections/slideshow.liquid`).
- **Pending (the theme is live since 19-11-2026)**: search "tendencias" and suggested collection still carry DIY's values (`popular_key_word`, `collection_suggestion`); the PDP `_product-live-view` block shows a random viewer count; `templates/page.about.json` is demo copy; VH has no `faqs`/`contact` pages (404); the PQRS link in the warranty text points to `/pages/peticiones-quejas-y-reclamos`, which may not exist in VH; header mega menu is empty; collection icons wait for the `custom.collection_image_icon` metafield; the header cart-count badge is white on #59c68a (2,13:1, header scheme left as is); top-bar arrows are 5px tap targets (24px via `--swiper-width` cut the text on desktop, reverted: needs a hit-area rule that doesn't take row space).
- **Contrast** (01-10-2026): light-background schemes use #1c7b47 for primary, buttons and sale/new badges (white on #59c68a measured 2,13:1). Dark schemes keep #59c68a as primary. Don't bring #59c68a back as a background under white text.

## Don'ts

- **Never push to `pagespeed-settings-improvements` (diyvape.co live) or `homesale` (homesale.com.co live).** Both deploy straight to production through the GitHub integration. The Bash hook blocks them via `CLAUDE_PROTECTED_BRANCHES` in `.claude/settings.json`.
- Don't bypass age verification or remove the cart sync of age attributes (regulatory).
- Don't add `payment_button`/dynamic checkout changes without explicit confirmation.
- JSON templates: run the validator before committing. `custom-liquid` **blocks** are textareas (no Liquid); the `custom-liquid` **section** does accept Liquid. Declare new block types in the section schema before (or together with, then re-touch) the template that uses them.
- Don't `git add -A`: `.agents/` and `skills-lock.json` are ignored on purpose.
