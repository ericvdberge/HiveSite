<script setup lang="ts">
// The "Add a block" dialog (block-editor.md, Add block dialog): a type and a place.
import { computed, ref } from 'vue'
import FieldFrame from './fields/FieldFrame.vue'
import StudioDialog from './StudioDialog.vue'

export interface OfferedType {
    type: string
    name: string
    description: string
}

const props = defineProps<{
    /** The types to offer, in API-003 order: those with a form and at version 1. */
    types: OfferedType[]
    /** Names of the blocks now on the page, in order, for "After 1. Hero". */
    blockNames: string[]
    hasHero: boolean
}>()
// `index` is where the block goes in the list: 0 is the start, the block count is the end.
const emit = defineEmits<{ cancel: []; confirm: [type: string, index: number] }>()

const dialog = ref<InstanceType<typeof StudioDialog> | null>(null)

const first = computed(() => {
    const want = props.hasHero ? 'rich_text' : 'hero'
    return props.types.find((t) => t.type === want)?.type ?? props.types[0]?.type ?? ''
})
const chosen = ref(first.value)
const place = ref('end')

/** The empty state has nothing to place against. */
const showPlace = computed(() => props.blockNames.length > 0)
const showHeroNote = computed(() => chosen.value === 'hero' && props.hasHero)

function index(): number {
    if (place.value === 'end') return props.blockNames.length
    if (place.value === 'start') return 0
    return Number(place.value.slice('after:'.length))
}

function onConfirm(): void {
    if (chosen.value) emit('confirm', chosen.value, index())
}

defineExpose({ dismiss: () => dialog.value?.dismiss() })
</script>

<template>
    <StudioDialog ref="dialog" title-id="add-title" @cancel="emit('cancel')">
        <template #title>Add a block</template>
        <form id="add-block-form" class="hs-add" @submit.prevent="onConfirm">
            <fieldset class="hs-add__types">
                <legend>Block type</legend>
                <label
                    v-for="t in types"
                    :key="t.type"
                    class="hs-choice"
                    :data-checked="chosen === t.type"
                >
                    <input
                        v-model="chosen"
                        type="radio"
                        name="type"
                        :value="t.type"
                        :data-autofocus="t.type === first ? '' : undefined"
                    />
                    <span class="hs-choice__name">{{ t.name }}</span>
                    <span class="hs-choice__desc">{{ t.description }}</span>
                </label>
            </fieldset>
            <FieldFrame v-if="showPlace" id="add-place" label="Place">
                <template #default="{ describedBy }">
                    <select
                        id="add-place"
                        v-model="place"
                        class="hs-control"
                        :aria-describedby="describedBy || undefined"
                    >
                        <option value="end">At the end</option>
                        <option value="start">At the start</option>
                        <option v-for="(name, i) in blockNames" :key="i" :value="`after:${i + 1}`">
                            After {{ i + 1 }}. {{ name }}
                        </option>
                    </select>
                </template>
            </FieldFrame>
            <p v-if="showHeroNote" class="hs-note hs-add__note">
                <strong>Note:</strong> This page already has a hero. Only the first hero's title
                becomes the page heading.
            </p>
        </form>
        <template #actions>
            <button type="button" class="hs-button hs-button--secondary" @click="emit('cancel')">
                Cancel
            </button>
            <button type="submit" form="add-block-form" class="hs-button">Add block</button>
        </template>
    </StudioDialog>
</template>

<style scoped>
.hs-add {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
}

.hs-add__types {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.hs-add__types legend {
    margin-block-end: var(--hs-space-2);
    padding: 0;
    font-size: var(--hs-font-size-body-s);
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-choice {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--hs-space-3);
    align-items: center;
    min-block-size: var(--hs-control-min-height);
    padding: var(--hs-space-3);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border);
    border-radius: var(--hs-radius-control);
    cursor: pointer;
}

/* Checked: a thicker edge and the radio dot, so the choice is not marked by color alone. */
.hs-choice[data-checked='true'] {
    padding: calc(
        var(--hs-space-3) - var(--hs-border-width-focus) + var(--hs-border-width-hairline)
    );
    border-width: var(--hs-border-width-focus);
    border-color: var(--hs-color-accent);
}

.hs-choice input {
    grid-row: 1 / span 2;
    inline-size: var(--hs-space-5);
    block-size: var(--hs-space-5);
    margin: 0;
    accent-color: var(--hs-color-accent);
}

.hs-choice__name {
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
}

.hs-choice__desc {
    grid-column: 2;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

.hs-add__note {
    margin: 0;
}
</style>
