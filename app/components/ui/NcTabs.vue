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
    <TabsList
      :class="[
        'relative flex nc-glass rounded-nc-lg p-1 gap-1',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col'
      ]"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        :class="[
          'relative flex items-center justify-center gap-2 px-4 py-2 rounded-nc-md',
          'text-sm font-medium transition-[color,background-color,box-shadow] duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nc-teal focus-visible:ring-offset-2 focus-visible:ring-offset-nc-charcoal',
          'data-[state=active]:bg-nc-teal data-[state=active]:text-nc-charcoal data-[state=active]:shadow-nc-glow',
          'data-[state=inactive]:text-nc-ink-soft data-[state=inactive]:hover:text-nc-ink data-[state=inactive]:hover:bg-nc-graphite',
          tab.disabled && 'opacity-50 cursor-not-allowed'
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
