<script setup lang="ts">
// One block of the list: a head (position, name, summary, flag) with a toggle for the body.
// Opening one block never closes another. The screen owns the open state, so it can open
// every block with an error.
defineProps<{
    /** The id prefix, unique per block on the screen. */
    blockId: string
    position: number
    name: string
    /** One line of what the block holds; left out for a block the studio does not know. */
    summary?: string
    /** A block the studio has no form for: the body says so. */
    unsupported?: boolean
    open: boolean
    /** The block has an error: "Error: needs attention" shows even when the block is closed. */
    flagged?: boolean
}>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
</script>

<template>
    <li class="hs-block" :aria-labelledby="`${blockId}-name`">
        <div class="hs-block__head">
            <h2 class="hs-block__title">
                <button
                    :id="`${blockId}-name`"
                    type="button"
                    class="hs-block__toggle"
                    :aria-expanded="open ? 'true' : 'false'"
                    :aria-controls="`${blockId}-body`"
                    @click="emit('update:open', !open)"
                >
                    <span class="hs-block__pos">{{ position }}</span>
                    <span class="hs-block__name">{{ name }}</span>
                    <span class="hs-block__chevron" :data-open="open" aria-hidden="true">▾</span>
                </button>
            </h2>
            <p v-if="summary" class="hs-block__summary">{{ summary }}</p>
            <p v-if="flagged" class="hs-block__flag"><strong>Error:</strong> needs attention</p>
        </div>
        <Transition name="hs-block-body">
            <div v-show="open" :id="`${blockId}-body`" class="hs-block__body">
                <p v-if="unsupported" class="hs-block__note">
                    <strong>Note:</strong> This studio can't edit this block yet. It stays as it is
                    when you save.
                </p>
                <slot />
            </div>
        </Transition>
    </li>
</template>

<style scoped>
.hs-block {
    background: var(--hs-color-surface);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border);
    border-radius: var(--hs-radius-card);
}

.hs-block__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--hs-space-3);
    padding-block: var(--hs-space-3);
    padding-inline: var(--hs-space-4);
}

.hs-block__title {
    margin: 0;
    font-family: var(--hs-font-text);
    font-size: var(--hs-font-size-body);
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-block__toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--hs-space-2);
    min-block-size: var(--hs-control-min-height);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--hs-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
}

.hs-block__toggle:hover .hs-block__name {
    text-decoration: underline;
}

.hs-block__pos {
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    font-weight: var(--hs-font-weight-label);
    letter-spacing: var(--hs-letter-spacing-label);
    color: var(--hs-color-accent-text);
}

.hs-block__chevron {
    color: var(--hs-color-text-muted);
}

.hs-block__chevron[data-open='true'] {
    transform: rotate(180deg);
}

/* Two lines at most, clipped with an ellipsis: the one place the studio cuts text. */
.hs-block__summary {
    flex: 1 1 var(--hs-space-8);
    min-inline-size: 0;
    max-inline-size: var(--hs-layout-measure);
    margin: 0;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
}

.hs-block__flag {
    margin: 0;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-error);
}

.hs-block__flag strong {
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-block__body {
    padding-inline: var(--hs-space-4);
    padding-block-end: var(--hs-space-5);
    border-block-start: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

/* The body fades in and out as the one moving shape. Reduced motion swaps the duration token. */
.hs-block-body-enter-active,
.hs-block-body-leave-active {
    transition: opacity var(--hs-motion-duration-base) var(--hs-motion-easing-standard);
}

.hs-block-body-enter-from,
.hs-block-body-leave-to {
    opacity: 0;
}

.hs-block__note {
    max-inline-size: var(--hs-layout-measure);
    margin: var(--hs-space-4) 0 0;
    padding: var(--hs-space-4);
    border-inline-start: var(--hs-border-width-focus) solid var(--hs-color-rule);
    color: var(--hs-color-text);
}

.hs-block__note strong {
    color: var(--hs-color-accent-text);
    font-weight: var(--hs-font-weight-text-strong);
}
</style>
