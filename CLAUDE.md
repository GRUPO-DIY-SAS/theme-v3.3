# DIY Vape Shop — Shopify Theme (theme-v3.3)

## Commands

```bash
# Push working tree to a dev theme (preview-only, doesn't publish)
shopify theme push --store=diy-ejuice-colombia.myshopify.com --theme=<id> --nodelete --only "<files>"

# Lighthouse 10-run median against live or preview URL
bash ~/lighthouse-reports/lh-median.sh "https://diyvape.co/products/<handle>" 10 mobile

# Lighthouse with age-verified cookie pre-set (verified user scenario)
node ~/lighthouse-reports/lh-with-cookie.mjs "<url>" 10 <outdir>
```

## Architecture

- **Shopify Liquid theme**. Standard structure: `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`.
- **Deferred asset loader** (`snippets/deferred-assets-loader.liquid`) gates third-party scripts (Rapi, MercadoPago, Judge.me, analytics) by age verification status + page type. Patches `Node.prototype.appendChild/insertBefore` for unverified or non-product pages; skipped for verified-on-PDP to preserve zero overhead.
- **Age gate** (`blocks/ai_gen_block_3f4d556.liquid`) is legally required (Ley 1581 de 2012). Cookie `age_verified_diyvape` stores DOB + ID + sig. Verification syncs to cart as attributes — never remove or bypass.
- **Live theme syncs from GitHub branch `pagespeed-settings-improvements` → live theme `#158298636540`** via Shopify GitHub integration.

## Key Decisions

- **Judge.me + Rapi restricted to product pages**: app embeds load via `content_for_header` which we can't filter server-side. The deferred-assets-loader blocks them client-side on non-PDP pages permanently. See commit `ceddca5`.
- **Shop Pay (`payment_button`) intact**: was tested for removal but reverted — affects PDP UX and conversion.

## Don'ts

- Don't bypass age verification or remove the cart sync of age attributes (regulatory).
- Don't add `payment_button`/dynamic checkout changes without explicit confirmation.
- Don't push directly to live theme — work on dev themes (e.g. `#158388027644 lh-test`) via Shopify CLI.
