<script setup lang="ts">
// A radio group in a `fieldset` (block-editor.md, Radio group and checkbox). Options carry a word
// label, never the raw value. The forms after the hero use it.
defineProps<{
    id: string
    legend: string
    options: ReadonlyArray<{ value: string; label: string }>
    readonly?: boolean
    /** The error copy, without "Error:". */
    error?: string
}>()
// The value is a string; '' means none chosen.
const model = defineModel<string>({ required: true })
</script>

<template>
    <fieldset
        class="hs-radios"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
    >
        <legend>{{ legend }}</legend>
        <div class="hs-radios__options">
            <label v-for="(option, i) in options" :key="option.value" class="hs-radios__option">
                <input
                    :id="i === 0 ? id : undefined"
                    type="radio"
                    :name="id"
                    :value="option.value"
                    :checked="model === option.value"
                    :aria-disabled="readonly ? 'true' : undefined"
                    @click="(e: Event) => readonly && e.preventDefault()"
                    @change="model = option.value"
                />
                {{ option.label }}
            </label>
        </div>
        <p v-if="error" :id="`${id}-error`" class="hs-radios__error">
            <strong>Error:</strong> {{ error }}
        </p>
    </fieldset>
</template>

<style scoped>
.hs-radios {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

legend {
    margin-block-end: var(--hs-space-2);
    padding: 0;
    font-size: var(--hs-font-size-body-s);
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
}

.hs-radios__options {
    display: flex;
    flex-direction: column;
}

.hs-radios__option {
    display: flex;
    align-items: center;
    gap: var(--hs-space-3);
    min-block-size: var(--hs-control-min-height);
    font-size: var(--hs-font-size-body);
    color: var(--hs-color-text);
}

.hs-radios__error {
    margin-block-start: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-error);
}

.hs-radios__error strong {
    font-weight: var(--hs-font-weight-text-strong);
}

input[type='radio'] {
    flex: none;
    inline-size: var(--hs-space-5);
    block-size: var(--hs-space-5);
    margin: 0;
    accent-color: var(--hs-color-accent);
}

@media (width >= breakpoint(sm)) {
    .hs-radios__options {
        flex-direction: row;
        gap: var(--hs-space-4);
    }
}
</style>
