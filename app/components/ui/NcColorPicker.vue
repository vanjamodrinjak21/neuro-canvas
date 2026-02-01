<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'radix-vue'

export interface NcColorPickerProps {
  modelValue?: string
  presets?: string[]
  showCustom?: boolean
}

const props = withDefaults(defineProps<NcColorPickerProps>(), {
  modelValue: '#00D2BE',
  presets: () => [
    // Teal accents
    '#00D2BE', '#00A89A', '#33DBCB', '#00857A',
    // Dark surfaces
    '#0D0D0F', '#1A1A1E', '#2A2A30', '#3A3A42',
    // Status colors
    '#22C55E', '#EAB308', '#EF4444', '#3B82F6',
    // Light tones
    '#E8E8EC', '#C8C8D0', '#6B6B75', '#4A4A52'
  ],
  showCustom: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const customColor = ref(props.modelValue)

watch(() => props.modelValue, (newValue) => {
  customColor.value = newValue
})

function selectColor(color: string) {
  emit('update:modelValue', color)
  customColor.value = color
}

function handleCustomChange(event: Event) {
  const target = event.target as HTMLInputElement
  customColor.value = target.value
  emit('update:modelValue', target.value)
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="w-8 h-8 rounded-nc-md border-2 border-nc-pencil
               hover:border-nc-teal transition-colors
               focus:outline-none focus:ring-2 focus:ring-nc-teal focus:ring-offset-2 focus:ring-offset-nc-charcoal"
        :style="{ backgroundColor: modelValue }"
      >
        <span class="sr-only">Pick a color</span>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :side-offset="8"
        class="z-dropdown nc-glass-elevated rounded-nc-xl p-4 shadow-nc-xl w-[220px]
               animate-in fade-in-0 zoom-in-95
               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <!-- Preset colors -->
        <div class="grid grid-cols-4 gap-2 mb-4">
          <button
            v-for="color in presets"
            :key="color"
            type="button"
            class="w-10 h-10 rounded-nc-md border-2 transition-all
                   hover:scale-110 hover:shadow-nc-glow
                   focus:outline-none focus:ring-2 focus:ring-nc-teal"
            :class="modelValue === color ? 'border-nc-ink ring-2 ring-nc-teal' : 'border-transparent'"
            :style="{ backgroundColor: color }"
            @click="selectColor(color)"
          >
            <span class="sr-only">{{ color }}</span>
            <span
              v-if="modelValue === color"
              class="i-lucide-check text-white text-lg drop-shadow"
            />
          </button>
        </div>

        <!-- Custom color picker -->
        <div v-if="showCustom" class="pt-3 border-t border-nc-pencil">
          <label class="block text-xs font-medium text-nc-ink-muted mb-2">
            Custom Color
          </label>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="customColor"
              class="w-10 h-10 rounded-nc-md border-2 border-nc-pencil cursor-pointer
                     appearance-none bg-transparent
                     [&::-webkit-color-swatch-wrapper]:p-0
                     [&::-webkit-color-swatch]:rounded-nc-sm [&::-webkit-color-swatch]:border-none"
              @input="handleCustomChange"
            >
            <input
              type="text"
              :value="customColor"
              placeholder="#000000"
              class="flex-1 px-3 py-2 rounded-nc-md bg-nc-graphite text-nc-ink text-sm uppercase
                     border border-nc-pencil focus:border-nc-teal focus:outline-none"
              @input="handleCustomChange"
            >
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
