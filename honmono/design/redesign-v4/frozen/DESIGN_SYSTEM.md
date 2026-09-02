# DESIGN_SYSTEM

## COLOR

### Dark theme — independently defined

| Token | Value | Role | Contrast |
|---|---:|---|---:|
| `--c-canvas` | `#0B0E10` | page canvas | — |
| `--c-surface` | `#111518` | task/card surface | — |
| `--c-surface-2` | `#171C1F` | warning/data inset | — |
| `--c-text` | `#F2E2C6` | primary text | 15.19:1 vs canvas |
| `--c-muted` | `#B6A98F` | secondary text | 8.35:1 vs canvas |
| `--c-brass` | `#D3AB67` | brand accent / links | 9.03:1 vs canvas |
| `--c-seal` | `#D85A4B` | brand red text / focus accent | 5.06:1 vs canvas |
| `--c-seal-deep` | `#8F201A` | filled CTA background | use cream text |
| `--c-ok` | `#82B38A` | evidence = ok | 8.08:1 vs canvas |
| `--c-warn` | `#E2AC4C` | evidence = warn | 9.44:1 |
| `--c-bad` | `#E36B5D` | evidence = bad | 6.02:1 |
| `--c-info` | `#7FA1B2` | evidence = info / neutral | 7.05:1 |
| `--c-line` | `#5A5145` | borders/dividers | non-text |

### Light theme — independently defined

| Token | Value | Role | Contrast |
|---|---:|---|---:|
| `--c-canvas` | `#F3EDE2` | warm paper canvas | — |
| `--c-surface` | `#FFFDF8` | primary paper surface | — |
| `--c-surface-2` | `#E8DFD2` | inset / dossier tab | — |
| `--c-text` | `#191816` | primary ink | 15.23:1 vs canvas |
| `--c-muted` | `#625A50` | secondary ink | 5.82:1 |
| `--c-brass` | `#7F5A23` | brand accent / links | 5.32:1 |
| `--c-seal` | `#9C2B22` | brand red | 6.48:1 |
| `--c-seal-deep` | `#7D211B` | filled CTA | use `#FFF8EE` text |
| `--c-ok` | `#316B45` | evidence = ok | 6.22:1 vs surface |
| `--c-warn` | `#8E5C0A` | evidence = warn | 5.61:1 |
| `--c-bad` | `#9D2A22` | evidence = bad | 7.41:1 |
| `--c-info` | `#3E687C` | evidence = info / neutral | 5.94:1 |
| `--c-line` | `#B7AA98` | borders/dividers | non-text |

**Rule:** body text and actionable labels >= 4.5:1. Large display >= 3:1. `--c-seal-deep` is never used as small dark-theme text because its contrast is insufficient; it is a filled shape only.

## TYPOGRAPHY

No web fonts. CSS stacks only.

```css
--font-display: ui-serif, "Hiragino Mincho ProN", "Yu Mincho", YuMincho,
                "Noto Serif CJK JP", serif;
--font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
           "Hiragino Sans", "Yu Gothic UI", "Yu Gothic",
           "Noto Sans CJK JP", sans-serif;
```

Exactly five hierarchy levels:

| Level | Mobile size / line-height | Weight | Family | Use |
|---|---|---:|---|---|
| `--type-display` | `clamp(2.25rem, 10vw, 3.5rem) / 1.22` | 400 | display | HOME hero only |
| `--type-title` | `1.75rem / 1.35` | 600 | display | screen / result title |
| `--type-section` | `1.25rem / 1.45` | 600 | display or UI | section heading |
| `--type-body` | `1rem / 1.75` | 400 | UI | normal body / controls |
| `--type-meta` | `.8125rem / 1.55` | 500 | UI | labels, status, table notes |

Numbers in Report / Business use `font-variant-numeric: tabular-nums`.

## SPACING

Base 4px. Allowed scale:

`--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px; --sp-12:48px; --sp-16:64px`

Rules:
- Touch control internal vertical padding >= 12px.
- Task section gap = 32px; major semantic break = 48px.
- Home can use 64px negative space between Hero and pillars.
- Dense tables may use 8px cell padding but never below.

## RADIUS

Three only:
- `--r-0: 0px` — dividers, dossier edges, tables.
- `--r-1: 8px` — buttons, tags, inputs.
- `--r-2: 18px` — major surfaces / modal menu / result block.

Do not introduce pill shapes except compact state labels where height/2 is semantically a tag, not a new radius token.

## ELEVATION_SURFACE

- Default: border + tonal surface; no floating SaaS shadows.
- Dark: `1px` brass/neutral border at 35–55% alpha.
- Light: paper layers separated by border and 0 8px 24px rgba(40,31,20,.07) only for overlays/menu.
- Hero Artwork may overlap the canvas but never become glassmorphism.
- Document tables are flat.

## STATE_LANGUAGE

Color is never the only carrier.

| State | Color | Glyph/shape | Text |
|---|---|---|---|
| `bad` | `--c-bad` | clipped diamond / `!` | `AI痕跡` / `危険` |
| `warn` | `--c-warn` | diagonal slash `/` | `注意` |
| `ok` | `--c-ok` | bracketed check `✓` | `実写材料` / `確認` |
| `info` | `--c-info` | open circle `○` | `情報` / `中立` |

`判定材料なし` is always `info`, never green.

## ICON_LANGUAGE

- Inline SVG only; `stroke="currentColor"`.
- 24px nominal viewport, 1.75px stroke, round linecap, no filled cartoon icons.
- Icons are drawn from “document / lens / seal / ledger / building / book” primitives.
- No icon font, emoji as primary icon, 3D icon, neon glow.
- Logo seal is `assets/logo_seal.svg`.
- Task signature line is `assets/evidence_spine.svg`.

## FOCUS_AND_A11Y

- Minimum tap target: 44x44 CSS px.
- `:focus-visible`: 2px `--c-seal` outer ring + 2px transparent gap; never remove outline without replacement.
- Drag/drop target remains `role=button`, `tabindex=0`, Enter / Space.
- Current navigation: `aria-current="page"` plus a visible 2px red index line; not color only.
- Inputs keep associated labels.
- Decorative Hero Artwork: `alt=""`; content-relevant preview images use concrete alt.
- Reduced motion preserves all state changes in text/glyph.

## TOKENS

```css
:root {
  --font-display: ui-serif, "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif CJK JP", serif;
  --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Noto Sans CJK JP", sans-serif;

  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-6: 24px; --sp-8: 32px; --sp-12: 48px; --sp-16: 64px;

  --r-0: 0px; --r-1: 8px; --r-2: 18px;

  --dur-press: 110ms; --dur-fast: 160ms; --dur-base: 220ms;
  --dur-brand: 420ms;
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-standard: cubic-bezier(.4,0,.2,1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --c-canvas:#0B0E10; --c-surface:#111518; --c-surface-2:#171C1F;
    --c-text:#F2E2C6; --c-muted:#B6A98F; --c-brass:#D3AB67;
    --c-seal:#D85A4B; --c-seal-deep:#8F201A;
    --c-ok:#82B38A; --c-warn:#E2AC4C; --c-bad:#E36B5D;
    --c-info:#7FA1B2; --c-line:#5A5145;
  }
}
@media (prefers-color-scheme: light) {
  :root {
    --c-canvas:#F3EDE2; --c-surface:#FFFDF8; --c-surface-2:#E8DFD2;
    --c-text:#191816; --c-muted:#625A50; --c-brass:#7F5A23;
    --c-seal:#9C2B22; --c-seal-deep:#7D211B;
    --c-ok:#316B45; --c-warn:#8E5C0A; --c-bad:#9D2A22;
    --c-info:#3E687C; --c-line:#B7AA98;
  }
}
```

Implementer must not introduce raw color/radius values outside the token definitions except transparent alpha variants derived from these tokens.
