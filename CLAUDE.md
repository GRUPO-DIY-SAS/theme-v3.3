# Vaporizadores Herbales — Shopify Theme (theme-v3.3, rama `vaporizadores-herbales`)

Tercera tienda sobre este tema. La rama sale del tema vivo de diyvape.co (commit `3729f83`, 22-09-2026). Contexto de arranque, trampas y ruta de QA: `ARRANQUE-TIENDA-NUEVA.md`.

## Tienda

- Shopify: `vaporizadoresherbales.myshopify.com`. Dominio primario: `www.vaporizadoresherbales.com`. Tema publicado hoy: MINIMOG v4.0.0 `#130789146830` (no es este tema; de ahí salieron los datos de marca).
- **Tema conectado: ninguno todavía.** Se conecta desde Admin → Online Store → Themes → Add theme → Connect from GitHub, y el tema resultante queda **sin publicar** hasta que la validación pase. Una vez publicado, cada push a `vaporizadores-herbales` es producción.
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
- **Still DIY's, pending**: shipping-widget thresholds (80.000 Bogotá / 250.000 nacional, in `templates/product.json` delivery block and `sections/main-cart-items.liquid`); `templates/index.json` is DIY's home (rebuild for VH once the catalog is cloned); `templates/page.about.json` is demo copy; the PQRS link in the warranty text points to `/pages/peticiones-quejas-y-reclamos`, which may not exist in VH.

## Don'ts

- **Never push to `pagespeed-settings-improvements` (diyvape.co live) or `homesale` (homesale.com.co live).** Both deploy straight to production through the GitHub integration. The Bash hook blocks them via `CLAUDE_PROTECTED_BRANCHES` in `.claude/settings.json`.
- Don't bypass age verification or remove the cart sync of age attributes (regulatory).
- Don't add `payment_button`/dynamic checkout changes without explicit confirmation.
- JSON templates: run the validator before committing. `custom-liquid` **blocks** are textareas (no Liquid); the `custom-liquid` **section** does accept Liquid. Declare new block types in the section schema before (or together with, then re-touch) the template that uses them.
- Don't `git add -A`: `.agents/` and `skills-lock.json` are ignored on purpose.
