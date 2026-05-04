<script setup lang="ts">
/**
 * Mobile Map Editor shell — owns the full-viewport layout for the
 * mobile map page. Renders MobileEditorChrome at top and the editor
 * body (markdown/graph) in the remaining space via the default slot.
 *
 * Keeps mobile completely isolated from the desktop canvas layout so
 * the chrome can collapse on keyboard show without overlapping.
 */
interface Props {
  title: string
  nodeCount: number
  viewMode: 'editor' | 'graph' | 'canvas'
  isSynced?: boolean
}

withDefaults(defineProps<Props>(), { isSynced: true })

defineEmits<{
  back: []
  more: []
  ai: []
  'set-view': [view: 'editor' | 'graph']
  'generate-map': []
}>()
</script>

<template>
  <div class="mme">
    <MobileEditorChrome
      :title="title"
      :node-count="nodeCount"
      :view-mode="viewMode"
      :is-synced="isSynced"
      @back="$emit('back')"
      @more="$emit('more')"
      @ai="$emit('ai')"
      @set-view="(v) => $emit('set-view', v)"
      @generate-map="$emit('generate-map')"
    />
    <div class="mme-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.mme {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: #09090B;
  color: #FAFAFA;
  z-index: 30;
  overflow: hidden;
}
.mme-body {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
}
.mme-body :deep(.mde) {
  position: absolute;
  inset: 0;
  padding-top: 0;
  width: 100%;
  height: 100%;
}
:root.light .mme {
  background: #FAFAF9;
  color: #18181B;
}
</style>
