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
        class="nc-color-trigger w-8 h-8 rounded-nc-md border border-nc-border
               nc-anim active:scale-97 cursor-pointer"
        :style="{ backgroundColor: modelValue }"
      >
        <span class="sr-only">Pick a color</span>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <!-- Flat surface-2 + hairline; origin at trigger, enter 150ms / exit 100ms -->
      <PopoverContent
        :side-offset="8"
        class="nc-picker-pop z-dropdown nc-glass-elevated rounded-nc-md p-4 w-[220px]"
      >
        <!-- Preset colors — swatch palette values are data, not chrome -->
        <div class="grid grid-cols-4 gap-2 mb-4">
          <button
            v-for="color in presets"
            :key="color"
            type="button"
            class="w-10 h-10 rounded-[0.4rem] border nc-anim
                   nc-swatch-btn active:scale-97 cursor-pointer"
            :class="modelValue === color ? 'border-nc-ink' : 'border-transparent'"
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
        <div v-if="showCustom" class="pt-3 border-t border-nc-border-subtle">
          <!-- Mono micro-label (REDESIGN.md §4) -->
          <label class="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-nc-text-secondary mb-2">
            Custom Color
          </label>
          <div class="flex items-center gap-2">
            <input
              type="color"
              :value="customColor"
              class="w-10 h-10 rounded-nc-md border border-nc-border cursor-pointer
                     appearance-none bg-transparent
                     [&::-webkit-color-swatch-wrapper]:p-0
                     [&::-webkit-color-swatch]:rounded-nc-sm [&::-webkit-color-swatch]:border-none"
              @input="handleCustomChange"
            >
            <input
              type="text"
              :value="customColor"
              placeholder="#000000"
              class="flex-1 px-3 py-2 rounded-nc-md bg-nc-chip text-nc-ink text-sm uppercase
                     border border-nc-border focus:border-nc-accent focus:outline-none nc-anim"
              @input="handleCustomChange"
            >
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
/* Popover motion — origin at trigger, scale(0.97)+opacity (REDESIGN.md §5/§6) */
.nc-picker-pop {
  transform-origin: var(--radix-popover-content-transform-origin);
}
.nc-picker-pop[data-state='open'] {
  animation: nc-picker-in 150ms var(--nc-ease);
}
.nc-picker-pop[data-state='closed'] {
  animation: nc-picker-out 100ms var(--nc-ease) forwards;
}

@keyframes nc-picker-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@keyframes nc-picker-out {
  to {
    opacity: 0;
    transform: scale(0.97);
  }
}

@media (hover: hover) and (pointer: fine) {
  .nc-color-trigger:hover {
    border-color: var(--nc-accent);
  }

  /* Subtle lift only — no glow in chrome */
  .nc-swatch-btn:hover {
    transform: scale(1.06);
  }
}
</style>
