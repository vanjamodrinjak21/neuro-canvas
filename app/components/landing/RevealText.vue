<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Masked word-rise reveal. Words render server-side (SEO-safe); GSAP lifts
 * them out of an overflow mask when the element scrolls into view.
 * `*word*` markers in the string become serif-italic accent spans.
 */
const props = withDefaults(
  defineProps<{
    text: string
    as?: string
    /** animate immediately on mount instead of waiting for scroll */
    immediate?: boolean
    delay?: number
  }>(),
  { as: 'span', immediate: false, delay: 0 },
)

interface TokenPart {
  text: string
  accent: boolean
}

/**
 * One visual word = one mask. Accent runs (`*…*`) may span several words,
 * and punctuation stays glued to its word — so parse accent runs first,
 * then assemble words across run boundaries.
 */
const tokens = computed<TokenPart[][]>(() => {
  const words: TokenPart[][] = []
  let current: TokenPart[] = []
  for (const run of props.text.split(/(\*[^*]+\*)/)) {
    if (!run) continue
    const accent = run.startsWith('*') && run.endsWith('*')
    const text = accent ? run.slice(1, -1) : run
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue
      if (/^\s+$/.test(piece)) {
        if (current.length) words.push(current)
        current = []
      } else {
        current.push({ text: piece, accent })
      }
    }
  }
  if (current.length) words.push(current)
  return words
})

const root = ref<HTMLElement>()
const isStatic = ref(false)
let trigger: ScrollTrigger | null = null
let tween: gsap.core.Tween | null = null

function play(fast = false) {
  if (!root.value) return
  const targets = root.value.querySelectorAll('.wi')
  tween?.kill()
  tween = gsap.to(targets, {
    yPercent: 0,
    duration: fast ? 0.7 : 1.15,
    stagger: fast ? 0.03 : 0.06,
    ease: 'expo.out',
    delay: props.delay,
    overwrite: true,
  })
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    isStatic.value = true
    return
  }
  gsap.registerPlugin(ScrollTrigger)
  // words are visible in the server-rendered HTML (no-JS readers keep the
  // headings); hide them from JS only once we know we can animate them out
  if (root.value) gsap.set(root.value.querySelectorAll('.wi'), { yPercent: 115 })
  if (props.immediate) {
    play()
  } else {
    trigger = ScrollTrigger.create({
      trigger: root.value,
      start: 'top 82%',
      once: true,
      onEnter: () => play(),
    })
  }
})

// locale switch re-renders the words — hide the fresh DOM, then reveal
watch(tokens, async () => {
  if (isStatic.value) return
  await nextTick()
  if (root.value) gsap.set(root.value.querySelectorAll('.wi'), { yPercent: 115 })
  play(true)
})

onBeforeUnmount(() => {
  trigger?.kill()
  tween?.kill()
})
</script>

<template>
  <component :is="as" ref="root" class="reveal" :class="{ 'is-static': isStatic }">
    <template v-for="(word, i) in tokens" :key="`${i}-${word[0]?.text}`">
      <span class="w"
        ><span class="wi"
          ><template v-for="(part, j) in word" :key="j"
            ><span v-if="part.accent" class="accent">{{ part.text }}</span
            ><template v-else>{{ part.text }}</template></template
          ></span
        ></span
      >{{ ' ' }}
    </template>
  </component>
</template>
