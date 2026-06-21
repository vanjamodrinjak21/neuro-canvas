<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue'

export interface NcSelectOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: NcSelectOption[]
  ariaLabel?: string
  disabled?: boolean
}>(), {
  ariaLabel: undefined,
  disabled: false,
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)

const selectedIndex = computed(() =>
  props.options.findIndex(o => o.value === props.modelValue),
)
const selectedLabel = computed(() =>
  selectedIndex.value >= 0 ? props.options[selectedIndex.value]!.label : '',
)

function openMenu() {
  if (props.disabled) return
  open.value = true
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0
  void nextTick(() => focusActive())
}

function closeMenu(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) void nextTick(() => triggerEl.value?.focus())
}

function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

function choose(index: number) {
  const opt = props.options[index]
  if (!opt) return
  emit('update:modelValue', opt.value)
  closeMenu()
}

function focusActive() {
  const node = listEl.value?.children[activeIndex.value] as HTMLElement | undefined
  node?.focus()
}

function move(delta: number) {
  if (!props.options.length) return
  const n = props.options.length
  activeIndex.value = (activeIndex.value + delta + n) % n
  focusActive()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openMenu()
  }
}

function onListKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); move(1); break
    case 'ArrowUp': e.preventDefault(); move(-1); break
    case 'Home': e.preventDefault(); activeIndex.value = 0; focusActive(); break
    case 'End': e.preventDefault(); activeIndex.value = props.options.length - 1; focusActive(); break
    case 'Enter':
    case ' ': e.preventDefault(); choose(activeIndex.value); break
    case 'Escape': e.preventDefault(); closeMenu(); break
    case 'Tab': closeMenu(false); break
  }
}

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) closeMenu(false)
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointerDown, true)
  else document.removeEventListener('pointerdown', onPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <div ref="root" class="nc-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button
      ref="triggerEl"
      type="button"
      class="nc-select__trigger"
      :disabled="disabled"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="nc-select__value">{{ selectedLabel }}</span>
      <svg class="nc-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="nc-select-pop">
      <ul
        v-if="open"
        ref="listEl"
        class="nc-select__list"
        role="listbox"
        :aria-label="ariaLabel"
        @keydown="onListKeydown"
      >
        <li
          v-for="(opt, i) in options"
          :key="opt.value"
          class="nc-select__option"
          :class="{ 'is-selected': opt.value === modelValue }"
          role="option"
          :aria-selected="opt.value === modelValue"
          tabindex="-1"
          @click="choose(i)"
          @mousemove="activeIndex = i"
        >
          <span class="nc-select__option-label">{{ opt.label }}</span>
          <svg v-if="opt.value === modelValue" class="nc-select__check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.nc-select {
  position: relative;
  display: inline-flex;
}
.nc-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px 0 12px;
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  color: var(--nc-text);
  font: 400 13px Inter, system-ui, sans-serif;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) ease, background var(--nc-duration-fast) ease;
}
.nc-select__trigger:hover { border-color: var(--nc-text-dim); }
.nc-select__trigger:focus-visible {
  outline: none;
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}
.nc-select.is-open .nc-select__trigger { border-color: var(--nc-accent); }
.nc-select.is-disabled .nc-select__trigger { opacity: 0.5; cursor: not-allowed; }
.nc-select__value {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-select__chevron {
  flex-shrink: 0;
  color: var(--nc-text-muted);
  transition: transform var(--nc-duration-fast) ease, color var(--nc-duration-fast) ease;
}
.nc-select.is-open .nc-select__chevron { transform: rotate(180deg); color: var(--nc-text-secondary); }

.nc-select__list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  min-width: 100%;
  max-height: 264px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 4px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  box-shadow: var(--nc-shadow-lg);
}
.nc-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--nc-text-secondary);
  font: 400 13px Inter, system-ui, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  transition: background var(--nc-duration-fast) ease, color var(--nc-duration-fast) ease;
}
.nc-select__option:hover,
.nc-select__option:focus {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}
.nc-select__option.is-selected { color: var(--nc-text); }
.nc-select__check { flex-shrink: 0; color: var(--nc-accent); }

.nc-select-pop-enter-active { transition: opacity 150ms ease, transform 150ms ease; }
.nc-select-pop-leave-active { transition: opacity 100ms ease, transform 100ms ease; }
.nc-select-pop-enter-from,
.nc-select-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }
</style>
