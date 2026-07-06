import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify({
      prefix: 'un-',
      prefixedOnly: false
    }),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle'
      }
    })
  ],

  transformers: [
    transformerDirectives(),
    transformerVariantGroup()
  ],

  // Theme-aware utilities — every color references tokens.css (the single
  // source of truth, see design/REDESIGN.md §1). Colors that are used with
  // alpha modifiers (e.g. `bg-nc-accent/20`) go through comma rgb-triplet
  // companion vars via the `%alpha` placeholder, because plain var() colors
  // can't take `/alpha`.
  theme: {
    colors: {
      // Canvas Environment — Minimal
      'nc-bg': 'rgba(var(--nc-bg-rgb), %alpha)',
      'nc-canvas': 'var(--nc-canvas)',
      'nc-surface': 'rgba(var(--nc-surface-rgb), %alpha)',
      'nc-surface-2': 'rgba(var(--nc-surface-2-rgb), %alpha)',
      'nc-surface-3': 'var(--nc-surface-3)',
      'nc-surface-4': 'var(--nc-surface-4)',

      // Legacy mappings
      'nc-charcoal': 'var(--nc-charcoal)',
      'nc-graphite': 'rgba(var(--nc-surface-rgb), %alpha)',
      'nc-pencil': 'var(--nc-pencil)',

      // Borders
      'nc-border': 'var(--nc-border)',
      'nc-border-subtle': 'var(--nc-border-subtle)',
      'nc-border-active': 'var(--nc-border-active)',

      // Text
      'nc-ink': 'var(--nc-ink)',
      'nc-ink-soft': 'var(--nc-ink-soft)',
      'nc-ink-muted': 'var(--nc-ink-muted)',
      'nc-ink-faint': 'var(--nc-ink-faint)',
      'nc-text': 'var(--nc-text)',
      'nc-text-secondary': 'var(--nc-text-secondary)',
      'nc-text-muted': 'var(--nc-text-muted)',

      // Accent — landing cyan
      'nc-accent': 'rgba(var(--nc-accent-rgb), %alpha)',
      'nc-accent-light': 'var(--nc-accent-light)',
      'nc-accent-dark': 'var(--nc-accent-dark)',
      'nc-accent-text': 'var(--nc-accent-text)',
      'nc-teal': 'rgba(var(--nc-accent-rgb), %alpha)',
      'nc-teal-light': 'var(--nc-teal-light)',
      'nc-teal-dark': 'var(--nc-teal-dark)',

      // Coral (live markers only) + chip fill
      'nc-coral': 'var(--nc-coral)',
      'nc-chip': 'var(--nc-chip-bg)',

      // Node Colors
      'nc-node-purple': 'var(--nc-node-purple)',
      'nc-node-pink': 'var(--nc-node-pink)',
      'nc-node-blue': 'var(--nc-node-blue)',
      'nc-node-green': 'var(--nc-node-green)',
      'nc-node-orange': 'var(--nc-node-orange)',
      'nc-node-yellow': 'var(--nc-node-yellow)',

      // Status
      'nc-success': 'rgba(var(--nc-success-rgb), %alpha)',
      'nc-warning': 'rgba(var(--nc-warning-rgb), %alpha)',
      'nc-error': 'rgba(var(--nc-error-rgb), %alpha)',
      'nc-info': 'rgba(var(--nc-info-rgb), %alpha)',

      // Semantic
      'nc-primary': 'rgba(var(--nc-accent-rgb), %alpha)',
      'nc-secondary': 'var(--nc-secondary)',
      'nc-surface-elevated': 'var(--nc-surface-elevated)',
      'nc-surface-hover': 'var(--nc-surface-hover)'
    },

    fontFamily: {
      display: ['Cabinet Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      body: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Instrument Serif', 'Georgia', 'serif'],
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'monospace']
    },

    fontSize: {
      'nc-xs': '0.75rem',
      'nc-sm': '0.875rem',
      'nc-base': '1rem',
      'nc-lg': '1.125rem',
      'nc-xl': '1.25rem',
      'nc-2xl': '1.5rem',
      'nc-3xl': '2rem',
      'nc-4xl': '2.75rem'
    },

    borderRadius: {
      'nc-sm': 'var(--nc-radius-sm)',
      'nc-md': 'var(--nc-radius-md)',
      'nc-lg': 'var(--nc-radius-lg)',
      'nc-xl': 'var(--nc-radius-xl)',
      'nc-2xl': 'var(--nc-radius-2xl)'
    },

    boxShadow: {
      'nc-sm': 'var(--nc-shadow-sm)',
      'nc-md': 'var(--nc-shadow-md)',
      'nc-lg': 'var(--nc-shadow-lg)',
      'nc-xl': 'var(--nc-shadow-xl)',
      'nc-glow': 'var(--nc-glow-accent)',
      'nc-glow-accent': 'var(--nc-glow-accent)'
    },

    zIndex: {
      'canvas': 0,
      'nodes': 10,
      'edges': 5,
      'minimap': 90,
      'toolbar': 100,
      'dropdown': 200,
      'modal': 300,
      'toast': 400,
      'cursor': 9999
    },

    animation: {
      keyframes: {
        'nc-pulse-glow': '{0%, 100% { box-shadow: 0 0 0 0 var(--nc-teal-glow) } 50% { box-shadow: 0 0 0 8px transparent }}',
        'nc-fade-in': '{from { opacity: 0 } to { opacity: 1 }}',
        'nc-slide-in': '{from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) }}',
        'nc-scale-in': '{from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) }}',
        'nc-node-appear': '{from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) }}'
      },
      durations: {
        'nc-press': 'var(--nc-duration-press)',
        'nc-instant': 'var(--nc-duration-instant)',
        'nc-fast': 'var(--nc-duration-fast)',
        'nc-normal': 'var(--nc-duration-normal)',
        'nc-slow': 'var(--nc-duration-slow)',
        'nc-slower': 'var(--nc-duration-slower)',
        'nc-reveal': 'var(--nc-duration-reveal)'
      },
      timingFns: {
        'nc-ease': 'var(--nc-ease)',
        'nc-ease-out': 'var(--nc-ease-out)',
        'nc-ease-in-out': 'var(--nc-ease-in-out)',
        'nc-ease-entrance': 'var(--nc-ease-entrance)',
        'nc-ease-bounce': 'var(--nc-ease-bounce)',
        'nc-ease-smooth': 'var(--nc-ease-smooth)',
        'nc-ease-drawer': 'var(--nc-ease-drawer)'
      }
    }
  },

  rules: [
    // Explicit transition properties (REDESIGN.md §6 — never `transition: all`)
    ['nc-anim', {
      'transition-property': 'color, background-color, border-color, opacity, transform, box-shadow',
      'transition-duration': 'var(--nc-duration-normal)',
      'transition-timing-function': 'var(--nc-ease)'
    }]
  ],

  shortcuts: {
    // Flat surfaces — legacy "glass" names, de-glassed per REDESIGN.md §5:
    // flat surface + 1px hairline, NO backdrop-blur anywhere in chrome.
    'nc-glass': 'bg-nc-surface-2 border border-nc-border',
    'nc-glass-elevated': 'bg-nc-surface-2 border border-nc-border shadow-nc-md',
    'nc-glass-dark': 'bg-nc-bg border border-nc-border-subtle',

    // Buttons (REDESIGN.md §5 component grammar; no glow in chrome)
    'nc-btn': 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-nc-md font-medium nc-anim cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
    'nc-btn-primary': 'nc-btn rounded-[2.4rem] bg-nc-ink text-nc-bg font-display font-bold hover:bg-nc-accent hover:translate-y-[-1px] active:scale-97',
    'nc-btn-secondary': 'nc-btn rounded-[2.4rem] bg-transparent text-nc-ink border border-nc-border hover:border-nc-ink-soft active:scale-97',
    'nc-btn-ghost': 'nc-btn text-nc-ink-muted hover:text-nc-ink hover:bg-nc-chip bg-transparent border-transparent',
    'nc-btn-icon': 'nc-btn p-2 aspect-square',

    // Cards — flat surface + hairline, radius ≤ 0.5rem
    'nc-card': 'bg-nc-surface-2 border border-nc-border rounded-nc-md p-4',
    'nc-card-elevated': 'bg-nc-surface-2 border border-nc-border rounded-nc-md p-4 shadow-nc-md',

    // Inputs — chip fill, hairline; focus = border-color only, no ring/glow
    'nc-input': 'w-full px-4 py-2 rounded-nc-md bg-nc-chip text-nc-ink placeholder-nc-ink-faint border border-nc-border focus:border-nc-accent focus:outline-none nc-anim',

    // Layout
    'nc-center': 'flex items-center justify-center',
    'nc-between': 'flex items-center justify-between',
    'nc-stack': 'flex flex-col gap-4',
    'nc-row': 'flex flex-row gap-4',

    // Text
    'nc-heading': 'font-bold text-nc-ink font-display tracking-[-0.015em]',
    'nc-body': 'text-nc-ink',
    'nc-muted': 'text-nc-ink-muted',
    'nc-label': 'font-mono text-xs uppercase tracking-[0.16em] text-nc-ink-soft'
  },

  safelist: [
    'i-lucide-plus',
    'i-lucide-minus',
    'i-lucide-x',
    'i-lucide-check',
    'i-lucide-sparkles',
    'i-lucide-brain',
    'i-lucide-map',
    'i-lucide-settings',
    'i-lucide-search',
    'i-lucide-menu',
    'i-lucide-chevron-down',
    'i-lucide-chevron-right',
    'i-lucide-chevron-left',
    'i-lucide-move',
    'i-lucide-hand',
    'i-lucide-mouse-pointer',
    'i-lucide-zoom-in',
    'i-lucide-zoom-out',
    'i-lucide-maximize',
    'i-lucide-undo',
    'i-lucide-redo',
    'i-lucide-share',
    'i-lucide-download',
    'i-lucide-upload',
    'i-lucide-arrow-left',
    'i-lucide-moon',
    'i-lucide-sun',
    'i-lucide-monitor',
    'i-lucide-loader-2',
    'i-lucide-feather',
    'i-lucide-type',
    'i-lucide-lightbulb',
    'i-lucide-star',
    'i-lucide-sticky-note',
    'i-lucide-check-circle',
    'i-lucide-clock',
    'i-lucide-help-circle',
    'i-lucide-alert-circle',
    'i-lucide-arrow-up-circle',
    'i-lucide-minus-circle',
    'i-lucide-arrow-down-circle',
    'i-lucide-link',
    'i-lucide-image',
    'i-lucide-file',
    'i-lucide-code',
    'i-lucide-edit-2',
    'i-lucide-copy',
    'i-lucide-clipboard',
    'i-lucide-palette',
    'i-lucide-trash-2',
    'i-lucide-layout-template',
    'i-lucide-square',
    'i-lucide-circle',
    'i-lucide-diamond',
    'i-lucide-save',
    'i-lucide-infinity',
    'i-lucide-keyboard',
    'i-lucide-users',
    'i-lucide-cloud-off',
    'i-lucide-globe',
    'i-lucide-laptop',
    'i-lucide-smartphone',
    'i-lucide-home',
    'i-lucide-map-pin',
    'i-lucide-flame',
    'i-lucide-arrow-right',
    'i-lucide-file-plus',
    'i-lucide-user',
    'i-lucide-external-link',
    'i-lucide-more-horizontal',
    'i-lucide-git-branch',
    'i-lucide-cpu',
    'i-lucide-bot',
    'i-lucide-key',
    'i-lucide-tag',
    'i-lucide-eye',
    'i-lucide-eye-off',
    'i-lucide-log-out',
    'i-lucide-mail',
    'i-lucide-shield-check',
    'i-lucide-lock',
    'i-lucide-database',
    'i-lucide-info',
    'i-lucide-sliders-horizontal',
    'i-lucide-wifi',
    'i-lucide-wifi-off',
    'i-lucide-refresh-cw'
  ]
})
