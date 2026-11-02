<script setup lang="ts">
import { count } from '../../text'
import { URL_MAX } from '../../blocks/limits'
import FieldFrame from './FieldFrame.vue'

// `$defs/url`: an https:// address (block-editor.md, Field controls by schema type).
defineProps<{
    id: string
    label: string
    hint?: string
    required?: boolean
    error?: string
    readonly?: boolean
}>()
const model = defineModel<string>({ required: true })
defineEmits<{ blur: [] }>()
</script>

<template>
    <FieldFrame
        :id="id"
        :label="label"
        :hint="hint ?? 'Starts with https://.'"
        :required="required"
        :error="error"
        :length="count(model)"
        :max="URL_MAX"
    >
        <template #default="{ describedBy, invalid }">
            <input
                :id="id"
                v-model="model"
                class="hs-control"
                type="url"
                inputmode="url"
                autocapitalize="none"
                :spellcheck="false"
                :readonly="readonly"
                :aria-invalid="invalid ? 'true' : undefined"
                :aria-describedby="describedBy"
                @blur="$emit('blur')"
            />
        </template>
    </FieldFrame>
</template>
