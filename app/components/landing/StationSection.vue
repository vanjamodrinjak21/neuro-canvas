<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    num: string
    eyebrow: string
    title: string
    body: string
    chip?: string
    side?: 'left' | 'right'
  }>(),
  { side: 'left', chip: undefined },
)
</script>

<template>
  <section :id="id" class="section station" :class="`station--${side}`">
    <div class="station__inner">
      <div class="station__content survey-frame">
        <p class="station__eyebrow">
          <span class="num">NODE {{ num }}</span> · {{ eyebrow }}
          <span class="station__elev" aria-hidden="true">DEPTH {{ num }}40</span>
        </p>
        <LandingRevealText :text="title" as="h2" class="station__title" />
        <p class="station__body">{{ body }}</p>
        <code v-if="chip" class="station__chip">{{ chip }}</code>
      </div>
    </div>
  </section>
</template>
