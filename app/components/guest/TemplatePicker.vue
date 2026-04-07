<script setup lang="ts">
const emit = defineEmits<{
  select: [template: string | null]
}>()

const templates = [
  {
    id: 'brainstorm',
    title: 'Brainstorm',
    description: 'Explore ideas from a central topic',
    icon: 'i-lucide-lightbulb',
  },
  {
    id: 'pros-cons',
    title: 'Pros & Cons',
    description: 'Weigh decisions side by side',
    icon: 'i-lucide-scale',
  },
  {
    id: 'project-plan',
    title: 'Project Plan',
    description: 'Break a project into phases',
    icon: 'i-lucide-gantt-chart',
  },
]
</script>

<template>
  <Teleport to="body">
    <div class="picker-overlay">
      <div class="picker-card">
        <h2 class="picker-title">Pick a starting point</h2>
        <p class="picker-desc">Choose a template or start from scratch.</p>

        <div class="picker-grid">
          <button
            v-for="tmpl in templates"
            :key="tmpl.id"
            class="picker-option"
            @click="emit('select', tmpl.id)"
          >
            <div class="picker-option-icon">
              <span :class="tmpl.icon" />
            </div>
            <span class="picker-option-title">{{ tmpl.title }}</span>
            <span class="picker-option-desc">{{ tmpl.description }}</span>
          </button>
        </div>

        <button class="picker-blank" @click="emit('select', null)">
          <span class="i-lucide-file-plus" />
          Start blank
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.picker-card {
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 20px;
  padding: 2rem;
  max-width: 560px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.25rem;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.picker-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
  letter-spacing: -0.02em;
}

.picker-desc {
  font-size: 0.875rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  width: 100%;
}

.picker-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 0.75rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Inter', system-ui, sans-serif;
}

.picker-option:hover {
  border-color: var(--nc-teal, #00D2BE);
  background: rgba(0, 210, 190, 0.05);
}

.picker-option-icon {
  width: 44px;
  height: 44px;
  background: rgba(0, 210, 190, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--nc-teal, #00D2BE);
}

.picker-option-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
}

.picker-option-desc {
  font-size: 0.7rem;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.4;
}

.picker-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.picker-blank:hover {
  border-color: var(--nc-ink-muted, #A1A1AA);
  color: var(--nc-ink, #FAFAFA);
}

@media (max-width: 480px) {
  .picker-grid {
    grid-template-columns: 1fr;
  }
}
</style>
