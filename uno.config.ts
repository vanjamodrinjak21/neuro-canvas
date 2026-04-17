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

  // Infinite Canvas Theme — Spatial, immersive, tool-forward
  theme: {
    colors: {
      // Canvas Environment — Minimal
      'nc-bg': '#0A0A0C',
      'nc-canvas': '#0A0A0C',
      'nc-surface': '#111114',
      'nc-surface-2': '#111114',
      'nc-surface-3': '#1A1A1E',
      'nc-surface-4': '#1C1C26',

      // Legacy mappings
      'nc-charcoal': '#0A0A0C',
      'nc-graphite': '#111114',
      'nc-pencil': '#1E1E22',

      // Borders
      'nc-border': '#1E1E22',
      'nc-border-subtle': '#1E1E22',
      'nc-border-active': '#2A2A30',

      // Text
      'nc-ink': '#FAFAFA',
      'nc-ink-soft': '#888890',
      'nc-ink-muted': '#555558',
      'nc-ink-faint': '#52525B',
      'nc-text': '#FAFAFA',
      'nc-text-secondary': '#888890',
      'nc-text-muted': '#555558',

      // Accent — Petronas Teal
      'nc-accent': '#00D2BE',
      'nc-accent-light': '#00FFE5',
      'nc-accent-dark': '#00A89A',
      'nc-teal': '#00D2BE',
      'nc-teal-light': '#00FFE5',
      'nc-teal-dark': '#00A89A',

      // Node Colors
      'nc-node-purple': '#A78BFA',
      'nc-node-pink': '#F472B6',
      'nc-node-blue': '#60A5FA',
      'nc-node-green': '#4ADE80',
      'nc-node-orange': '#FB923C',
      'nc-node-yellow': '#FACC15',

      // Status
      'nc-success': '#22C55E',
      'nc-warning': '#EAB308',
      'nc-error': '#EF4444',
      'nc-info': '#3B82F6',

      // Semantic
      'nc-primary': '#00D2BE',
      'nc-secondary': '#0C0C12',
      'nc-surface-elevated': '#111118',
      'nc-surface-hover': '#16161E'
    },

    fontFamily: {
      display: ['Cabinet Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      body: ['Cabinet Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      serif: ['Instrument Serif', 'Georgia', 'serif'],
      sans: ['Cabinet Grotesk', 'Inter', 'system-ui', 'sans-serif'],
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
      'nc-sm': '6px',
      'nc-md': '8px',
      'nc-lg': '12px',
      'nc-xl': '16px',
      'nc-2xl': '20px'
    },

    boxShadow: {
      'nc-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
      'nc-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
      'nc-lg': '0 8px 32px rgba(0, 0, 0, 0.5)',
      'nc-xl': '0 16px 48px rgba(0, 0, 0, 0.6)',
      'nc-glow': '0 0 32px rgba(0, 210, 190, 0.25)',
      'nc-glow-accent': '0 0 32px rgba(0, 210, 190, 0.25)'
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
        'nc-pulse-glow': '{0%, 100% { box-shadow: 0 0 0 0 rgba(0, 210, 190, 0.12) } 50% { box-shadow: 0 0 0 8px transparent }}',
        'nc-fade-in': '{from { opacity: 0 } to { opacity: 1 }}',
        'nc-slide-in': '{from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) }}',
        'nc-scale-in': '{from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) }}',
        'nc-node-appear': '{from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) }}'
      },
      durations: {
        'nc-press': '120ms',
        'nc-instant': '100ms',
        'nc-fast': '150ms',
        'nc-normal': '200ms',
        'nc-slow': '300ms',
        'nc-slower': '500ms',
        'nc-reveal': '700ms'
      },
      timingFns: {
        'nc-ease': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'nc-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'nc-ease-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'nc-ease-entrance': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'nc-ease-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'nc-ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'nc-ease-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)'
      }
    }
  },

  shortcuts: {
    // Glass panels
    'nc-glass': 'bg-[rgba(12,12,18,0.85)] backdrop-blur-24 border border-nc-border shadow-nc-lg',
    'nc-glass-elevated': 'bg-[rgba(12,12,18,0.95)] backdrop-blur-32 border border-nc-border shadow-nc-lg',
    'nc-glass-dark': 'bg-[rgba(5,5,8,0.95)] backdrop-blur-24 border border-nc-border-subtle shadow-nc-xl',

    // Buttons
    'nc-btn': 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-nc-md font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    'nc-btn-primary': 'nc-btn bg-nc-accent text-nc-bg hover:bg-nc-accent-dark hover:shadow-nc-glow active:scale-98',
    'nc-btn-secondary': 'nc-btn nc-glass text-nc-ink hover:border-nc-border-active hover:shadow-nc-glow',
    'nc-btn-ghost': 'nc-btn text-nc-ink-muted hover:text-nc-ink hover:bg-nc-surface-2 bg-transparent border-transparent',
    'nc-btn-icon': 'nc-btn p-2 aspect-square',

    // Cards
    'nc-card': 'nc-glass rounded-nc-xl p-4 shadow-nc-md',
    'nc-card-elevated': 'nc-glass-elevated rounded-nc-xl p-4 shadow-nc-lg',

    // Inputs
    'nc-input': 'w-full px-4 py-2 rounded-nc-md bg-nc-surface-2 text-nc-ink placeholder-nc-ink-faint border border-nc-border focus:border-nc-accent focus:ring-2 focus:ring-[rgba(0,210,190,0.2)] transition-all duration-200',

    // Layout
    'nc-center': 'flex items-center justify-center',
    'nc-between': 'flex items-center justify-between',
    'nc-stack': 'flex flex-col gap-4',
    'nc-row': 'flex flex-row gap-4',

    // Text
    'nc-heading': 'font-semibold text-nc-ink font-display',
    'nc-body': 'text-nc-ink',
    'nc-muted': 'text-nc-ink-muted',
    'nc-label': 'text-xs font-semibold uppercase tracking-wide text-nc-ink-faint'
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
