---
alwaysApply: true
---

# Code Quality

## Anti-defaults (counter common Claude tendencies)

- No premature abstractions. Three similar Liquid blocks beats a `snippets/_helper.liquid` used once.
- Don't add features or improvements beyond what was asked.
- Don't refactor adjacent code while fixing a bug.
- No dead code or commented-out blocks. Git has history.
- WHY comments, never WHAT. If code needs a "what" comment, rename the variable/snippet.
- Document non-obvious Liquid context (e.g. why a render is server-side vs deferred) at the top of the file or snippet.

## Naming (Shopify theme conventions)

- **Liquid files**: kebab-case (`product-media-layout.liquid`, `age-verification.css`).
- **Snippets prefixed with `_`** are private (only rendered by sibling snippets in same section). Public snippets unprefixed.
- **CSS classes**: kebab-case (`.ai-age-verify-overlay`). Avoid IDs except for unique elements (forms, custom elements).
- **JavaScript variables**: camelCase. **Custom elements**: kebab-case tag names with hyphen (`<age-verification-gate>`).
- **CSS custom properties**: kebab-case with semantic prefix (`--color-text`, `--btn-padding-x`).
- **Block IDs in Shopify**: `block.id` (auto-generated). For app embed targeting, use stable selectors like `[data-section-type="..."]` not block IDs.

## Code Markers

`TODO(author): desc` for planned work. `FIXME(author): desc` for known bugs. `HACK(author): desc` for ugly workarounds (explain the proper fix). `NOTE: desc` for non-obvious context. Owner required. Never `XXX`, `TEMP`, `REMOVEME`.

## Commit conventions (this repo)

- Commit subject: imperative, ≤72 chars (e.g. `Restrict Judge.me and Rapi to product pages only`).
- Commit body: explain WHY + measured impact. Reference Lighthouse metrics where relevant.
- Always `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when AI-assisted.

## File Organization

- Liquid: settings/schema/`{% liquid %}` block first, then HTML/CSS, then `<script>` (if any) last.
- CSS: critical above-fold rules inline in `<style>` Liquid block; rest in deferred CSS asset files.
- JavaScript: custom elements at top of file, helper functions/classes after, `customElements.define()` at the bottom or right after the class.
