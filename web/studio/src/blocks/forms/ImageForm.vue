<script setup lang="ts">
import ImageFields from '../../components/fields/ImageFields.vue'
import RadioGroup from '../../components/fields/RadioGroup.vue'
import TextAreaField from '../../components/fields/TextAreaField.vue'
import { fieldId } from '../ids'
import { IMAGE_LIMITS } from '../limits'
import { getAttr, setAttr, type Json, type WorkingBlock } from '../model'

// The image form (block-editor.md, Forms by block type: Image). The image fields sit directly in
// the form, not behind a checkbox: `image` is required.
const props = defineProps<{
    block: WorkingBlock
    blockId: string
    /** Errors to show, by path inside `attrs` ("image.url", "caption"). */
    errors: Record<string, string>
    readonly: boolean
}>()
const emit = defineEmits<{ edit: [path: string]; blur: [path: string] }>()

const WIDTHS = [
    { value: 'content', label: 'Text width' },
    { value: 'wide', label: 'Wide' },
    { value: 'full', label: 'Full width' },
]

function text(path: string, fallback = ''): string {
    const value = getAttr(props.block, path)
    return typeof value === 'string' ? value : fallback
}

function set(path: string, value: Json): void {
    setAttr(props.block, path, value)
    emit('edit', path)
}

const id = (path: string) => fieldId(props.blockId, path)
</script>

<template>
    <div class="hs-image-form">
        <ImageFields
            :id="id('image')"
            :url="text('image.url')"
            :alt="text('image.alt')"
            :url-error="errors['image.url']"
            :alt-error="errors['image.alt']"
            :readonly="readonly"
            @update:url="set('image.url', $event)"
            @update:alt="set('image.alt', $event)"
            @blur="emit('blur', `image.${$event}`)"
        />
        <TextAreaField
            :id="id('caption')"
            label="Caption"
            :max="IMAGE_LIMITS.caption"
            :model-value="text('caption')"
            :error="errors['caption']"
            :readonly="readonly"
            @update:model-value="set('caption', $event)"
            @blur="emit('blur', 'caption')"
        />
        <RadioGroup
            :id="id('width')"
            legend="Width"
            :options="WIDTHS"
            :model-value="text('width', 'content')"
            :readonly="readonly"
            @update:model-value="set('width', $event)"
        />
    </div>
</template>

<style scoped>
.hs-image-form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    padding-block-start: var(--hs-space-5);
}
</style>
