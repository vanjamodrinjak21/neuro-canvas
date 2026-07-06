<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import type { RemoteUser } from '~/composables/useCollabSession'

const props = defineProps<{ remotes: RemoteUser[] }>()

// Sort by displayName so the avatar order stays stable across awareness
// updates — otherwise the pills churn every time a peer's selection
// changes and Vue triggers a key re-shuffle.
const sorted = computed(() => [...props.remotes].sort((a, b) => a.displayName.localeCompare(b.displayName)))
const visible = computed(() => sorted.value.slice(0, 5))
const overflow = computed(() => Math.max(0, sorted.value.length - visible.value.length))
const overflowList = computed(() => sorted.value.slice(visible.value.length).map(r => r.displayName).join(', '))

// Track "is anyone actively cursoring/selecting" so the pill can pulse
// briefly when collab activity spikes — a subtle "live" affordance.
const lastActivityAt = ref(0)
const isPulsing = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function trackActivity() {
  const stamp = JSON.stringify(props.remotes.map(r => [r.sessionId, r.cursor?.x ?? null, r.cursor?.y ?? null, r.selection.length]))
  if (stamp !== lastStamp.value) {
    lastStamp.value = stamp
    lastActivityAt.value = Date.now()
    isPulsing.value = true
    if (pulseTimer) clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => { isPulsing.value = false }, 600)
  }
}
const lastStamp = ref('')

watch(() => props.remotes, trackActivity, { deep: true, immediate: true })
onMounted(() => { lastActivityAt.value = Date.now() })
onUnmounted(() => { if (pulseTimer) clearTimeout(pulseTimer) })
</script>

<template>
  <div v-if="remotes.length" class="collab-participants">
    <div class="avatars">
      <div
        v-for="r in visible"
        :key="r.sessionId"
        class="avatar"
        :class="{ 'is-selecting': r.selection.length > 0 }"
        :style="{ '--peer-color': r.color }"
        :title="r.selection.length ? `${r.displayName} — editing ${r.selection.length} node${r.selection.length > 1 ? 's' : ''}` : r.displayName"
      >{{ r.displayName.charAt(0).toUpperCase() }}</div>
      <div
        v-if="overflow > 0"
        class="avatar overflow"
        :title="overflowList"
      >+{{ overflow }}</div>
    </div>
    <div class="live-pill" :class="{ 'is-pulsing': isPulsing }">
      <span class="dot" />
      <span class="count">{{ remotes.length + 1 }} live</span>
    </div>
  </div>
</template>

<style scoped>
.collab-participants {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatars {
  display: flex;
  align-items: center;
}
/* Peer identity color is DATA — preserved via the single-custom-property
   pattern (REDESIGN.md §9); ink-on-color follows the selection grammar. */
.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1.5px solid var(--nc-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nc-font-body);
  font-size: 11px;
  font-weight: 600;
  background: var(--peer-color, var(--nc-surface-3));
  color: var(--nc-bg);
  position: relative;
  transition: transform 160ms var(--nc-ease);
}
.avatar + .avatar {
  margin-left: -8px;
}
@media (hover: hover) and (pointer: fine) {
  .avatar:hover {
    transform: translateY(-2px);
    z-index: 2;
  }
}
/* Selection indicator — small ring around the avatar when the peer is
   editing something, so you can see at a glance who's active vs idle. */
.avatar.is-selecting::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  border: 1.5px solid var(--peer-color);
  opacity: 0.55;
  animation: nc-peer-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  pointer-events: none;
}
@keyframes nc-peer-ring {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50%      { transform: scale(1.08); opacity: 0.25; }
}
.avatar.overflow {
  background: var(--nc-surface-3);
  color: var(--nc-text-secondary);
  font-weight: 500;
}
/* Live presence = live marker → coral (REDESIGN.md §1 accent discipline) */
.live-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 2rem;
  border: 1px solid var(--nc-border);
  background: var(--nc-surface);
  font-family: var(--nc-font-body);
  font-size: 12px;
  font-weight: 500;
  transition: border-color 200ms var(--nc-ease), background 200ms var(--nc-ease);
}
.live-pill.is-pulsing {
  border-color: var(--nc-coral);
}
.live-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-coral);
  transition: transform 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease);
}
.live-pill.is-pulsing .dot {
  transform: scale(1.4);
  box-shadow: 0 0 0 4px rgba(var(--nc-coral-rgb), 0.22);
}
.live-pill .count {
  color: var(--nc-text-secondary);
}
@media (prefers-reduced-motion: reduce) {
  .avatar.is-selecting::after { animation: none; }
  .live-pill .dot,
  .avatar { transition: none; }
}
</style>
