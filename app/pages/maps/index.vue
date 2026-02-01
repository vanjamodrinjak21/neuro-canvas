<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'

definePageMeta({
  layout: false
})

const db = useDatabase()
const mapStore = useMapStore()
const router = useRouter()

// State
const allMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'recent' | 'alphabetical' | 'nodes'>('recent')

// Filtered and sorted maps
const filteredMaps = computed(() => {
  let maps = [...allMaps.value]

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    maps = maps.filter(m => m.title.toLowerCase().includes(query))
  }

  // Sort
  switch (sortBy.value) {
    case 'recent':
      maps.sort((a, b) => b.updatedAt - a.updatedAt)
      break
    case 'alphabetical':
      maps.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'nodes':
      maps.sort((a, b) => b.nodes.length - a.nodes.length)
      break
  }

  return maps
})

// Load all maps
onMounted(async () => {
  try {
    allMaps.value = await db.getAllMaps()
  } catch (error) {
    console.error('Failed to load maps:', error)
  } finally {
    isLoading.value = false
  }
})

// Open map
function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

// Delete map
async function deleteMap(mapId: string, event: Event) {
  event.stopPropagation()
  if (!confirm('Are you sure you want to delete this map?')) return

  try {
    await db.deleteMap(mapId)
    allMaps.value = allMaps.value.filter(m => m.id !== mapId)
  } catch (error) {
    console.error('Failed to delete map:', error)
  }
}

// Create new map
async function createNewMap() {
  mapStore.newDocument()
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  await navigateTo(`/map/${doc.id}`)
}

// Format date
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="maps-page">
    <!-- Background effects -->
    <div class="bg-grid" />
    <div class="bg-noise" />

    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <NuxtLink to="/dashboard" class="back-btn">
          <span class="i-lucide-arrow-left" />
        </NuxtLink>
        <div class="header-text">
          <h1 class="header-title">All Maps</h1>
          <p class="header-subtitle">{{ filteredMaps.length }} maps</p>
        </div>
      </div>

      <button class="btn-primary" @click="createNewMap">
        <span class="i-lucide-plus" />
        New Map
      </button>
    </header>

    <!-- Main content -->
    <main class="main-content">
      <!-- Search and filters -->
      <div class="toolbar">
        <div class="search-wrapper">
          <span class="i-lucide-search search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search maps..."
          >
        </div>

        <div class="sort-wrapper">
          <label class="sort-label">Sort by:</label>
          <select v-model="sortBy" class="sort-select">
            <option value="recent">Most Recent</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="nodes">Node Count</option>
          </select>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-orbit">
          <div class="loading-dot" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredMaps.length === 0 && !searchQuery" class="empty-state">
        <div class="empty-icon">
          <span class="i-lucide-map" />
        </div>
        <h3 class="empty-title">No maps yet</h3>
        <p class="empty-desc">Create your first mind map to get started</p>
        <button class="btn-primary" @click="createNewMap">
          <span class="i-lucide-plus" />
          Create Map
        </button>
      </div>

      <!-- No results -->
      <div v-else-if="filteredMaps.length === 0 && searchQuery" class="empty-state">
        <div class="empty-icon">
          <span class="i-lucide-search-x" />
        </div>
        <h3 class="empty-title">No maps found</h3>
        <p class="empty-desc">Try a different search term</p>
        <button class="btn-ghost" @click="searchQuery = ''">
          Clear search
        </button>
      </div>

      <!-- Maps grid -->
      <div v-else class="maps-grid">
        <div
          v-for="map in filteredMaps"
          :key="map.id"
          class="map-card"
          @click="openMap(map.id)"
        >
          <button
            class="map-delete"
            title="Delete map"
            @click="deleteMap(map.id, $event)"
          >
            <span class="i-lucide-trash-2" />
          </button>

          <div class="map-preview">
            <img v-if="map.preview" :src="map.preview" :alt="map.title" class="map-img">
            <div v-else class="map-placeholder">
              <span class="i-lucide-map" />
            </div>
          </div>

          <div class="map-info">
            <h3 class="map-title">{{ map.title }}</h3>
            <div class="map-meta">
              <span>{{ map.nodes.length }} nodes</span>
              <span>{{ formatDate(map.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* CSS Custom Properties */
.maps-page {
  --bg: #06060A;
  --surface: #0C0C10;
  --surface-2: #121216;
  --surface-3: #18181D;
  --surface-hover: #1E1E24;
  --border: #252529;
  --border-subtle: #1A1A1E;
  --border-glow: rgba(0, 210, 190, 0.3);

  --text: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --text-dim: #52525B;

  --accent: #00D2BE;
  --accent-light: #00FFE5;
  --accent-dark: #00A89A;
  --accent-glow: rgba(0, 210, 190, 0.12);
  --accent-glow-strong: rgba(0, 210, 190, 0.25);

  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

/* Base */
.maps-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Cabinet Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  position: relative;
}

/* Background */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 100%);
  pointer-events: none;
  z-index: 0;
}

.bg-noise {
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.018;
  pointer-events: none;
  z-index: 9999;
}

/* Header */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2.5rem;
  background: rgba(6, 6, 10, 0.7);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid var(--border-subtle);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s var(--ease);
}

.back-btn:hover {
  background: var(--surface-3);
  border-color: var(--accent);
  color: var(--accent);
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.header-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

/* Main content */
.main-content {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 2.5rem;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.search-wrapper {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-dim);
  font-size: 1.125rem;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s var(--ease);
}

.search-input::placeholder {
  color: var(--text-dim);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.sort-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sort-label {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.sort-select {
  padding: 0.625rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s var(--ease);
}

.sort-select:focus {
  border-color: var(--accent);
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
}

.loading-orbit {
  width: 60px;
  height: 60px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  position: relative;
}

.loading-dot {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--accent-glow-strong);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5rem 2rem;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: var(--accent-glow);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--accent);
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.625rem;
}

.empty-desc {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0 0 2rem;
}

/* Maps grid */
.maps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1200px) {
  .maps-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .maps-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .maps-grid {
    grid-template-columns: 1fr;
  }
}

.map-card {
  position: relative;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s var(--ease);
}

.map-card:hover {
  border-color: var(--border-glow);
  transform: translateY(-4px);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.3),
    0 0 40px var(--accent-glow);
}

.map-delete {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  z-index: 10;
  width: 36px;
  height: 36px;
  background: rgba(6, 6, 10, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s var(--ease);
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-card:hover .map-delete {
  opacity: 1;
}

.map-delete:hover {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.map-preview {
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  overflow: hidden;
}

.map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s var(--ease);
}

.map-card:hover .map-img {
  transform: scale(1.05);
}

.map-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--surface-2), var(--surface));
  font-size: 2.5rem;
  color: var(--text-dim);
}

.map-info {
  padding: 1.25rem;
}

.map-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s var(--ease);
}

.map-card:hover .map-title {
  color: var(--accent);
}

.map-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Buttons */
.btn-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.75rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: var(--bg);
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s var(--ease);
  box-shadow:
    0 4px 20px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  font-family: inherit;
}

.btn-primary:hover {
  box-shadow:
    0 8px 40px var(--accent-glow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.75rem;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s var(--ease);
  font-family: inherit;
}

.btn-ghost:hover {
  border-color: var(--accent);
  background: var(--surface-3);
  color: var(--accent);
}

/* Responsive */
@media (max-width: 768px) {
  .header {
    padding: 1rem 1.5rem;
  }

  .main-content {
    padding: 1.5rem;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper {
    max-width: none;
  }

  .sort-wrapper {
    justify-content: space-between;
  }
}
</style>
