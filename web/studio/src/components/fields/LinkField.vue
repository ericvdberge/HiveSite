<script setup lang="ts">
import { count } from '../../text'
import { URL_MAX } from '../../blocks/limits'
import FieldFrame from './FieldFrame.vue'

// `$defs/link`: a text input, because `type="url"` would refuse a page path.
defineProps<{
    id: string
    label: string
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
        hint="A page path such as /about, an address starting with https://, or mailto: and an email address."
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
                type="text"
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
