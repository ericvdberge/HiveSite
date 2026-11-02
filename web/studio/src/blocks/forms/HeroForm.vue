<script setup lang="ts">
import ActionFields from '../../components/fields/ActionFields.vue'
import ImageFields from '../../components/fields/ImageFields.vue'
import OptionalObject from '../../components/fields/OptionalObject.vue'
import TextAreaField from '../../components/fields/TextAreaField.vue'
import TextField from '../../components/fields/TextField.vue'
import { HERO_LIMITS } from '../limits'
import { getAttr, setAttr, setOptional, type Json, type WorkingBlock } from '../model'
import { fieldId } from '../ids'

// The hero form (block-editor.md, Forms by block type: Hero). It edits the working copy in place;
// the screen decides when an error shows.
const props = defineProps<{
    block: WorkingBlock
    blockId: string
    /** Errors to show, by path inside `attrs` ("title", "image.url"). */
    errors: Record<string, string>
    readonly: boolean
}>()
const emit = defineEmits<{ edit: [path: string]; blur: [path: string] }>()

function text(path: string): string {
    const value = getAttr(props.block, path)
    return typeof value === 'string' ? value : ''
}

function set(path: string, value: Json): void {
    setAttr(props.block, path, value)
    emit('edit', path)
}

function isOn(key: string): boolean {
    const value = getAttr(props.block, key)
    return typeof value === 'object' && value !== null
}

function toggle(key: string, blank: Json, on: boolean): void {
    setOptional(props.block, key, on, blank)
    emit('edit', key)
}

const id = (path: string) => fieldId(props.blockId, path)
</script>

<template>
    <div class="hs-hero-form">
        <TextField
            :id="id('title')"
            label="Title"
            hint="The page's main heading. Only the hero has one."
            required
            :max="HERO_LIMITS.title"
            :model-value="text('title')"
            :error="errors['title']"
            :readonly="readonly"
            @update:model-value="set('title', $event)"
            @blur="emit('blur', 'title')"
        />
        <TextAreaField
            :id="id('subtitle')"
            label="Subtitle"
            :max="HERO_LIMITS.subtitle"
            :model-value="text('subtitle')"
            :error="errors['subtitle']"
            :readonly="readonly"
            @update:model-value="set('subtitle', $event)"
            @blur="emit('blur', 'subtitle')"
        />
        <OptionalObject
            :id="id('image')"
            legend="Image"
            label="Show an image"
            :model-value="isOn('image')"
            :readonly="readonly"
            @update:model-value="toggle('image', { url: '', alt: '' }, $event)"
        >
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
        </OptionalObject>
        <OptionalObject
            :id="id('cta')"
            legend="Button"
            label="Show a button"
            :model-value="isOn('cta')"
            :readonly="readonly"
            @update:model-value="toggle('cta', { label: '', href: '' }, $event)"
        >
            <ActionFields
                :id="id('cta')"
                label-name="Button label"
                :label-text="text('cta.label')"
                :href="text('cta.href')"
                :label-error="errors['cta.label']"
                :href-error="errors['cta.href']"
                :readonly="readonly"
                @update:label-text="set('cta.label', $event)"
                @update:href="set('cta.href', $event)"
                @blur="emit('blur', `cta.${$event}`)"
            />
        </OptionalObject>
    </div>
</template>

<style scoped>
.hs-hero-form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    padding-block-start: var(--hs-space-5);
}
</style>
