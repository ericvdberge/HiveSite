<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'

const props = defineProps<{ title: string; eyebrow?: string }>()
const heading = ref<HTMLElement | null>(null)

// Screen change: the document title follows the h1, and focus moves to it.
watchEffect(() => {
    document.title = `${props.title} · Hivesite Studio`
})
onMounted(() => heading.value?.focus())
</script>

<template>
    <header class="hs-screen-head">
        <p v-if="eyebrow" class="hs-eyebrow">{{ eyebrow }}</p>
        <h1 ref="heading" tabindex="-1">{{ title }}</h1>
        <p v-if="$slots.lead" class="hs-screen-head__lead"><slot name="lead" /></p>
        <div v-if="$slots.actions" class="hs-screen-head__actions"><slot name="actions" /></div>
    </header>
</template>

<style scoped>
.hs-screen-head {
    display: flex;
    flex-direction: column;
    margin-block-end: var(--hs-space-6);
}

.hs-eyebrow {
    margin-block-end: var(--hs-space-2);
}

h1 {
    font-family: var(--hs-font-display);
    font-size: var(--hs-font-size-display-l);
    font-weight: var(--hs-font-weight-display);
    line-height: var(--hs-line-height-display);
    letter-spacing: var(--hs-letter-spacing-display);
    color: var(--hs-color-text);
}

.hs-screen-head__lead {
    margin-block-start: var(--hs-space-3);
    color: var(--hs-color-text-muted);
}

/* Under the heading, full width, below sm. */
.hs-screen-head__actions {
    display: flex;
    flex-direction: column;
    margin-block-start: var(--hs-space-4);
}

@media (width >= breakpoint(md)) {
    .hs-screen-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: var(--hs-space-5);
    }

    .hs-screen-head > :not(.hs-screen-head__actions) {
        grid-column: 1;
    }

    .hs-screen-head__actions {
        grid-column: 2;
        grid-row: 1 / span 3;
        flex-direction: row;
        align-self: start;
        margin-block-start: 0;
    }
}
</style>
