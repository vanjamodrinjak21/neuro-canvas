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
  <div ref="root" class="nc-select" :class="{ 'is-open': open, 'is-disabled': disabled, 'has-label': !!$slots.label }">
    <!-- Optional label — mono micro-label (REDESIGN.md §4/§5) -->
    <span v-if="$slots.label" class="nc-select__label">
      <slot name="label" />
    </span>
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
.nc-select.has-label {
  flex-direction: column;
  align-items: stretch;
  gap: 0.45rem;
}
.nc-select__label {
  font-family: var(--nc-font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}
/* Input grammar (REDESIGN.md §5): chip fill, 1px hairline, radius 0.5rem.
   Focus = border-color accent ONLY — no ring, no glow. */
.nc-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px 0 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  color: var(--nc-text);
  font-family: var(--nc-font-body);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease), background-color var(--nc-duration-fast) var(--nc-ease);
}
.nc-select__trigger:hover { border-color: var(--nc-border-active); }
/* Light: --nc-border-active (0.28 ink) is weaker than the form boundary
   (0.48) — hover must not fade the border below its rest state. */
:root.light .nc-select__trigger:hover { border-color: var(--nc-text-secondary); }
.nc-select__trigger:focus-visible {
  outline: none;
  border-color: var(--nc-accent);
}
.nc-select.is-open .nc-select__trigger { border-color: var(--nc-accent); }
.nc-select.is-disabled .nc-select__trigger { opacity: 0.45; cursor: not-allowed; }
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
  transition: transform var(--nc-duration-fast) var(--nc-ease), color var(--nc-duration-fast) var(--nc-ease);
}
.nc-select.is-open .nc-select__chevron { transform: rotate(180deg); color: var(--nc-text-secondary); }

/* Popover — flat surface-2 + hairline, origin at the trigger (REDESIGN.md §5) */
.nc-select__list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--nc-z-dropdown);
  min-width: 100%;
  max-height: 264px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 4px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  transform-origin: top left;
}
/* Items: hover = surface-3 + text brighten; selected = accent text */
.nc-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 0.4rem;
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-body);
  font-size: 13px;
  font-weight: 400;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  transition: background-color var(--nc-duration-fast) var(--nc-ease), color var(--nc-duration-fast) var(--nc-ease);
}
.nc-select__option:hover,
.nc-select__option:focus {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}
.nc-select__option.is-selected { color: var(--nc-accent); }
.nc-select__check { flex-shrink: 0; color: var(--nc-accent); }

.nc-select-pop-enter-active { transition: opacity 180ms var(--nc-ease), transform 180ms var(--nc-ease); }
.nc-select-pop-leave-active { transition: opacity 120ms var(--nc-ease), transform 120ms var(--nc-ease); }
.nc-select-pop-enter-from,
.nc-select-pop-leave-to { opacity: 0; transform: scale(0.97); }
</style>
