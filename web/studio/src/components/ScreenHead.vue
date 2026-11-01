<script lang="ts">
import type { Router } from 'vue-router'

// Routers whose first screen has already shown. Focus moves to the h1 only after that,
// so the first page load keeps the browser's own tab order (skip link first).
const firstScreenShown = new WeakSet<Router>()
</script>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ title: string; eyebrow?: string; documentTitle?: string }>()
const heading = ref<HTMLElement | null>(null)
const router = useRouter()

const APP_NAME = 'Hivesite Studio'

// The document title follows the h1.
watchEffect(() => {
    if (props.documentTitle) {
        document.title = props.documentTitle
        return
    }
    document.title = props.title === APP_NAME ? APP_NAME : `${props.title} · ${APP_NAME}`
})
onMounted(() => {
    if (firstScreenShown.has(router)) heading.value?.focus()
    else firstScreenShown.add(router)
})
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
