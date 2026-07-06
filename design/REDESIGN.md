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
--nc-coral:          #EF4444;                    /* attention RED (user directive 2026-07-06: red, not orange) — live markers/destructive ONLY, never a 2nd interactive color. Landing + boot splash keep the original coral. */
--nc-chip-bg:        rgba(244, 244, 248, 0.04);  /* chip + input fill */
--nc-ease:           cubic-bezier(0.16, 1, 0.3, 1);  /* the single easing curve */
```

Keep the app's existing `--nc-duration-*` (120–300ms) and `--nc-z-*` scales. Landing's 0.9–1.15s entrances are landing-only.

**Accent discipline:** white/ink lines by default, **cyan for interactive/hot**, **coral only for live markers** (recording dots, unsaved indicators, destructive-confirm accents, validation errors). Selection: `background: var(--nc-accent); color: var(--nc-bg)`. Focus: `outline: 2px solid var(--nc-accent); outline-offset: 3px` (inputs: border-color change only, no ring/glow).

## 2. Canonical tokens — LIGHT (`:root.light`) — FINAL (Phase 7)

```css
--nc-bg:              #FAFAF9;   /* Warm Paper */
--nc-surface:         #FFFFFF;   /* cards lift to white */
--nc-surface-2:       #F6F6F4;   /* panels/popovers — warm-neutral step */
--nc-surface-3:       #EFEFEC;   /* hover step (pair with ink text on hover) */
--nc-surface-4:       #E7E7E3;   /* active/deep step */
--nc-border:          rgba(17, 17, 17, 0.14);  /* decorative hairline */
--nc-border-subtle:   rgba(17, 17, 17, 0.08);
--nc-border-active:   rgba(17, 17, 17, 0.28);
--nc-border-input:    rgba(17, 17, 17, 0.48);  /* form-control boundary — WCAG 1.4.11 ≥3:1 */
--nc-text:            #111111;   /* 18.08:1 */
--nc-text-secondary:  #6E6E6E;   /* 4.88:1 — NOT #777 (4.29:1 fails) */
--nc-text-muted:      #71716E;   /* 4.69:1 — min readable tier */
--nc-text-dim:        #8C8C89;   /* 3.23:1 — decorative/disabled ONLY */
--nc-accent:          #0b9e93;   /* UI components / large text (3.18:1) */
--nc-accent-text:     #087f76;   /* accent-colored body text (4.67:1) */
--nc-accent-contrast: #111111;   /* text ON accent fills — white is 3.32:1, fails */
--nc-selection-bg:    var(--nc-accent-dark);   /* #087f76 */
--nc-selection-text:  #FFFFFF;   /* 4.88:1 — accent bg + bg text pair is 3.18:1 */
--nc-coral:           #DC2626;   /* attention RED (user directive: red, not
                                    orange) — 4.62:1 on paper, AA as text */
--nc-chip-bg:         rgba(17, 17, 17, 0.04);
--nc-success:         #15803D;   --nc-warning: #A16207;
--nc-error:           #DC2626;   --nc-info:    #2563EB;  /* all ≥4.6:1 as text */
```

**`#5EF2E8` is NEVER light-mode text** (1.6:1) — fills/decoration only. Borders must stay visible (`rgba(17,17,17,0.14)`-order hairline, not white alpha); decorative hairlines are exempt from 1.4.11, form-control boundaries use `--nc-border-input`. Shadows are warm-tinted `rgba(50,45,35,…)`, never pure black. The theme-pair tokens (`--nc-border-input`, `--nc-accent-contrast`, `--nc-selection-*`) exist in the dark root too with values identical to prior dark behavior. The boot screen (`AppLoadingScreen.vue`) is a documented always-dark exception (its WebGL topo layer draws dark terrain).

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

### Light (Phase 7 — computed, final)

| Pair (light) | Ratio | Verdict |
|---|---|---|
| `#111111` text on bg `#FAFAF9` / surface `#FFFFFF` / surface-2 `#F6F6F4` | 18.08 / 18.88 / 17.45 | AAA |
| `#6E6E6E` secondary on bg / surface / surface-2 | 4.88 / 5.10 / 4.71 | AA |
| `#71716E` muted on bg / surface / surface-2 | 4.69 / 4.90 / 4.52 | AA |
| `#8C8C89` dim on bg / surface | 3.23 / 3.37 | decorative/disabled only |
| `#087f76` accent-text on bg / surface / surface-2 | 4.67 / 4.88 / 4.51 | AA |
| `#0b9e93` accent on bg / surface | 3.18 / 3.32 | UI components / large text only |
| `#DC2626` attention-red on bg / surface | 4.62 / 4.83 | AA (red replaced orange per user directive; dark `#EF4444` = 5.35 on `#050508`) |
| Primary button: `#FAFAF9` on ink `#111111` | 18.08 | AAA |
| Button on accent: `--nc-accent-contrast` `#111111` on `#0b9e93` | 5.69 | AA (white would be 3.32 — FAIL) |
| AI button hover: `#111111` on `#0fb5a8` | 7.37 | AAA |
| Selection: `#FFFFFF` on `#087f76` | 4.88 | AA |
| Status text `#15803D` / `#A16207` / `#DC2626` / `#2563EB` on bg | 4.80 / 4.71 / 4.62 / 4.95 | AA (surface: 5.02 / 4.92 / 4.83 / 5.17) |
| Input border `rgba(17,17,17,.48)` vs surface / bg | 3.32 / 3.31 | 1.4.11 pass |
| Focus outline `#0b9e93` vs surface / bg / surface-2 | 3.32 / 3.18 / 3.07 | 1.4.11 pass |
| Switch: accent track vs surface / `#FAFAF9` thumb on accent | 3.32 / 3.18 | 1.4.11 pass |
| Hairline `.14` / border-active `.28` vs surface | 1.35 / 1.90 | decorative — exempt |
| `#6E6E6E` secondary on surface-3 `#EFEFEC` (hover step) | 4.43 | note: hover grammar always brightens text to ink on surface-3 — no resting secondary text sits on it |

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

## 8. OFF-LIMITS: the landing page (user directive)

**Do not touch:** `app/assets/css/landing.css`, `app/components/landing/*`, `app/pages/index.vue`, `app/lib/topo-scene/*`. The landing shipped and is the *reference*, not a target. (The `.header-cta` orphan fix was reverted per this rule.)

## 8b. What stays OUT of app chrome

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
