<script setup lang="ts">
import { HERO_LIMITS } from '../../blocks/limits'
import TextAreaField from './TextAreaField.vue'
import UrlField from './UrlField.vue'

// `$defs/image`: the address and the alt text. `alt` is always sent, as "" when empty.
defineProps<{
    id: string
    url: string
    alt: string
    urlError?: string
    altError?: string
    readonly?: boolean
}>()
defineEmits<{
    'update:url': [value: string]
    'update:alt': [value: string]
    blur: [part: 'url' | 'alt']
}>()
</script>

<template>
    <UrlField
        :id="`${id}-url`"
        label="Image address"
        required
        :model-value="url"
        :error="urlError"
        :readonly="readonly"
        @update:model-value="$emit('update:url', $event)"
        @blur="$emit('blur', 'url')"
    />
    <TextAreaField
        :id="`${id}-alt`"
        label="Alt text"
        hint="Describe the image for people who can't see it. Leave empty if it is only decoration."
        :max="HERO_LIMITS.imageAlt"
        :model-value="alt"
        :error="altError"
        :readonly="readonly"
        @update:model-value="$emit('update:alt', $event)"
        @blur="$emit('blur', 'alt')"
    />
</template>
