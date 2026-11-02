<script setup lang="ts">
import { HERO_LIMITS } from '../../blocks/limits'
import LinkField from './LinkField.vue'
import TextField from './TextField.vue'

// `$defs/action`: a label and a link, sent as `label` and `href`.
defineProps<{
    id: string
    labelText: string
    href: string
    /** The label field's own label: "Button label" in the hero. */
    labelName: string
    labelError?: string
    hrefError?: string
    readonly?: boolean
}>()
defineEmits<{
    'update:labelText': [value: string]
    'update:href': [value: string]
    blur: [part: 'label' | 'href']
}>()
</script>

<template>
    <TextField
        :id="`${id}-label`"
        :label="labelName"
        required
        :max="HERO_LIMITS.ctaLabel"
        :model-value="labelText"
        :error="labelError"
        :readonly="readonly"
        @update:model-value="$emit('update:labelText', $event)"
        @blur="$emit('blur', 'label')"
    />
    <LinkField
        :id="`${id}-href`"
        label="Link"
        required
        :model-value="href"
        :error="hrefError"
        :readonly="readonly"
        @update:model-value="$emit('update:href', $event)"
        @blur="$emit('blur', 'href')"
    />
</template>
