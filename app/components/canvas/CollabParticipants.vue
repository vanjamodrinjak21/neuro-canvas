<script setup lang="ts">
import { computed } from 'vue'
import type { RemoteUser } from '~/composables/useCollabSession'

const props = defineProps<{ remotes: RemoteUser[] }>()
const visible = computed(() => props.remotes.slice(0, 5))
const overflow = computed(() => Math.max(0, props.remotes.length - visible.value.length))
</script>

<template>
  <div v-if="remotes.length" class="collab-participants">
    <div class="avatars">
      <div
        v-for="r in visible"
        :key="r.sessionId"
        class="avatar"
        :style="{ background: r.color }"
        :title="r.displayName"
      >{{ r.displayName.charAt(0).toUpperCase() }}</div>
      <div v-if="overflow > 0" class="avatar overflow">+{{ overflow }}</div>
    </div>
    <div class="live-pill">
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
.avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1.5px solid var(--nc-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 11px Inter, system-ui, sans-serif;
  color: #09090B;
}
.avatar + .avatar {
  margin-left: -8px;
}
.avatar.overflow {
  background: var(--nc-surface-3);
  color: var(--nc-text-secondary);
  font-weight: 500;
}
.live-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--nc-border);
  background: var(--nc-surface);
  font: 500 12px Inter, system-ui, sans-serif;
}
.live-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--nc-accent);
}
.live-pill .count {
  color: var(--nc-text-secondary);
}
</style>
