<script setup lang="ts">
definePageMeta({ layout: false })

const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const { status } = _isTauri ? { status: ref('authenticated') } : useAuth()
const isAuthenticated = computed(() => _isTauri || status.value === 'authenticated')

const isScrolled = ref(false)

onMounted(() => {
  const handleScroll = () => { isScrolled.value = window.scrollY > 50 }
  window.addEventListener('scroll', handleScroll, { passive: true })

  // Scroll reveals
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const items = entry.target.querySelectorAll('.s')
          items.forEach((el, i) => {
            ;(el as HTMLElement).style.transitionDelay = `${i * 120}ms`
          })
          entry.target.classList.add('in')
        }
      })
    },
    { threshold: 0.1, rootMargin: '-40px' }
  )
  document.querySelectorAll('.r').forEach((el) => observer.observe(el))

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    observer.disconnect()
  })
})

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="lp">
    <!-- ══════ NAV ══════ -->
    <nav :class="{ scrolled: isScrolled }">
      <NuxtLink to="/" class="logo">
        <NcLogo :size="16" :container-size="32" :radius="8" />
        <span class="logo-name">NeuroCanvas</span>
      </NuxtLink>
      <div class="nav-center">
        <a href="#features" @click.prevent="scrollTo('features')">Features</a>
        <a href="#">Download</a>
        <NuxtLink to="/docs">Docs</NuxtLink>
        <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
      </div>
      <div class="nav-end">
        <template v-if="isAuthenticated">
          <NuxtLink to="/dashboard" class="nav-link">Dashboard</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink to="/auth/signin" class="nav-link">Sign in</NuxtLink>
        </template>
        <NuxtLink
          :to="isAuthenticated ? '/dashboard' : '/auth/signup'"
          class="btn-primary"
        >
          Get Started
        </NuxtLink>
      </div>
    </nav>

    <!-- ══════ HERO ══════ -->
    <section class="hero r">
      <div class="hero-badge s">
        <span>Web · Desktop · Mobile</span>
      </div>
      <div class="hero-headlines s">
        <h1 class="hero-h1">Think visually.</h1>
        <h1 class="hero-serif">Learn infinitely.</h1>
      </div>
      <p class="hero-sub s">
        AI-powered mind mapping that understands your ideas,<br />
        suggests connections, and helps you learn faster.
      </p>
      <div class="hero-cta s">
        <NuxtLink
          :to="isAuthenticated ? '/dashboard' : '/auth/signup'"
          class="btn-primary btn-lg"
        >
          Start mapping — free forever
        </NuxtLink>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          class="btn-outline btn-lg"
        >
          <svg class="gh-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          <span>View on GitHub</span>
        </a>
      </div>
    </section>

    <!-- ══════ PRODUCT SCREENSHOT ══════ -->
    <section class="screenshot-section r">
      <div class="screenshot-frame s">
        <!-- Window chrome -->
        <div class="win-bar">
          <div class="win-dots">
            <i class="dot-r" /><i class="dot-y" /><i class="dot-g" />
          </div>
          <span class="win-title">Cognitive Psychology — NeuroCanvas</span>
          <div class="win-spacer" />
        </div>
        <!-- Canvas body -->
        <div class="win-body">
          <!-- Explorer sidebar -->
          <div class="mock-sidebar">
            <span class="mock-label">EXPLORER</span>
            <div class="mock-node mock-active">
              <span class="mock-dot" style="background:#00D2BE" />
              <span>Cognitive</span>
            </div>
            <div class="mock-node">
              <span class="mock-dot" style="background:#A78BFA" />
              <span>Perception</span>
            </div>
            <div class="mock-node">
              <span class="mock-dot" style="background:#60A5FA" />
              <span>Attention</span>
            </div>
            <div class="mock-node">
              <span class="mock-dot" style="background:#FB923C" />
              <span>Learning</span>
            </div>
            <div class="mock-node">
              <span class="mock-dot" style="background:#4ADE80" />
              <span>Memory</span>
            </div>
            <div class="mock-spacer" />
            <span class="mock-label">AI SUGGESTIONS</span>
            <div class="mock-sug">
              <span class="mock-sug-letter">E</span>
              <span>Executive Function</span>
            </div>
            <div class="mock-sug">
              <span class="mock-sug-letter mock-sug-d">D</span>
              <span>Decision Making</span>
            </div>
          </div>

          <!-- SVG Canvas -->
          <div class="mock-canvas">
            <svg class="mock-edges" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
              <!-- Dot grid -->
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="0.8" fill="var(--dot-color)" />
              </pattern>
              <rect width="800" height="500" fill="url(#dots)" />

              <!-- Edges from Cognitive center -->
              <g class="edge-group">
                <line x1="352" y1="230" x2="304" y2="170" class="edge" />
                <line x1="352" y1="230" x2="400" y2="155" class="edge" />
                <line x1="352" y1="230" x2="240" y2="140" class="edge" />
                <line x1="352" y1="230" x2="296" y2="275" class="edge" />
                <line x1="352" y1="230" x2="448" y2="265" class="edge" />
                <line x1="352" y1="230" x2="320" y2="335" class="edge" />
                <line x1="352" y1="230" x2="256" y2="375" class="edge" />
                <!-- Tier 2 -->
                <line x1="240" y1="140" x2="368" y2="90" class="edge edge-sub" />
                <line x1="400" y1="155" x2="480" y2="115" class="edge edge-sub" />
                <line x1="448" y1="265" x2="504" y2="220" class="edge edge-sub" />
                <line x1="448" y1="265" x2="568" y2="185" class="edge edge-sub" />
                <line x1="448" y1="265" x2="592" y2="270" class="edge edge-sub" />
                <line x1="448" y1="265" x2="512" y2="315" class="edge edge-sub" />
                <line x1="448" y1="265" x2="464" y2="350" class="edge edge-sub" />
                <line x1="448" y1="265" x2="576" y2="365" class="edge edge-sub" />
              </g>
            </svg>

            <!-- Nodes positioned absolutely -->
            <div class="nd nd-root" style="left:44%;top:46%">Cognitive</div>
            <!-- Tier 1 -->
            <div class="nd nd-t1" style="left:38%;top:34%;background:#5B4FA0">Perception</div>
            <div class="nd nd-t1" style="left:50%;top:31%;background:#3A7B9E">Learning</div>
            <div class="nd nd-t1" style="left:30%;top:28%;background:#2B8B6E">Sensory</div>
            <div class="nd nd-t1" style="left:37%;top:55%;background:#3D6FA5">Attention</div>
            <div class="nd nd-t1" style="left:56%;top:53%;background:#3D8B5E">Memory</div>
            <div class="nd nd-t1" style="left:40%;top:67%;background:#A0547A">Language</div>
            <div class="nd nd-t1" style="left:32%;top:75%;background:#3D8B6E">Syntax</div>
            <!-- Tier 2 -->
            <div class="nd nd-t2" style="left:46%;top:18%;background:#2B6B5E">Classical</div>
            <div class="nd nd-t2" style="left:60%;top:23%;background:#3A7B5E">Visual</div>
            <div class="nd nd-t2" style="left:63%;top:44%;background:#2B6B4E">Short-term</div>
            <div class="nd nd-t2" style="left:71%;top:37%;background:#6B4FA0">Procedural</div>
            <div class="nd nd-t2" style="left:74%;top:54%;background:#6B5B3A">Divided</div>
            <div class="nd nd-t2" style="left:64%;top:63%;background:#8B6B3A">Long-term</div>
            <div class="nd nd-t2" style="left:58%;top:70%;background:#5B6B4A">Selective</div>
            <div class="nd nd-t2" style="left:72%;top:73%;background:#6B5B3A">Episodic</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════ STATS ══════ -->
    <section class="stats r">
      <div class="stat s">
        <span class="stat-num">100%</span>
        <span class="stat-label">Free, forever</span>
      </div>
      <div class="stat-divider" />
      <div class="stat s">
        <span class="stat-num">85k+</span>
        <span class="stat-label">Maps created</span>
      </div>
      <div class="stat-divider" />
      <div class="stat s">
        <span class="stat-num">3</span>
        <span class="stat-label">Platforms supported</span>
      </div>
      <div class="stat-divider" />
      <div class="stat s">
        <span class="stat-num">23</span>
        <span class="stat-label">Relationship types</span>
      </div>
    </section>

    <!-- ══════ FEATURES ══════ -->
    <section id="features" class="features">
      <div class="features-head r">
        <span class="label-teal s">Features</span>
        <h2 class="features-title s">
          Everything you need to<br />organize knowledge
        </h2>
      </div>

      <div class="feature-grid r">
        <!-- Row 1 -->
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-sparkles" />
          </div>
          <h3>AI-Powered Expansion</h3>
          <p>
            Select any node and let AI suggest related concepts, definitions, and connections. Supports OpenAI, Claude, and local models.
          </p>
        </div>
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-maximize" />
          </div>
          <h3>Infinite Canvas</h3>
          <p>
            Pan, zoom, and navigate freely. Force-directed layouts keep your maps organized. Minimap for orientation in large maps.
          </p>
        </div>
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-monitor" />
          </div>
          <h3>Web, Desktop, Mobile</h3>
          <p>
            Use the web app anywhere, install the desktop app via Tauri, or take it on the go with iOS and Android via Capacitor.
          </p>
        </div>
      </div>

      <div class="feature-grid r">
        <!-- Row 2 -->
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-refresh-cw" />
          </div>
          <h3>Real-time Sync</h3>
          <p>
            Conflict-free sync powered by Yjs. Your maps stay consistent across all devices, even offline. Auto-save included.
          </p>
        </div>
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-cpu" />
          </div>
          <h3>Semantic Engine</h3>
          <p>
            Embedding-based similarity search discovers hidden connections. Semantic clustering reveals patterns in your thinking.
          </p>
        </div>
        <div class="feature-card s">
          <div class="feature-icon">
            <i class="i-lucide-download" />
          </div>
          <h3>Export Anywhere</h3>
          <p>
            Export as PNG for presentations, JSON for data portability, or Markdown for clean hierarchical outlines.
          </p>
        </div>
      </div>
    </section>

    <!-- ══════ FINAL CTA ══════ -->
    <section class="cta r">
      <h2 class="cta-heading s">Ready to think differently?</h2>
      <p class="cta-sub s">
        Free, open-source, and built for students. Available on<br />
        every platform you use.
      </p>
      <div class="cta-buttons s">
        <NuxtLink
          :to="isAuthenticated ? '/dashboard' : '/auth/signup'"
          class="btn-primary btn-lg"
        >
          Download for free
        </NuxtLink>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          class="btn-outline btn-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          <span>View on GitHub</span>
        </a>
      </div>
    </section>

    <!-- ══════ FOOTER ══════ -->
    <footer>
      <div class="footer-inner">
        <div class="footer-logo">
          <NcLogo :size="12" :container-size="24" :radius="6" />
          <span class="footer-brand">NeuroCanvas</span>
        </div>
        <div class="footer-nav">
          <a href="#features" @click.prevent="scrollTo('features')">Features</a>
          <a href="#">Download</a>
          <NuxtLink to="/docs">Docs</NuxtLink>
          <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
          <NuxtLink to="/privacy">Privacy</NuxtLink>
          <NuxtLink to="/terms">Terms</NuxtLink>
        </div>
        <span class="footer-credit">Built by Vanja Modrinjak</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   NEUROCANVAS — Landing Page
   Matches Paper design: editorial, Swiss typography, teal accent
   ═══════════════════════════════════════════════════════ */

.lp {
  --bg: #09090B;
  --surface: #0A0A0C;
  --surface-el: #111114;
  --border: #1E1E22;
  --border-subtle: #161619;
  --text: #FAFAFA;
  --text-2: #888890;
  --text-3: #666670;
  --text-muted: #52525B;
  --accent: #00D2BE;
  --accent-dark: #00A89A;
  --accent-bg: rgba(0, 210, 190, 0.08);
  --accent-border: rgba(0, 210, 190, 0.15);
  --dot-color: rgba(255, 255, 255, 0.05);

  --sans: 'Inter', system-ui, -apple-system, sans-serif;
  --serif: 'Instrument Serif', Georgia, serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);

  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ── Light theme ── */
:root.light .lp {
  --bg: #FAFAF9;
  --surface: #F5F5F3;
  --surface-el: #FFFFFF;
  --border: #E8E8E6;
  --border-subtle: #F0F0F2;
  --text: #111111;
  --text-2: #52525B;
  --text-3: #71717A;
  --text-muted: #777777;
  --accent: #00D2BE;
  --accent-dark: #00A89A;
  --accent-bg: rgba(0, 210, 190, 0.06);
  --accent-border: rgba(0, 210, 190, 0.12);
  --dot-color: rgba(0, 0, 0, 0.06);
}

/* ── Reveal system ── */
.r {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.8s var(--ease), transform 0.8s var(--ease);
}

.r.in {
  opacity: 1;
  transform: translateY(0);
}

.s {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
}

.s.in,
.in > .s,
.hero.in .s {
  opacity: 1;
  transform: translateY(0);
}

.hero .s:nth-child(1) { transition-delay: 0ms; }
.hero .s:nth-child(2) { transition-delay: 100ms; }
.hero .s:nth-child(3) { transition-delay: 200ms; }
.hero .s:nth-child(4) { transition-delay: 300ms; }

/* ═══════════════════════
   NAV
   ═══════════════════════ */
nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 80px;
  transition: all 0.3s ease;
}

nav.scrolled {
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  border-bottom: 1px solid var(--border);
  padding: 14px 80px;
}

:root.light nav.scrolled {
  background: rgba(250, 250, 249, 0.9);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

.logo-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.nav-center {
  display: flex;
  gap: 32px;
}

.nav-center a {
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 400;
  transition: color 0.15s ease;
  position: relative;
}

.nav-center a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 0;
  height: 1.5px;
  background: var(--accent);
  transition: width 200ms var(--nc-ease), transform 200ms var(--nc-ease);
  transform: translateX(-50%);
}

.nav-center a:hover {
  color: var(--text);
}

.nav-center a:hover::after {
  width: 100%;
}

.nav-end {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 400;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--text);
}

/* ═══════════════════════
   BUTTONS
   ═══════════════════════ */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent);
  color: #09090B;
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--accent-dark);
}

.btn-primary:active {
  transform: scale(0.97);
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  background: transparent;
  color: var(--text-2);
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-outline:hover {
  border-color: var(--text-3);
  color: var(--text);
}

.btn-outline:active {
  transform: scale(0.97);
}

.btn-lg {
  padding: 14px 32px;
  font-size: 15px;
  border-radius: 6px;
}

/* ═══════════════════════
   HERO
   ═══════════════════════ */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160px 120px 80px;
  gap: 48px;
}

.hero-badge {
  display: flex;
}

.hero-badge span {
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.hero-headlines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.hero-h1 {
  font-family: var(--sans);
  font-size: clamp(64px, 10vw, 144px);
  font-weight: 900;
  line-height: 0.97;
  letter-spacing: -0.04em;
  text-align: center;
  margin: 0;
}

.hero-serif {
  font-family: var(--serif);
  font-size: clamp(64px, 10vw, 144px);
  font-weight: 400;
  font-style: italic;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--accent);
  text-align: center;
  margin: 0;
}

:root.light .hero-serif {
  color: var(--text);
}

:root.light .cta-heading {
  color: var(--text);
}

.hero-sub {
  font-size: 18px;
  font-weight: 400;
  line-height: 28px;
  color: var(--text-3);
  text-align: center;
  max-width: 480px;
  margin: 0;
}

.hero-cta {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ═══════════════════════
   PRODUCT SCREENSHOT
   ═══════════════════════ */
.screenshot-section {
  display: flex;
  justify-content: center;
  padding: 0 80px 0;
}

.screenshot-frame {
  width: 100%;
  max-width: 1280px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4);
}

:root.light .screenshot-frame {
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.08);
}

.win-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 8px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.win-dots {
  display: flex;
  gap: 6px;
}

.win-dots i {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-r { background: #FF5F57; }
.dot-y { background: #FFBD2E; }
.dot-g { background: #28C840; }

.win-title {
  flex: 1;
  text-align: center;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.win-spacer {
  width: 44px;
}

.win-body {
  display: flex;
  height: 520px;
  background: var(--surface-el);
}

/* Mock sidebar */
.mock-sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 20px 16px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface);
}

.mock-label {
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0 8px;
  margin-bottom: 8px;
}

.mock-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-2);
}

.mock-active {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 500;
}

.mock-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mock-spacer {
  height: 24px;
}

.mock-sug {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-2);
}

.mock-sug-letter {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(96, 165, 250, 0.12);
  color: #60A5FA;
}

.mock-sug-d {
  background: rgba(251, 146, 60, 0.12);
  color: #FB923C;
}

/* Mock canvas */
.mock-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.mock-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.edge {
  stroke: var(--border);
  stroke-width: 1;
  stroke-linecap: round;
}

.edge-sub {
  stroke-width: 0.8;
  opacity: 0.6;
}

.nd {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
}

.nd-root {
  background: var(--accent);
  color: #09090B;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 20px;
  border-radius: 8px;
  z-index: 2;
}

.nd-t1 {
  color: #FAFAFA;
  border: none;
}

.nd-t2 {
  color: rgba(255, 255, 255, 0.7);
  border: none;
  font-size: 11px;
  padding: 4px 10px;
}

/* ═══════════════════════
   STATS
   ═══════════════════════ */
.stats {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100px 80px 120px;
  gap: 80px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stat-num {
  font-family: var(--sans);
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 48px;
}

.stat-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
}

.stat-divider {
  width: 1px;
  height: 48px;
  background: var(--border);
  flex-shrink: 0;
}

/* ═══════════════════════
   FEATURES
   ═══════════════════════ */
.features {
  padding: 0 80px 120px;
}

.features-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-bottom: 80px;
}

.label-teal {
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.features-title {
  font-family: var(--sans);
  font-size: 48px;
  font-weight: 800;
  line-height: 56px;
  letter-spacing: -0.03em;
  text-align: center;
  margin: 0;
}

.feature-grid {
  display: flex;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto 20px;
}

.feature-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 32px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.feature-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  margin-bottom: 24px;
  color: var(--accent);
  font-size: 20px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 10px;
}

.feature-card p {
  font-size: 15px;
  line-height: 24px;
  color: var(--text-2);
  margin: 0;
}

/* ═══════════════════════
   CTA
   ═══════════════════════ */
.cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 80px 120px;
}

.cta-heading {
  font-family: var(--serif);
  font-size: 56px;
  font-weight: 400;
  font-style: italic;
  line-height: 64px;
  letter-spacing: -0.02em;
  text-align: center;
  color: var(--accent);
  margin: 0 0 16px;
}

.cta-sub {
  font-size: 18px;
  line-height: 28px;
  color: var(--text-2);
  text-align: center;
  margin: 0 0 40px;
}

.cta-buttons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cta-buttons .btn-lg {
  padding: 16px 40px;
  border-radius: 8px;
}

/* ═══════════════════════
   FOOTER
   ═══════════════════════ */
footer {
  border-top: 1px solid var(--border);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40px 80px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-brand {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.footer-nav {
  display: flex;
  gap: 28px;
}

.footer-nav a {
  font-size: 13px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-nav a:hover {
  color: var(--text);
}

.footer-credit {
  font-size: 13px;
  color: var(--text-muted);
}

/* ═══════════════════════
   RESPONSIVE
   ═══════════════════════ */

/* Laptop breakpoint */
@media (max-width: 1366px) {
  nav { padding: 20px 48px; }
  nav.scrolled { padding: 14px 48px; }

  .hero { padding: 140px 48px 60px; gap: 40px; }
  .hero-sub { font-size: 16px; line-height: 26px; }

  .screenshot-section { padding: 0 48px; }
  .screenshot-frame { max-width: 1100px; }
  .win-body { height: 440px; }

  .stats { padding: 80px 48px 100px; gap: 60px; }
  .stat-num { font-size: 36px; line-height: 44px; }

  .features { padding: 0 48px 100px; }
  .features-head { padding-bottom: 64px; }
  .features-title { font-size: 40px; line-height: 48px; }
  .feature-grid { gap: 16px; }
  .feature-card { padding: 32px 24px; }
  .feature-card h3 { font-size: 17px; }
  .feature-card p { font-size: 14px; line-height: 22px; }

  .cta { padding: 0 48px 100px; }
  .cta-heading { font-size: 48px; line-height: 56px; }
  .cta-sub { font-size: 16px; line-height: 26px; }

  .footer-inner { padding: 36px 48px; }
}

@media (max-width: 1024px) {
  nav { padding: 16px 32px; }
  nav.scrolled { padding: 12px 32px; }
  .hero { padding: 140px 32px 60px; }
  .screenshot-section { padding: 0 32px; }
  .stats { padding: 60px 32px 80px; gap: 40px; }
  .features { padding: 0 32px 80px; }
  .features-head { padding-bottom: 48px; }
  .features-title { font-size: 36px; line-height: 44px; }
  .cta { padding: 0 32px 80px; }
  .cta-heading { font-size: 40px; line-height: 48px; }
  .footer-inner { padding: 32px; }
}

@media (max-width: 768px) {
  .nav-center { display: none; }
  .nav-link { display: none; }
  nav { padding: 14px 24px; }
  nav.scrolled { padding: 14px 24px; }

  .hero { padding: 120px 24px 40px; gap: 24px; }
  .hero-h1 { font-size: 44px; line-height: 48px; }
  .hero-serif { font-size: 46px; line-height: 52px; }
  .hero-sub { font-size: 15px; line-height: 22px; color: var(--text-2); }
  .hero-cta { flex-direction: column; width: 100%; gap: 10px; }
  .hero-cta .btn-primary,
  .hero-cta .btn-outline {
    width: 100%;
    height: 48px;
    text-align: center;
    font-size: 15px;
    border-radius: 8px;
  }
  .hero-cta .btn-primary { font-weight: 700; }
  .hero-cta .btn-outline { font-weight: 600; }

  /* Hide screenshot on mobile — Paper design omits it */
  .screenshot-section { display: none; }

  /* Stats: 2x2 grid with top/bottom borders */
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    padding: 40px 24px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .stat-divider { display: none; }
  .stat {
    min-width: calc(50% - 12px);
    flex: 1 1 calc(50% - 12px);
  }
  .stat-num { font-size: 36px; line-height: 44px; letter-spacing: -0.03em; }
  .stat-label { font-size: 13px; color: var(--text-2); }

  /* Features */
  .features { padding: 0 24px 0; }
  .features-head { padding-top: 56px; padding-bottom: 32px; gap: 12px; }
  .label-teal { font-size: 12px; letter-spacing: 0.08em; font-weight: 700; }
  .features-title { font-size: 28px; line-height: 34px; }
  .feature-grid { flex-direction: column; gap: 12px; margin-bottom: 12px; }
  .feature-card {
    padding: 20px;
    background: var(--surface-el);
    border-radius: 10px;
  }
  .feature-icon { margin-bottom: 12px; width: 36px; height: 36px; border-radius: 8px; font-size: 18px; }
  .feature-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .feature-card p { font-size: 13px; line-height: 19px; }

  /* CTA */
  .cta { padding: 64px 24px; }
  .cta-heading { font-size: 32px; line-height: 40px; margin-bottom: 12px; }
  .cta-sub { font-size: 14px; line-height: 22px; margin-bottom: 24px; }
  .cta-buttons { flex-direction: column; width: 100%; gap: 10px; }
  .cta-buttons .btn-primary,
  .cta-buttons .btn-outline {
    width: 100%;
    height: 48px;
    text-align: center;
    font-size: 15px;
    border-radius: 8px;
    padding: 0 24px;
  }
  .cta-buttons .btn-primary { font-weight: 700; }
  .cta-buttons .btn-outline { font-weight: 600; }

  /* Footer */
  .footer-inner {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    padding: 24px;
  }
  .footer-nav { flex-wrap: wrap; justify-content: center; gap: 16px; }
  .footer-nav a { font-size: 13px; }
  .footer-credit { font-size: 12px; color: var(--text-muted); }

  /* Hide forced line breaks on mobile — let text flow naturally */
  .hero-sub br,
  .features-title br,
  .cta-sub br { display: none; }
}
</style>
