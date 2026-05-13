---
paths:
  - "blocks/ai_gen_block_3f4d556.liquid"
  - "assets/age-verification.js"
  - "snippets/cart-*.liquid"
  - "snippets/minicart.liquid"
  - "snippets/deferred-assets-loader.liquid"
  - "layout/theme.liquid"
---

# Security

- **Age verification (Ley 1581 de 2012 Colombia)**: cookie `age_verified_diyvape` must always carry `{verified, dob, id, sig, added_at}`. Cart sync must persist DOB + ID full + signature as cart attributes. Never bypass the gate or remove the attributes.
- Use Liquid's auto-escaping (`{{ variable }}` escapes by default). Use `| escape` filter for any rendering of user-provided content or product metafields.
- Never inline raw `{{ customer.email }}` or PII into HTML attributes that could leak via referer or analytics.
- Cart sync (`assets/age-verification.js` `keepalive: true` fetch) must use Shopify's `/cart/update.js` endpoint — don't roll a custom endpoint.
- App embed third-party scripts (Rapi, MercadoPago, Judge.me) are intercepted by `deferred-assets-loader.liquid`. Don't disable the interceptor without understanding the age-gate flow.
- Never log `dob_full`, `id_full`, or cart `note` attributes to console or analytics.
- Shopify metafield reads in Liquid are read-only at render time — safe to render but escape if injecting into JSON-LD.
