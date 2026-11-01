<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{ message: string | null }>()
const emit = defineEmits<{ dismiss: [] }>()

const el = ref<HTMLElement | null>(null)
// Keeps the last text so the toast can fade out without the words vanishing first.
const text = ref(props.message ?? '')
const open = ref(false)

function sync(message: string | null) {
    if (message !== null) text.value = message
    const shouldOpen = message !== null
    if (shouldOpen === open.value) return
    open.value = shouldOpen
    // The popover API sits in the browser's top layer; older engines and jsdom lack it.
    // There, the @supports fallback in the styles shows and hides the toast from data-open.
    try {
        if (shouldOpen) el.value?.showPopover()
        else el.value?.hidePopover()
    } catch {
        /* the data-open attribute still drives the state */
    }
}

watch(
    () => props.message,
    (message) => sync(message),
    { flush: 'post' },
)
onMounted(() => sync(props.message))
</script>

<template>
    <div
        ref="el"
        class="hs-toast"
        popover="manual"
        role="alert"
        :data-open="open"
        @keydown.esc="emit('dismiss')"
    >
        <p>
            <strong class="hs-toast__label">Error:</strong>
            {{ text }}
        </p>
        <button type="button" class="hs-button hs-button--quiet" @click="emit('dismiss')">
            Dismiss
        </button>
    </div>
</template>

<style scoped>
.hs-toast {
    inset: auto;
    inset-block-end: var(--hs-space-5);
    inset-inline-end: var(--hs-space-5);
    margin: 0;
    max-inline-size: var(--hs-layout-dialog-width);
    align-items: center;
    gap: var(--hs-space-4);
    padding: var(--hs-space-4) var(--hs-space-5);
    background: var(--hs-color-surface);
    border: var(--hs-border-width-hairline) solid var(--hs-color-error);
    border-radius: var(--hs-radius-card);
    color: var(--hs-color-text);
    font-size: var(--hs-font-size-body-s);
    line-height: var(--hs-line-height-body);
    /* Leaves with a fade. */
    opacity: 0;
    transition:
        opacity var(--hs-motion-duration-base) var(--hs-motion-easing-standard),
        display var(--hs-motion-duration-base) allow-discrete,
        overlay var(--hs-motion-duration-base) allow-discrete;
}

.hs-toast:popover-open {
    display: flex;
    opacity: 1;
    /* Enters with the fade and rise. */
    transition:
        opacity var(--hs-motion-duration-base) var(--hs-motion-easing-enter),
        transform var(--hs-motion-duration-base) var(--hs-motion-easing-enter);
}

@starting-style {
    .hs-toast:popover-open {
        opacity: 0;
        transform: translateY(var(--hs-motion-rise-distance));
    }
}

.hs-toast__label {
    color: var(--hs-color-error);
    font-weight: var(--hs-font-weight-text-strong);
}

/* No popover support: data-open drives a fixed-position toast. */
@supports not selector(:popover-open) {
    .hs-toast {
        position: fixed;
        display: none;
    }

    .hs-toast[data-open='true'] {
        display: flex;
        opacity: 1;
    }
}

@media (width < breakpoint(sm)) {
    .hs-toast {
        inset-inline: var(--hs-space-4);
        max-inline-size: none;
    }
}
</style>
