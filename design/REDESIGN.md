# NeuroCanvas App Redesign — Design Language Spec (AER-76)

Source of truth for the comprehensive app redesign on `feature/comprehensive-redesign`.
Extracted from `neurocanvas-3d-landing` (already ported in-repo as `app/assets/css/landing.css` + `app/components/landing/*`). The landing stays cinematic; **app chrome stays calm** — Linear/Stripe grade. The landing contributes palette, type voice, hairline discipline, and easing — not its theatre.

## 1. Canonical tokens — DARK (default)

```css
--nc-bg:             #050508;                    /* the only background */
--nc-surface:        #0d0d11;                    /* one step up (docs surface) */
--nc-surface-2:      #131318;                    /* panels, popovers */
--nc-surface-3:      #1a1a20;                    /* hover states */
--nc-border:         rgba(244, 244, 248, 0.14);  /* THE hairline. 1px only, never 2px */
--nc-border-subtle:  rgba(244, 244, 248, 0.08);
--nc-text:           #f4f4f8;
--nc-text-secondary: rgba(244, 244, 248, 0.62);
--nc-text-muted:     rgba(244, 244, 248, 0.45);  /* min tier for readable text */
--nc-text-dim:       rgba(244, 244, 248, 0.38);  /* decorative/disabled ONLY (3.25:1) */
--nc-accent:         #5EF2E8;                    /* canonical. #00D2BE is LEGACY — remove */
--nc-accent-dark:    #3AC2B9;
--nc-coral:          #FF8A5C;                    /* live markers/attention ONLY, never a 2nd interactive color */
--nc-chip-bg:        rgba(244, 244, 248, 0.04);  /* chip + input fill */
--nc-ease:           cubic-bezier(0.16, 1, 0.3, 1);  /* the single easing curve */
```

Keep the app's existing `--nc-duration-*` (120–300ms) and `--nc-z-*` scales. Landing's 0.9–1.15s entrances are landing-only.

**Accent discipline:** white/ink lines by default, **cyan for interactive/hot**, **coral only for live markers** (recording dots, unsaved indicators, destructive-confirm accents, validation errors). Selection: `background: var(--nc-accent); color: var(--nc-bg)`. Focus: `outline: 2px solid var(--nc-accent); outline-offset: 3px` (inputs: border-color change only, no ring/glow).

## 2. Canonical tokens — LIGHT (`:root.light`)

```css
--nc-bg:             #FAFAF9;   /* Warm Paper */
--nc-surface:        #FFFFFF;
--nc-text:           #111111;   /* 18.08:1 */
--nc-text-secondary: #6E6E6E;   /* ~4.9:1 — NOT #777 (4.29:1 fails) */
--nc-accent:         #0b9e93;   /* UI components / large text (3.18:1) */
--nc-accent-text:    #087f76;   /* accent-colored body text */
--nc-coral:          #d95f2f;
```

**`#5EF2E8` is NEVER light-mode text** (1.6:1) — fills/decoration only. Borders must stay visible (`rgba(17,17,17,0.14)`-order hairline, not white alpha).

## 3. WCAG verification (computed)

| Pair (dark) | Ratio | Verdict |
|---|---|---|
| `#f4f4f8` on `#050508` | 18.55:1 | AAA |
| `.62` tier on bg/surface | 7.17/7.09:1 | AAA |
| `.38` tier on bg | 3.25:1 | decorative/large only |
| `#5EF2E8` on `#050508` | 14.87:1 | AAA |
| `#FF8A5C` on `#050508` | 8.76:1 | AAA |
| `#050508` on `#5EF2E8` / `#f4f4f8` | 14.87 / 18.55:1 | AAA |
| OLD `#71717A` on `#09090B` | 4.12:1 | **FAIL — this redesign fixes it** |
| OLD `#52525B` on `#09090B` | 2.57:1 | **FAIL — restrict to disabled** |

## 4. Typography

```css
--nc-font-display: 'Cabinet Grotesk', 'Inter', system-ui, sans-serif; /* 800/700 headings */
--nc-font-body:    'Inter', system-ui, sans-serif;                    /* body/UI — NOT Cabinet Grotesk */
--nc-font-serif:   'Instrument Serif', georgia, serif;                /* italic accent only */
--nc-font-mono:    'JetBrains Mono', ui-monospace, monospace;         /* micro-labels */
```

- **Page titles / modal headers:** Cabinet Grotesk 700–800, tracking −0.015 to −0.02em, leading 1.02–1.05. Chrome sizes stay static (`--nc-text-*` scale); landing `clamp()` scale is for marketing pages.
- **Serif italic accent** (`.accent`: Instrument Serif italic 400, cyan): **max once per top-level page title** (dashboard greeting, empty-state headline). Never in dense UI or body copy.
- **Mono micro-label system** (the identity glue): JetBrains Mono, uppercase, 0.66–0.74rem, tracking 0.14–0.22em, `--nc-text-secondary`. Use for: section eyebrows, badges, table headers, kbd hints, input labels. Eyebrow pattern: `NODE 01 · Generate` with the numeric prefix in coral.
- Body: Inter 1rem / 1.6. Prose: lh 1.75, max 62ch.

## 5. Component grammar (exact)

- **Primary button:** ink pill — `bg: var(--nc-text); color: var(--nc-bg); border-radius: 2.4rem; font: display 700 0.98rem; padding: 0.95rem 1.9rem`. Hover: `background: var(--nc-accent); transform: translateY(-1px)` (chrome subdues the landing's −2px + glow; **no glow in chrome**). Disabled: `opacity: .45`, no transform.
- **Ghost button / text links:** mono uppercase 0.78rem/0.1em, `--nc-text-secondary`; `::after` underline 1px `scaleX(0.35)` origin-left → hover `scaleX(1)` + text cyan. 0.45s ease.
- **Inputs:** fill `--nc-chip-bg`, `1px solid var(--nc-border)`, radius 0.5rem, padding 0.85rem 1rem, Inter 0.95rem. Focus: `border-color: var(--nc-accent)` only. Invalid: coral border. Placeholder: `--nc-text-dim`. Label above: mono uppercase 0.68rem/0.16em.
- **Cards/panels:** flat `--nc-surface(-2)` + 1px hairline, radius 0 to 0.5rem (sharp is the default posture). Hover (interactive cards): `translateY(-3px)`? NO — in chrome: border-color shift to `--nc-text-secondary` only. **No backdrop-filter glass anywhere in chrome** — replace all `nc-glass*` usage with flat surface + hairline.
- **Survey frame** (dashed hairline + coral `+` corner marks, `background: rgba(5,5,8,0.66)`): reserved for **empty states and onboarding callouts only**.
- **Chips/badges:** mono 0.76rem cyan on `--nc-chip-bg`, hairline, radius 0.4rem, padding 0.55rem 0.9rem.
- **Tooltips:** CSS `data-tip` pattern — `bg: var(--nc-bg); 1px hairline; radius 0.35rem; mono 0.66rem`.
- **Dialogs/modals:** flat `--nc-surface-2`, hairline, centered, `transform-origin: center`, enter `scale(0.97)+opacity` 200ms ease-out, exit faster. No slide-in theatrics.
- **Dropdowns/popovers:** `transform-origin` at trigger, 150–200ms, `scale(0.97)+opacity`.
- **Nav items:** mono uppercase, `--nc-text-secondary` → cyan hover with underline-grow. Active state: cyan + underline (`text-underline-offset: 0.35em`) — never color alone.
- **Radius scale:** 0 (frames/cards default) / 0.35rem tooltip / 0.4rem chip / 0.5rem input / 2–2.4rem pills / 50% dots. Nothing in 12–32px range.

## 6. Motion rules (chrome)

- Single ease `cubic-bezier(0.16,1,0.3,1)`; durations 100–300ms (press 100–160, tooltip 125–200, dropdown 150–250, modal 200–300).
- `:active` on pressables: `scale(0.97)`.
- Animate `transform`/`opacity` only. `transition` with explicit properties, never `all`.
- Never animate keyboard-initiated actions (command palette open = instant).
- Entrances start at `scale(0.95–0.97)+opacity:0`, never `scale(0)`.
- `prefers-reduced-motion`: keep opacity/color, drop movement (existing accessibility.css hooks stay).
- Hover effects gated by `@media (hover: hover) and (pointer: fine)`.

## 7. Theme-aware brand mark (user requirement)

`NcLogo.vue` + landing `BrandMark` currently hardcode `#f4f4f8` fills / `rgba(244,244,248,0.55)` stroke. Convert to `currentColor` (component sets `color: var(--nc-text)`), stroke via opacity on currentColor. The mark must render correctly on both `#050508` and `#FAFAF9` with no per-theme SVG swaps.

## 8. What stays OUT of app chrome

Cursor reticle (never — hostile in a productivity app), coords readout, depth rail (allowed only as docs reading-progress hairline), topo shader (boot screen only — already done), giant wordmark, wire-drop cue, grain/vignette, 165vh sticky sections, Lenis smooth scroll, 0.9–1.15s word-mask entrances (page titles at most, ≤0.5s, first paint only), dual-layer roll hovers, glassmorphism panels.

## 9. Hard rules (from user + skills)

- **No inline `style`/`:style` in Vue components** — UnoCSS utilities or scoped style blocks only (drive dynamic values via CSS custom properties set in scoped CSS, single var like the depth rail's `--rail-p` if unavoidable).
- No emojis as icons; `i-lucide-*` icon set stays, 16–20px, monochrome.
- Touch targets ≥44×44px on mobile surfaces.
- `cursor: pointer` on all interactive elements.
- One source of truth: `tokens.css` defines values; `uno.config.ts` theme colors reference `var(--nc-*)` (utilities become theme-aware). Never re-hardcode a palette in a component (`--al-*`, DocsLayout overrides = the anti-pattern being removed).
- TypeScript strict; conventional commits; no Co-Authored-By.
- Canvas renderers (`canvas/renderers/*.ts`, `InfiniteCanvas.vue` painting) are **out of scope** — only keep `useCanvasTheme.ts` + node-default colors aligned to tokens (legacy `#00D2BE` → accent token).

## 10. Verification bar

Dark first, then light. Every text-on-surface pair ≥4.5:1 (AA) or documented as large/decorative. Both modes checked per surface. `vitest`, eslint (errors), `nuxt build` green. Visual smoke on dashboard / settings / editor / docs / mobile widths in both modes.
