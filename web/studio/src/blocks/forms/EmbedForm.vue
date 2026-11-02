<script setup lang="ts">
import RadioGroup from '../../components/fields/RadioGroup.vue'
import TextField from '../../components/fields/TextField.vue'
import UrlField from '../../components/fields/UrlField.vue'
import { embedUrlHint } from '../checks'
import { fieldId } from '../ids'
import { EMBED_LIMITS } from '../limits'
import { getAttr, setAttr, type Json, type WorkingBlock } from '../model'

// The embed form (block-editor.md, Forms by block type: Embed). The address hint follows the
// provider.
const props = defineProps<{
    block: WorkingBlock
    blockId: string
    /** Errors to show, by path inside `attrs` ("provider", "url", "title"). */
    errors: Record<string, string>
    readonly: boolean
}>()
const emit = defineEmits<{ edit: [path: string]; blur: [path: string] }>()

const PROVIDERS = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'vimeo', label: 'Vimeo' },
    { value: 'google_maps', label: 'Google Maps' },
]
const SHAPES = [
    { value: '16:9', label: 'Wide (16:9)' },
    { value: '4:3', label: 'Classic (4:3)' },
    { value: '1:1', label: 'Square (1:1)' },
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
    <div class="hs-embed-form">
        <RadioGroup
            :id="id('provider')"
            legend="Provider"
            :options="PROVIDERS"
            :model-value="text('provider')"
            :error="errors['provider']"
            :readonly="readonly"
            @update:model-value="set('provider', $event)"
        />
        <UrlField
            :id="id('url')"
            label="Address"
            :hint="embedUrlHint(text('provider'))"
            required
            :model-value="text('url')"
            :error="errors['url']"
            :readonly="readonly"
            @update:model-value="set('url', $event)"
            @blur="emit('blur', 'url')"
        />
        <TextField
            :id="id('title')"
            label="Title"
            hint="Says what the video or map shows, for people using a screen reader."
            required
            :max="EMBED_LIMITS.title"
            :model-value="text('title')"
            :error="errors['title']"
            :readonly="readonly"
            @update:model-value="set('title', $event)"
            @blur="emit('blur', 'title')"
        />
        <RadioGroup
            :id="id('aspect_ratio')"
            legend="Shape"
            :options="SHAPES"
            :model-value="text('aspect_ratio', '16:9')"
            :readonly="readonly"
            @update:model-value="set('aspect_ratio', $event)"
        />
    </div>
</template>

<style scoped>
.hs-embed-form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    padding-block-start: var(--hs-space-5);
}
</style>
