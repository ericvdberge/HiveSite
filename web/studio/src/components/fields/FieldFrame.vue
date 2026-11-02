<script setup lang="ts">
import { computed } from 'vue'

// The shell field rule (shell.md, Field): label, hint, control, then the error and the counter.
// The control comes in the slot with the ids it must carry.
const props = defineProps<{
    id: string
    label: string
    hint?: string
    required?: boolean
    /** The error copy, without "Error:". */
    error?: string
    /** Code points after trimming, with `max`, for the counter "n of max". */
    length?: number
    max?: number
}>()

const describedBy = computed(() =>
    [
        props.hint ? `${props.id}-hint` : '',
        props.max !== undefined ? `${props.id}-count` : '',
        props.error ? `${props.id}-error` : '',
    ]
        .filter(Boolean)
        .join(' '),
)
const over = computed(() => props.max !== undefined && (props.length ?? 0) > props.max)
</script>

<template>
    <div class="hs-field">
        <label :for="id"
            >{{ label }} <span v-if="required" class="hs-field__req">(required)</span></label
        >
        <p v-if="hint" :id="`${id}-hint`" class="hs-field__hint">{{ hint }}</p>
        <slot :described-by="describedBy" :invalid="!!error" />
        <div class="hs-field__foot">
            <p v-if="error" :id="`${id}-error`" class="hs-field__error">
                <strong>Error:</strong> {{ error }}
            </p>
            <p
                v-if="max !== undefined"
                :id="`${id}-count`"
                class="hs-counter"
                :class="{ 'hs-counter--over': over }"
            >
                {{ length ?? 0 }} of {{ max }}
            </p>
        </div>
    </div>
</template>

<style>
.hs-field {
    display: flex;
    flex-direction: column;
}

.hs-field > label {
    margin-block-end: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
}

.hs-field__req {
    font-weight: var(--hs-font-weight-text);
    color: var(--hs-color-text-muted);
}

.hs-field__hint {
    margin-block-end: var(--hs-space-1);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

.hs-control {
    inline-size: 100%;
    min-block-size: var(--hs-control-min-height);
    padding: var(--hs-control-padding-y) var(--hs-control-padding-x);
    background: var(--hs-color-surface-sunk);
    border: var(--hs-border-width-control) solid var(--hs-color-border-strong);
    border-radius: var(--hs-radius-control);
    font-family: var(--hs-font-text);
    font-size: var(--hs-font-size-body);
    color: var(--hs-color-text);
}

textarea.hs-control {
    resize: vertical;
}

.hs-control:hover {
    border-color: var(--hs-color-text-muted);
}

.hs-control:focus {
    border-color: var(--hs-color-focus);
}

.hs-control[aria-invalid='true'] {
    border-color: var(--hs-color-error);
}

.hs-field__foot {
    display: flex;
    justify-content: space-between;
    gap: var(--hs-space-3);
}

.hs-field__error {
    margin-block-start: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-error);
    animation: hs-field-fade var(--hs-motion-duration-base) var(--hs-motion-easing-standard) both;
}

.hs-field__error strong {
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-counter {
    margin-block-start: var(--hs-space-2);
    margin-inline-start: auto;
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    letter-spacing: var(--hs-letter-spacing-body);
    color: var(--hs-color-text-muted);
}

.hs-counter--over {
    color: var(--hs-color-error);
}

@keyframes hs-field-fade {
    from {
        opacity: 0;
    }
}
</style>
