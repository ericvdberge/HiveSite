<script setup lang="ts">
import { count } from '../../text'
import FieldFrame from './FieldFrame.vue'

defineProps<{
    id: string
    label: string
    hint?: string
    required?: boolean
    max: number
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
        :hint="hint"
        :required="required"
        :error="error"
        :length="count(model)"
        :max="max"
    >
        <template #default="{ describedBy, invalid }">
            <textarea
                :id="id"
                v-model="model"
                class="hs-control"
                rows="3"
                :readonly="readonly"
                :aria-invalid="invalid ? 'true' : undefined"
                :aria-describedby="describedBy"
                @blur="$emit('blur')"
            />
        </template>
    </FieldFrame>
</template>
