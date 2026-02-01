<script setup lang="ts">
// Landing Page - Bold & Refined
definePageMeta({
  layout: false
})

// Auth state
const { status } = useAuth()
const isAuthenticated = computed(() => status.value === 'authenticated')

// Cursor glow position
const cursorPosition = ref({ x: 0, y: 0 })
const glowPosition = ref({ x: 0, y: 0 })

// Nav scroll state
const isScrolled = ref(false)

// Intersection observer for reveal animations
const revealElements = ref<Set<Element>>(new Set())

onMounted(() => {
  // Cursor glow animation
  let animationId: number
  const animateCursor = () => {
    glowPosition.value.x += (cursorPosition.value.x - glowPosition.value.x) * 0.1
    glowPosition.value.y += (cursorPosition.value.y - glowPosition.value.y) * 0.1
    animationId = requestAnimationFrame(animateCursor)
  }
  animateCursor()

  // Mouse move handler
  const handleMouseMove = (e: MouseEvent) => {
    cursorPosition.value = { x: e.clientX, y: e.clientY }
  }
  document.addEventListener('mousemove', handleMouseMove)

  // Scroll handler for nav
  const handleScroll = () => {
    isScrolled.value = window.scrollY > 50
  }
  window.addEventListener('scroll', handleScroll)

  // Intersection observer for reveal animations
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    },
    { threshold: 0.1, rootMargin: '-50px' }
  )

  // Observe all reveal elements
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    document.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('scroll', handleScroll)
    observer.disconnect()
  })
})

// Magnetic button effect
function handleButtonMouseMove(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  btn.style.transform = `translateY(-3px) translate(${x * 0.1}px, ${y * 0.1}px)`
}

function handleButtonMouseLeave(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  btn.style.transform = ''
}

// Smooth scroll to section
function scrollToSection(id: string) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="landing-page">
    <!-- Cursor Glow -->
    <div
      class="cursor-glow"
      :style="{ left: `${glowPosition.x}px`, top: `${glowPosition.y}px` }"
    />

    <!-- Ambient Glow Orbs -->
    <div class="glow-orb glow-orb-1" />
    <div class="glow-orb glow-orb-2" />
    <div class="glow-orb glow-orb-3" />

    <!-- Navigation -->
    <nav :class="{ scrolled: isScrolled }">
      <NuxtLink to="/" class="logo">
        <div class="logo-mark" />
        <span class="logo-text">NeuroCanvas</span>
      </NuxtLink>

      <div class="nav-links">
        <a href="#features" @click.prevent="scrollToSection('features')">Features</a>
        <a href="#ai" @click.prevent="scrollToSection('ai')">AI</a>
        <a href="#platforms" @click.prevent="scrollToSection('platforms')">Platforms</a>
        <a href="#">Pricing</a>
      </div>

      <div class="nav-right">
        <template v-if="isAuthenticated">
          <NuxtLink to="/dashboard" class="btn btn-ghost">Dashboard</NuxtLink>
          <UserMenu />
        </template>
        <template v-else>
          <NuxtLink to="/auth/signin" class="btn btn-ghost">Sign In</NuxtLink>
          <NuxtLink to="/auth/signup" class="btn btn-primary">Get Started</NuxtLink>
        </template>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-text">
          <div class="hero-badge">Now in Public Beta</div>
          <h1>
            <span class="line">Think <span class="highlight">visually</span>.</span>
            <span class="line">Learn smarter.</span>
          </h1>
          <p class="hero-description">
            The AI-powered mind mapping tool designed for students who think
            different. Create, connect, and discover ideas like never before.
          </p>
          <div class="hero-cta">
            <NuxtLink
              :to="isAuthenticated ? '/dashboard' : '/auth/signup'"
              class="btn btn-primary btn-large"
              @mousemove="handleButtonMouseMove"
              @mouseleave="handleButtonMouseLeave"
            >
              {{ isAuthenticated ? 'Go to Dashboard' : 'Start for free' }} &rarr;
            </NuxtLink>
            <a href="#" class="btn btn-secondary btn-large">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path d="M8 5v10l7-5-7-5z" />
              </svg>
              Watch demo
            </a>
          </div>
        </div>

        <div class="hero-visual">
          <div class="preview-container">
            <div class="preview-window">
              <div class="preview-toolbar">
                <div class="toolbar-dots">
                  <div class="toolbar-dot" />
                  <div class="toolbar-dot" />
                  <div class="toolbar-dot" />
                </div>
                <span class="toolbar-title">Biology 101 — Mind Map</span>
                <div class="toolbar-actions">
                  <div class="toolbar-btn">+</div>
                  <div class="toolbar-btn">...</div>
                </div>
              </div>
              <div class="preview-canvas">
                <div class="map-container">
                  <svg class="connections" viewBox="0 0 500 360">
                    <line x1="250" y1="180" x2="60" y2="60" />
                    <line x1="250" y1="180" x2="160" y2="30" />
                    <line x1="250" y1="180" x2="340" y2="30" />
                    <line x1="250" y1="180" x2="450" y2="70" />
                    <line x1="250" y1="180" x2="470" y2="200" class="glow" />
                    <line x1="250" y1="180" x2="410" y2="320" />
                    <line x1="250" y1="180" x2="100" y2="320" />
                    <line x1="250" y1="180" x2="30" y2="180" />
                  </svg>
                  <div class="node central">Biology</div>
                  <div class="node n1 floating-node" style="--float-duration: 4s; --float-delay: 0s">Ecology</div>
                  <div class="node n2 floating-node" style="--float-duration: 5s; --float-delay: 0.5s">Genetics</div>
                  <div class="node n3 floating-node" style="--float-duration: 4.5s; --float-delay: 1s">Evolution</div>
                  <div class="node n4">Anatomy</div>
                  <div class="node n5 ai">Microbiology</div>
                  <div class="node n6 floating-node" style="--float-duration: 5.5s; --float-delay: 0.3s">Cell Theory</div>
                  <div class="node n7">Botany</div>
                  <div class="node n8 floating-node" style="--float-duration: 4s; --float-delay: 0.7s">Zoology</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Metrics -->
    <section class="metrics reveal">
      <div class="metrics-inner">
        <div class="metric">
          <div class="metric-value">50K<span class="accent">+</span></div>
          <div class="metric-label">Active Students</div>
        </div>
        <div class="metric">
          <div class="metric-value">2M<span class="accent">+</span></div>
          <div class="metric-label">Mind Maps Created</div>
        </div>
        <div class="metric">
          <div class="metric-value">150<span class="accent">+</span></div>
          <div class="metric-label">Universities</div>
        </div>
        <div class="metric">
          <div class="metric-value">4.9<span class="accent">*</span></div>
          <div class="metric-label">App Store Rating</div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="features reveal">
      <div class="section-header">
        <span class="section-tag">Features</span>
        <h2 class="section-title">Everything you need to map your thoughts</h2>
        <p class="section-description">
          Powerful features that stay out of your way, letting you focus on what
          matters — your ideas.
        </p>
      </div>

      <div class="features-grid">
        <div class="feature-card span-8 has-visual">
          <div>
            <div class="feature-icon">
              <span class="i-lucide-infinity text-nc-teal" />
            </div>
            <h3>Infinite Canvas</h3>
            <p>
              Unlimited space for unlimited ideas. Pan, zoom, and explore without
              boundaries. Your canvas grows with your thinking.
            </p>
          </div>
          <div class="feature-visual">
            <span style="opacity: 0.5">Canvas Preview</span>
          </div>
        </div>

        <div class="feature-card span-4">
          <div class="feature-icon">
            <span class="i-lucide-keyboard text-nc-teal" />
          </div>
          <h3>Keyboard First</h3>
          <p>
            Full keyboard navigation. Create, connect, and navigate without ever
            touching your mouse.
          </p>
        </div>

        <div class="feature-card span-4">
          <div class="feature-icon">
            <span class="i-lucide-users text-nc-teal" />
          </div>
          <h3>Real-time Collab</h3>
          <p>
            Work together with your study group. See changes instantly, no refresh
            needed.
          </p>
        </div>

        <div class="feature-card span-4">
          <div class="feature-icon">
            <span class="i-lucide-upload text-nc-teal" />
          </div>
          <h3>Export Anywhere</h3>
          <p>PDF, PNG, Markdown, or JSON. Your maps, your format, your choice.</p>
        </div>

        <div class="feature-card span-4">
          <div class="feature-icon">
            <span class="i-lucide-cloud-off text-nc-teal" />
          </div>
          <h3>Works Offline</h3>
          <p>
            No internet? No problem. Full functionality offline with automatic
            sync.
          </p>
        </div>
      </div>
    </section>

    <!-- AI Section -->
    <section id="ai" class="ai-section reveal">
      <div class="ai-inner">
        <div class="ai-header">
          <span class="section-tag">AI-Powered</span>
          <h2 class="section-title">
            Intelligence that <span class="gradient">amplifies</span> your thinking
          </h2>
          <p class="section-description" style="margin: 1.5rem auto 0; max-width: 600px; text-align: center">
            Not just another chatbot. Our AI understands your learning context and
            enhances your natural thought process.
          </p>
        </div>

        <div class="ai-features">
          <div class="ai-feature">
            <div class="ai-feature-content">
              <span class="ai-feature-number">01</span>
              <h3>Smart Expand</h3>
              <p>
                Select any node and let AI suggest related concepts you might have
                missed. Build comprehensive mind maps effortlessly.
              </p>
              <ul class="ai-feature-list">
                <li>Context-aware suggestions</li>
                <li>One-click to add</li>
                <li>Learns your style over time</li>
              </ul>
            </div>
            <div class="ai-feature-visual">
              <div class="ai-demo">
                <div class="ai-demo-nodes">
                  <div class="ai-demo-node center">Main Topic</div>
                  <div class="ai-demo-node suggestion">Related A</div>
                  <div class="ai-demo-node suggestion">Related B</div>
                  <div class="ai-demo-node suggestion">Related C</div>
                </div>
              </div>
            </div>
          </div>

          <div class="ai-feature reverse">
            <div class="ai-feature-content">
              <span class="ai-feature-number">02</span>
              <h3>Auto-Connect</h3>
              <p>
                AI finds hidden relationships between your ideas. Discover
                connections you never knew existed across your entire map.
              </p>
              <ul class="ai-feature-list">
                <li>Semantic matching</li>
                <li>Visual suggestions</li>
                <li>Accept or dismiss instantly</li>
              </ul>
            </div>
            <div class="ai-feature-visual">
              <div class="ai-demo">
                <div class="ai-demo-nodes">
                  <div class="ai-demo-node" style="left: 15%; top: 30%">Concept A</div>
                  <div class="ai-demo-node" style="right: 15%; top: 30%">Concept B</div>
                  <div class="ai-demo-node" style="left: 50%; top: 70%; transform: translateX(-50%)">Concept C</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Platforms -->
    <section id="platforms" class="platforms reveal">
      <span class="section-tag">Platforms</span>
      <h2 class="section-title" style="max-width: 100%; margin-bottom: 0.5rem">
        Use anywhere, sync everywhere
      </h2>
      <p class="section-description" style="margin: 0 auto">
        Your mind maps follow you across all your devices.
      </p>

      <div class="platforms-grid">
        <div class="platform-card">
          <span class="icon">
            <span class="i-lucide-globe text-4xl" />
          </span>
          <h4>Web</h4>
          <p>Works in any modern browser. No installation required.</p>
        </div>
        <div class="platform-card">
          <span class="icon">
            <span class="i-lucide-laptop text-4xl" />
          </span>
          <h4>Desktop</h4>
          <p>Native apps for macOS, Windows, and Linux.</p>
        </div>
        <div class="platform-card">
          <span class="icon">
            <span class="i-lucide-smartphone text-4xl" />
          </span>
          <h4>Mobile</h4>
          <p>iOS and Android apps for thinking on the go.</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta reveal">
      <h2>Ready to think different?</h2>
      <p>Join 50,000+ students already mapping their success.</p>
      <NuxtLink
        :to="isAuthenticated ? '/dashboard' : '/auth/signup'"
        class="btn btn-primary btn-large"
        @mousemove="handleButtonMouseMove"
        @mouseleave="handleButtonMouseLeave"
      >
        {{ isAuthenticated ? 'Go to Dashboard' : 'Start for free' }} &rarr;
      </NuxtLink>
      <span v-if="!isAuthenticated" class="cta-note">No credit card required</span>
    </section>

    <!-- Footer -->
    <footer>
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand">
            <NuxtLink to="/" class="logo">
              <div class="logo-mark" />
              <span class="logo-text">NeuroCanvas</span>
            </NuxtLink>
            <p>
              Think visually. Learn smarter. The mind mapping tool built for
              students who dare to think different.
            </p>
          </div>

          <div class="footer-links">
            <h5>Product</h5>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Download</a>
            <a href="#">Changelog</a>
          </div>

          <div class="footer-links">
            <h5>Resources</h5>
            <a href="#">Documentation</a>
            <a href="#">Tutorials</a>
            <a href="#">Blog</a>
            <a href="#">Community</a>
          </div>

          <div class="footer-links">
            <h5>Company</h5>
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
            <a href="#">Privacy</a>
          </div>
        </div>

        <div class="footer-bottom">
          <span>&copy; 2026 NeuroCanvas. Made with love for students.</span>
          <div class="footer-social">
            <a href="#">Twitter</a>
            <a href="#">GitHub</a>
            <a href="#">Discord</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   NEUROCANVAS LANDING — Bold & Refined (Nuxt Version)
   ═══════════════════════════════════════════════════════════════ */

.landing-page {
  --bg: #09090B;
  --surface: #0F0F12;
  --surface-2: #161619;
  --surface-3: #1D1D21;
  --border: #27272A;
  --text: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --accent: #00D2BE;
  --accent-light: #00FFE5;
  --accent-dark: #00A89A;
  --accent-glow: rgba(0, 210, 190, 0.15);
  --accent-glow-strong: rgba(0, 210, 190, 0.25);

  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

  font-family: 'Cabinet Grotesk', 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* Cursor Glow */
.cursor-glow {
  position: fixed;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.landing-page:hover .cursor-glow {
  opacity: 1;
}

/* Ambient Glow Orbs */
.glow-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;
  filter: blur(60px);
}

.glow-orb-1 {
  width: 900px;
  height: 900px;
  top: -450px;
  right: -300px;
  background: radial-gradient(circle, rgba(0, 210, 190, 0.12) 0%, transparent 60%);
  animation: float 25s ease-in-out infinite;
}

.glow-orb-2 {
  width: 700px;
  height: 700px;
  bottom: -350px;
  left: -200px;
  background: radial-gradient(circle, rgba(0, 210, 190, 0.08) 0%, transparent 60%);
  animation: float 30s ease-in-out infinite reverse;
}

.glow-orb-3 {
  width: 500px;
  height: 500px;
  top: 50%;
  left: 30%;
  background: radial-gradient(circle, rgba(0, 210, 190, 0.05) 0%, transparent 60%);
  animation: float 35s ease-in-out infinite 5s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
  33% { transform: translate(30px, -20px) scale(1.05) rotate(5deg); }
  66% { transform: translate(-20px, 30px) scale(0.95) rotate(-5deg); }
}

/* Navigation */
nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 1.25rem 2.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.4s var(--ease);
}

nav.scrolled {
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--border);
  padding: 1rem 2.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.3s var(--ease);
}

.logo:hover {
  transform: scale(1.02);
}

.logo-mark {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px var(--accent-glow-strong);
}

.logo-mark::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--bg);
  border-radius: 4px;
  animation: logoRotate 8s linear infinite;
}

.logo-mark::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 2px;
}

@keyframes logoRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}

.nav-links a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.25s ease;
  position: relative;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--accent);
  transition: width 0.3s var(--ease);
}

.nav-links a:hover {
  color: var(--text);
}

.nav-links a:hover::after {
  width: 100%;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Buttons */
.btn {
  font-family: inherit;
  font-weight: 600;
  text-decoration: none;
  border-radius: 10px;
  transition: all 0.3s var(--ease);
  cursor: pointer;
  border: none;
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.btn:hover::before {
  transform: translateX(100%);
}

.btn-ghost {
  color: var(--text-secondary);
  padding: 0.625rem 1rem;
  background: transparent;
}

.btn-ghost:hover {
  color: var(--text);
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
  color: var(--bg);
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  box-shadow: 0 4px 20px var(--accent-glow);
}

.btn-primary:hover {
  box-shadow: 0 8px 40px var(--accent-glow-strong), 0 0 60px var(--accent-glow);
  transform: translateY(-3px);
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1rem;
  border-radius: 12px;
}

.btn-secondary {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-secondary:hover {
  background: var(--surface-3);
  border-color: var(--text-muted);
  transform: translateY(-2px);
}

.btn-secondary svg {
  transition: transform 0.3s ease;
}

.btn-secondary:hover svg {
  transform: scale(1.2);
}

/* Hero */
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8rem 2.5rem 4rem;
  position: relative;
  overflow: hidden;
}

.hero-content {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero-text {
  animation: slideUp 1s var(--ease) both;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(50px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  background: linear-gradient(135deg, var(--accent-glow) 0%, rgba(0, 210, 190, 0.05) 100%);
  border: 1px solid rgba(0, 210, 190, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 2rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  animation: slideUp 1s var(--ease) 0.1s both;
}

.hero-badge::before {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
  box-shadow: 0 0 10px var(--accent);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.hero h1 {
  font-size: clamp(3.5rem, 6vw, 5.5rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.04em;
  margin-bottom: 1.5rem;
  animation: slideUp 1s var(--ease) 0.2s both;
}

.hero h1 .line {
  display: block;
}

.hero h1 .line:nth-child(2) {
  animation: slideUp 1s var(--ease) 0.3s both;
}

.hero h1 .highlight {
  color: var(--accent);
  position: relative;
  display: inline-block;
}

.hero h1 .highlight::after {
  content: '';
  position: absolute;
  bottom: 0.08em;
  left: -0.05em;
  right: -0.05em;
  height: 0.15em;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  opacity: 0.35;
  transform: skewX(-12deg);
  border-radius: 2px;
}

.hero-description {
  font-size: 1.25rem;
  color: var(--text-secondary);
  max-width: 480px;
  margin-bottom: 2.5rem;
  line-height: 1.7;
  font-weight: 500;
  animation: slideUp 1s var(--ease) 0.4s both;
}

.hero-cta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  animation: slideUp 1s var(--ease) 0.5s both;
}

/* Hero Visual */
.hero-visual {
  animation: slideUp 1s var(--ease) 0.3s both;
  perspective: 1200px;
}

.preview-container {
  position: relative;
  transform: rotateY(-8deg) rotateX(5deg);
  transform-style: preserve-3d;
  transition: transform 0.8s var(--ease);
}

.preview-container:hover {
  transform: rotateY(-2deg) rotateX(2deg) scale(1.02);
}

.preview-window {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.05),
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 0 150px -50px var(--accent-glow-strong);
  position: relative;
}

.preview-window::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 210, 190, 0.03) 0%, transparent 50%);
  pointer-events: none;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  gap: 0.5rem;
}

.toolbar-dots {
  display: flex;
  gap: 6px;
}

.toolbar-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toolbar-dot:hover {
  transform: scale(1.2);
}

.toolbar-dot:nth-child(1) { background: #FF5F57; }
.toolbar-dot:nth-child(2) { background: #FFBD2E; }
.toolbar-dot:nth-child(3) { background: #28C840; }

.toolbar-title {
  flex: 1;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: var(--accent-glow);
  border-color: var(--accent);
  color: var(--accent);
}

.preview-canvas {
  padding: 2rem;
  min-height: 420px;
  position: relative;
  background:
    radial-gradient(circle at 50% 50%, var(--accent-glow) 0%, transparent 40%),
    repeating-linear-gradient(0deg, transparent, transparent 32px, rgba(255,255,255,0.015) 32px, rgba(255,255,255,0.015) 33px),
    repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(255,255,255,0.015) 32px, rgba(255,255,255,0.015) 33px);
}

.map-container {
  position: relative;
  width: 100%;
  height: 360px;
}

/* SVG Connections */
.connections {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.connections line {
  stroke: var(--border);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  animation: drawLine 1.5s var(--ease) forwards;
}

.connections line:nth-child(1) { animation-delay: 0.8s; }
.connections line:nth-child(2) { animation-delay: 0.9s; }
.connections line:nth-child(3) { animation-delay: 1.0s; }
.connections line:nth-child(4) { animation-delay: 1.1s; }
.connections line:nth-child(5) { animation-delay: 1.2s; }
.connections line:nth-child(6) { animation-delay: 1.3s; }
.connections line:nth-child(7) { animation-delay: 1.4s; }
.connections line:nth-child(8) { animation-delay: 1.5s; }

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}

.connections line.glow {
  stroke: var(--accent);
  stroke-width: 2;
  filter: drop-shadow(0 0 8px var(--accent-glow-strong));
  animation: drawLine 1.5s var(--ease) 1.2s forwards, lineGlow 3s ease-in-out 2.5s infinite;
}

@keyframes lineGlow {
  0%, 100% { filter: drop-shadow(0 0 8px var(--accent-glow-strong)); }
  50% { filter: drop-shadow(0 0 16px var(--accent-glow-strong)); }
}

/* Nodes */
.node {
  position: absolute;
  background: var(--surface-2);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 0.875rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.4s var(--ease);
  cursor: pointer;
  user-select: none;
  opacity: 0;
  transform: scale(0.8);
  animation: nodeAppear 0.6s var(--ease-bounce) forwards;
}

@keyframes nodeAppear {
  to { opacity: 1; transform: scale(1); }
}

.node:nth-child(2) { animation-delay: 0.6s; }
.node:nth-child(3) { animation-delay: 0.7s; }
.node:nth-child(4) { animation-delay: 0.8s; }
.node:nth-child(5) { animation-delay: 0.9s; }
.node:nth-child(6) { animation-delay: 1.0s; }
.node:nth-child(7) { animation-delay: 1.1s; }
.node:nth-child(8) { animation-delay: 1.2s; }
.node:nth-child(9) { animation-delay: 1.3s; }
.node:nth-child(10) { animation-delay: 1.8s; }

.node:hover {
  border-color: var(--accent);
  background: var(--surface-3);
  transform: scale(1.08) translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 30px var(--accent-glow);
  z-index: 20;
}

.node.central {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(0.8);
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
  border: none;
  color: var(--bg);
  font-size: 1.1rem;
  padding: 1rem 2rem;
  box-shadow: 0 8px 40px var(--accent-glow-strong);
  z-index: 10;
  animation: centralAppear 0.8s var(--ease-bounce) 0.3s forwards;
}

@keyframes centralAppear {
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.node.central:hover {
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 16px 60px var(--accent-glow-strong), 0 0 80px var(--accent-glow);
}

.node.n1 { left: 5%; top: 15%; }
.node.n2 { left: 25%; top: 5%; animation-delay: 0.7s; }
.node.n3 { right: 22%; top: 5%; animation-delay: 0.8s; }
.node.n4 { right: 3%; top: 18%; }
.node.n5 { right: 0%; top: 55%; }
.node.n6 { right: 18%; bottom: 5%; }
.node.n7 { left: 12%; bottom: 5%; }
.node.n8 { left: 0%; top: 50%; }

.floating-node {
  animation: nodeFloat var(--float-duration, 5s) ease-in-out infinite var(--float-delay, 0s);
}

@keyframes nodeFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.node.ai {
  border: 2px dashed var(--accent);
  background: rgba(0, 210, 190, 0.08);
  animation-delay: 1.8s !important;
}

.node.ai::before {
  content: '✦';
  position: absolute;
  top: -12px;
  right: -12px;
  width: 26px;
  height: 26px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--bg);
  box-shadow: 0 4px 15px var(--accent-glow-strong);
  animation: sparkle 2s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(15deg) scale(1.1); }
}

.node.ai::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px dashed var(--accent);
  border-radius: 14px;
  opacity: 0;
  animation: aiRipple 3s ease-out infinite 2s;
}

@keyframes aiRipple {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.15); opacity: 0; }
}

/* Metrics */
.metrics {
  padding: 5rem 2.5rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  position: relative;
}

.metrics::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent-glow) 50%, transparent);
  opacity: 0.3;
}

.metrics-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  position: relative;
}

.metric {
  text-align: center;
  padding: 1.5rem;
  border-radius: 16px;
  transition: all 0.4s var(--ease);
}

.metric:hover {
  background: var(--accent-glow);
  transform: translateY(-4px);
}

.metric-value {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, var(--text) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.metric-value .accent {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.metric-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 0.5rem;
}

/* Features */
.features {
  padding: 8rem 2.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 4rem;
}

.section-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  padding: 0.375rem 0.75rem;
  background: var(--accent-glow);
  border-radius: 4px;
}

.section-title {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  max-width: 600px;
}

.section-description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  max-width: 500px;
  margin-top: 1.25rem;
  font-weight: 500;
  line-height: 1.7;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1.5rem;
}

.feature-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 2.5rem;
  transition: all 0.5s var(--ease);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--accent-glow) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.5s ease;
}

.feature-card:hover {
  border-color: var(--accent);
  transform: translateY(-8px);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4), 0 0 60px var(--accent-glow);
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-card.span-8 { grid-column: span 8; }
.feature-card.span-4 { grid-column: span 4; }
.feature-card.span-6 { grid-column: span 6; }

.feature-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--accent-glow) 0%, rgba(0, 210, 190, 0.05) 100%);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 1;
  transition: all 0.4s var(--ease);
}

.feature-card:hover .feature-icon {
  transform: scale(1.1) rotate(-5deg);
  box-shadow: 0 8px 30px var(--accent-glow-strong);
}

.feature-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
}

.feature-card p {
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.7;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

.feature-visual {
  grid-column: span 4;
  background: var(--surface-2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  min-height: 200px;
  margin-top: 1.5rem;
  position: relative;
  overflow: hidden;
}

.feature-visual::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, var(--accent-glow) 0%, transparent 50%);
}

.feature-card.has-visual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
}

.feature-card.has-visual .feature-visual {
  grid-column: auto;
  margin-top: 0;
}

/* AI Section */
.ai-section {
  padding: 8rem 2.5rem;
  background: linear-gradient(180deg, var(--bg) 0%, var(--surface) 50%, var(--bg) 100%);
  position: relative;
}

.ai-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}

.ai-section::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
}

.ai-inner {
  max-width: 1400px;
  margin: 0 auto;
}

.ai-header {
  text-align: center;
  margin-bottom: 6rem;
}

.ai-header .section-title {
  max-width: 100%;
}

.ai-header .section-title .gradient {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 50%, var(--accent) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 4s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.ai-features {
  display: flex;
  flex-direction: column;
  gap: 8rem;
}

.ai-feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6rem;
  align-items: center;
}

.ai-feature.reverse {
  direction: rtl;
}

.ai-feature.reverse > * {
  direction: ltr;
}

.ai-feature-content {
  max-width: 480px;
}

.ai-feature-number {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-feature-number::after {
  content: '';
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
}

.ai-feature-content h3 {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
}

.ai-feature-content p {
  color: var(--text-secondary);
  font-size: 1.125rem;
  line-height: 1.7;
  margin-bottom: 2rem;
  font-weight: 500;
}

.ai-feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0;
}

.ai-feature-list li {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.ai-feature-list li:hover {
  color: var(--text);
  transform: translateX(4px);
}

.ai-feature-list li::before {
  content: '✓';
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--accent-glow) 0%, rgba(0, 210, 190, 0.05) 100%);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.ai-feature-visual {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.ai-feature-visual::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, var(--accent-glow) 0%, transparent 50%);
}

/* AI Demo */
.ai-demo {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 2rem;
}

.ai-demo-nodes {
  position: relative;
  width: 100%;
  height: 100%;
}

.ai-demo-node {
  position: absolute;
  background: var(--surface-2);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.ai-demo-node.center {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  border: none;
  color: var(--bg);
}

.ai-demo-node.suggestion {
  border: 2px dashed var(--accent);
  background: rgba(0, 210, 190, 0.1);
  opacity: 0;
  animation: suggestAppear 0.5s var(--ease-bounce) forwards;
}

.ai-demo-node.suggestion:nth-child(2) { left: 10%; top: 20%; animation-delay: 0.5s; }
.ai-demo-node.suggestion:nth-child(3) { right: 10%; top: 25%; animation-delay: 0.8s; }
.ai-demo-node.suggestion:nth-child(4) { right: 15%; bottom: 20%; animation-delay: 1.1s; }

@keyframes suggestAppear {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

/* Platforms */
.platforms {
  padding: 8rem 2.5rem;
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 4rem;
}

.platform-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 3rem 2rem;
  transition: all 0.5s var(--ease);
  position: relative;
  overflow: hidden;
}

.platform-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--accent-glow) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.platform-card:hover {
  border-color: var(--accent);
  transform: translateY(-8px);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
}

.platform-card:hover::before {
  opacity: 1;
}

.platform-card .icon {
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  display: block;
  transition: transform 0.4s var(--ease);
}

.platform-card:hover .icon {
  transform: scale(1.15) rotate(-5deg);
}

.platform-card h4 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  position: relative;
  z-index: 1;
}

.platform-card p {
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* CTA */
.cta {
  padding: 10rem 2.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1200px;
  height: 1200px;
  background: radial-gradient(circle, var(--accent-glow-strong) 0%, transparent 50%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: ctaPulse 6s ease-in-out infinite;
}

@keyframes ctaPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.4; }
}

.cta h2 {
  font-size: clamp(3rem, 6vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  margin-bottom: 1.5rem;
  position: relative;
}

.cta > p {
  color: var(--text-secondary);
  font-size: 1.25rem;
  margin-bottom: 3rem;
  position: relative;
  font-weight: 500;
}

.cta .btn-primary {
  position: relative;
  font-size: 1.125rem;
  padding: 1.25rem 3rem;
}

.cta-note {
  display: block;
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  position: relative;
  font-weight: 500;
}

/* Footer */
footer {
  padding: 5rem 2.5rem 2rem;
  border-top: 1px solid var(--border);
  background: var(--surface);
  position: relative;
}

footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(180deg, var(--bg), transparent);
  pointer-events: none;
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 4rem;
  margin-bottom: 4rem;
}

.footer-brand p {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-top: 1.25rem;
  max-width: 300px;
  line-height: 1.7;
  font-weight: 500;
}

.footer-links h5 {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text);
  margin-bottom: 1.5rem;
}

.footer-links a {
  display: block;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  margin-bottom: 0.875rem;
  transition: all 0.25s ease;
}

.footer-links a:hover {
  color: var(--accent);
  transform: translateX(4px);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

.footer-social {
  display: flex;
  gap: 1.5rem;
}

.footer-social a {
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.25s ease;
  padding: 0.5rem;
  border-radius: 8px;
}

.footer-social a:hover {
  color: var(--accent);
  background: var(--accent-glow);
}

/* Reveal Animation */
.reveal {
  opacity: 0;
  transform: translateY(50px);
  transition: all 0.8s var(--ease);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 1200px) {
  .hero-content {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 3rem;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-description {
    margin-left: auto;
    margin-right: auto;
  }

  .hero-cta {
    justify-content: center;
  }

  .preview-container {
    transform: none;
    max-width: 700px;
    margin: 0 auto;
  }

  .preview-container:hover {
    transform: scale(1.01);
  }

  .features-grid {
    grid-template-columns: 1fr 1fr;
  }

  .feature-card.span-8,
  .feature-card.span-4,
  .feature-card.span-6 {
    grid-column: span 1;
  }

  .feature-card.has-visual {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .nav-links {
    display: none;
  }

  .metrics-inner {
    grid-template-columns: repeat(2, 1fr);
  }

  .ai-feature {
    grid-template-columns: 1fr;
    gap: 3rem;
  }

  .ai-feature.reverse {
    direction: ltr;
  }

  .ai-feature-content {
    max-width: 100%;
  }

  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  nav {
    padding: 1rem 1.5rem;
  }

  .hero {
    padding: 7rem 1.5rem 3rem;
  }

  .hero h1 {
    font-size: 2.75rem;
  }

  .hero-description {
    font-size: 1.1rem;
  }

  .hero-cta {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }

  .btn-large {
    width: 100%;
    justify-content: center;
  }

  .preview-canvas {
    padding: 1.5rem;
    min-height: 280px;
  }

  .map-container {
    height: 240px;
  }

  .node {
    font-size: 0.7rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
  }

  .node.central {
    font-size: 0.9rem;
    padding: 0.75rem 1.25rem;
  }

  .metrics {
    padding: 3rem 1.5rem;
  }

  .metrics-inner {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .metric-value {
    font-size: 2rem;
  }

  .features {
    padding: 4rem 1.5rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .feature-card {
    padding: 2rem;
  }

  .ai-section {
    padding: 4rem 1.5rem;
  }

  .ai-header {
    margin-bottom: 3rem;
  }

  .ai-feature-content h3 {
    font-size: 1.75rem;
  }

  .ai-features {
    gap: 4rem;
  }

  .platforms {
    padding: 4rem 1.5rem;
  }

  .platforms-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .platform-card {
    padding: 2rem;
  }

  .cta {
    padding: 5rem 1.5rem;
  }

  .cta h2 {
    font-size: 2.25rem;
  }

  footer {
    padding: 3rem 1.5rem 1.5rem;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 2rem;
  }

  .footer-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .footer-brand p {
    max-width: 100%;
  }

  .footer-bottom {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
