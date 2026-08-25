# Homesale — Shopify Theme (branch `homesale`, derived from DIY Vape theme-v3.4)

## Commands

```bash
# Push working tree to a dev theme (preview-only, doesn't publish)
shopify theme push --store=<homesale-store>.myshopify.com --theme=<id> --nodelete --only "<files>"

# Lighthouse 10-run median against live or preview URL
bash ~/lighthouse-reports/lh-median.sh "https://www.homesale.com.co/products/<handle>" 10 mobile
```

## Architecture

- **Shopify Liquid theme**. Standard structure: `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`.
- **Deferred asset loader** (`snippets/deferred-assets-loader.liquid`): theme CSS/JS are queued in `window.diyvapeDeferredAssets` from `layout/theme.liquid` + `snippets/scripts-tag.liquid` and start on idle (INP). Off product pages it drops Judge.me widget scripts (reviews are PDP-only; the app embed injects via `content_for_header` and can't be filtered server-side). `diyvape*` identifiers are internal names inherited from the base theme, not user-visible.
- **No age gate.** Homesale sells no age-restricted products; the DIY age gate (block, assets, cookie detector, cart attribute sync) was removed on this branch. Do not re-add it.
- **Branch strategy**: `homesale` diverges from `pagespeed-settings-improvements` (DIY Vape live). Shared code lives in `sections/`, `snippets/`, `assets/`; brand config in `config/settings_data.json`, `templates/*.json`, `sections/*-group.json`. Cherry-pick perf/bug fixes from the DIY branch.

## Key Decisions

- **Judge.me stays** (to be installed on Homesale), restricted to product pages by the deferred loader.
- **Rapi and LeadConnector chat removed**: DIY-only apps/accounts.
- **Shop Pay (`payment_button`) intact**: affects PDP UX and conversion.

## Don'ts

- Don't push directly to the Homesale live theme — work on dev themes via Shopify CLI.
- Don't add `payment_button`/dynamic checkout changes without explicit confirmation.
