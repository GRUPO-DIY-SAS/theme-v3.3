---
paths:
  - "**/*.liquid"
  - "**/*.css"
  - "assets/*.js"
  - "assets/*.css"
  - "snippets/**"
  - "sections/**"
  - "blocks/**"
  - "layout/**"
  - "templates/**"
---

# Frontend (Shopify Liquid theme)

## Liquid conventions

- Use `{%- liquid ... -%}` blocks (no-whitespace) for multi-line logic instead of multiple `{%-`/`-%}` tags.
- Prefer `assign` over `capture` when concatenating simple strings. `capture` is for HTML.
- Use `{% # comment %}` single-line comments inside `{% liquid %}` blocks, NOT `{% comment %}...{% endcomment %}`.
- Server-side: filter early with `where`/`limit:`. Avoid iterating full `collection.products` without `limit:`.
- Use `image_url: width: <n>` and pair with `image_tag: widths: "<csv>"` for responsive images. Match the `sizes` attribute to the rendered viewport.

## Performance (Core Web Vitals priority)

- **LCP candidates**: preload via `<link rel="preload" as="image" imagesrcset imagesizes fetchpriority="high">` in `<head>` for above-fold images.
- **Render-blocking CSS**: only `critical-base.liquid` inline + `critical.css` should block first paint. Defer rest via `media="print" onload="this.media='all'"` or via `diyvapeDeferredAssets` queue.
- **JavaScript**: third-party app embeds (Rapi/MercadoPago/Judge.me/GTM) flow through `deferred-assets-loader.liquid` blocker. Don't add scripts that bypass it.
- **First card eager loading**: only the first N (currently 4) product cards in a collection grid get `loading=eager`. Don't add eager to below-fold images.

## Accessibility

- All interactive `<button>` elements must have visible focus indicators or `:focus-visible` styling.
- Images: meaningful `alt` from `product.featured_media.alt` or `block.settings.logo.alt`. Decorative: `alt=""`.
- Form inputs: associated `<label>` (already done in `buy-buttons.liquid` and cart). Keep when refactoring.
- Color contrast ≥ 4.5:1 normal text. Check via theme color schemes in `config/settings_data.json`.

## CLS prevention

- Always include `width` and `height` attributes on `<img>` (already in `snippets/responsive-image.liquid`).
- Use `style="--aspect-ratio: ..."` containers from `critical-base.liquid` for image placeholders.
- Skeleton placeholders should match final layout dimensions.

## Don'ts

- Don't add `<script>` tags directly in `<head>` of `layout/theme.liquid` without considering the deferred-assets-loader path.
- Don't inline base64 images > 1KB — use Shopify CDN.
- Don't load custom fonts via `@import` in CSS — use `<link rel="preload">` in `<head>` or system fonts.
