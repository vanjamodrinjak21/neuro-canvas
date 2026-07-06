<script setup lang="ts">
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent
} from 'radix-vue'

export interface Tab {
  value: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface NcTabsProps {
  tabs: Tab[]
  defaultValue?: string
  modelValue?: string
  orientation?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<NcTabsProps>(), {
  defaultValue: '',
  modelValue: '',
  orientation: 'horizontal'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const activeTab = computed({
  get: () => props.modelValue || props.defaultValue || props.tabs[0]?.value || '',
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <TabsRoot
    v-model="activeTab"
    :default-value="defaultValue"
    :orientation="orientation"
    :class="[
      'flex',
      orientation === 'horizontal' ? 'flex-col' : 'flex-row gap-4'
    ]"
  >
    <!-- Rail of text tabs on a hairline — no pill backgrounds (REDESIGN.md §5) -->
    <TabsList
      :class="[
        'relative flex gap-1',
        orientation === 'horizontal'
          ? 'nc-tabs-h flex-row border-b border-nc-border'
          : 'nc-tabs-v flex-col border-r border-nc-border'
      ]"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        :class="[
          'nc-tab relative flex items-center justify-center gap-2 px-3.5 py-2.5',
          'font-mono text-[0.78rem] uppercase tracking-[0.1em] font-medium',
          'bg-transparent cursor-pointer nc-anim',
          'data-[state=active]:text-nc-accent',
          'data-[state=inactive]:text-nc-text-secondary data-[state=inactive]:hover:text-nc-text',
          tab.disabled && 'opacity-45 cursor-not-allowed'
        ]"
      >
        <span v-if="tab.icon" :class="[tab.icon, 'text-lg']" />
        <span>{{ tab.label }}</span>
      </TabsTrigger>
    </TabsList>

    <div class="flex-1 mt-4">
      <TabsContent
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        class="focus-visible:outline-none"
      >
        <slot :name="tab.value" :tab="tab" />
      </TabsContent>
    </div>
  </TabsRoot>
</template>

<style scoped>
/* Active indicator — a 1px accent line on the rail hairline. Never color
   alone: the active tab is accent text + the underline (REDESIGN.md §5). */
.nc-tab[data-state='active']::after {
  content: '';
  position: absolute;
  background: var(--nc-accent);
}

.nc-tabs-h .nc-tab[data-state='active']::after {
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
}

.nc-tabs-v .nc-tab[data-state='active']::after {
  top: 0;
  bottom: 0;
  right: -1px;
  width: 1px;
}
</style>
