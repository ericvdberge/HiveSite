<script setup lang="ts">
// The "Remove block" confirm (block-editor.md, Remove; after delete-confirm.md). Local only, so
// it has no busy state.
import { ref } from 'vue'
import StudioDialog from './StudioDialog.vue'

defineProps<{ position: number; name: string }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const dialog = ref<InstanceType<typeof StudioDialog> | null>(null)
defineExpose({ dismiss: () => dialog.value?.dismiss() })
</script>

<template>
    <StudioDialog
        ref="dialog"
        title-id="remove-title"
        body-id="remove-body"
        @cancel="emit('cancel')"
    >
        <template #title>Remove block {{ position }}, "{{ name }}"?</template>
        <p>
            This removes the block and everything in it from the page. It is gone for good when you
            save.
        </p>
        <p class="hs-dialog__aside">Releases you have already published keep their copy.</p>
        <template #actions>
            <button
                type="button"
                class="hs-button hs-button--secondary"
                data-autofocus
                @click="emit('cancel')"
            >
                Cancel
            </button>
            <button type="button" class="hs-button hs-button--danger" @click="emit('confirm')">
                Remove block
            </button>
        </template>
    </StudioDialog>
</template>
