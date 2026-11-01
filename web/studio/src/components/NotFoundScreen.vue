<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ScreenHead from './ScreenHead.vue'

// Codes from the API that mean "this does not exist". The studio shows its own words.
const props = defineProps<{
    code: 'site_not_found' | 'page_not_found'
    /** Where "Back to pages" goes, when the screen knows the site. */
    pagesTo?: string
}>()

const copy = computed(() =>
    props.code === 'site_not_found'
        ? {
              title: "We can't find that site",
              line: 'It may have been removed, or the link may be wrong.',
              action: 'Back to your sites',
              to: '/',
          }
        : {
              title: "We can't find that page",
              line: 'It may have been deleted, or the link may be wrong.',
              action: props.pagesTo ? 'Back to pages' : 'Back to your sites',
              to: props.pagesTo ?? '/',
          },
)
</script>

<template>
    <section class="hs-not-found">
        <ScreenHead eyebrow="Not found" :title="copy.title" />
        <p class="hs-not-found__line">{{ copy.line }}</p>
        <RouterLink class="hs-button" :to="copy.to">{{ copy.action }}</RouterLink>
    </section>
</template>

<style scoped>
.hs-not-found__line {
    max-inline-size: var(--hs-layout-measure);
    margin-block-end: var(--hs-space-6);
    color: var(--hs-color-text-muted);
    font-size: var(--hs-font-size-body-l);
}
</style>
