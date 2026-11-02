<script setup lang="ts">
// An optional object (block-editor.md, Optional object): a checkbox that shows or hides the
// object's fields. The parent keeps the typed values while it is unchecked.
defineProps<{
    id: string
    /** The group name for assistive technology, e.g. "Image". */
    legend: string
    /** The checkbox label, e.g. "Show an image". */
    label: string
    readonly?: boolean
}>()
const checked = defineModel<boolean>({ required: true })

function onChange(event: Event): void {
    checked.value = (event.target as HTMLInputElement).checked
}
</script>

<template>
    <fieldset class="hs-optional">
        <legend class="hs-visually-hidden">{{ legend }}</legend>
        <label class="hs-optional__toggle">
            <input
                type="checkbox"
                :checked="checked"
                :aria-controls="`${id}-fields`"
                :aria-disabled="readonly ? 'true' : undefined"
                @click="(e: Event) => readonly && e.preventDefault()"
                @change="onChange"
            />
            {{ label }}
        </label>
        <div :id="`${id}-fields`" class="hs-optional__fields" :hidden="!checked">
            <slot />
        </div>
    </fieldset>
</template>

<style scoped>
.hs-optional {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.hs-optional__toggle {
    display: flex;
    align-items: center;
    gap: var(--hs-space-3);
    min-block-size: var(--hs-control-min-height);
    font-size: var(--hs-font-size-body);
    color: var(--hs-color-text);
}

input[type='checkbox'] {
    flex: none;
    inline-size: var(--hs-control-min-height);
    block-size: var(--hs-control-min-height);
    margin: 0;
    accent-color: var(--hs-color-accent);
}

.hs-optional__fields {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    margin-block-start: var(--hs-space-3);
    padding-inline-start: var(--hs-space-4);
    border-inline-start: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-optional__fields[hidden] {
    display: none;
}
</style>
