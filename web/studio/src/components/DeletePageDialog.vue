<script setup lang="ts">
import { computed, ref } from 'vue'
import StudioDialog from './StudioDialog.vue'

const props = defineProps<{
    title: string
    /** Title of the page that becomes home; set only when the home page is deleted and pages follow. */
    nextTitle?: string
    onlyPage: boolean
    busy: boolean
    failed: boolean
}>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const dialog = ref<InstanceType<typeof StudioDialog> | null>(null)

const lead = computed(() => {
    if (props.onlyPage) {
        return "This is the site's only page. The site will have no home page until you add one."
    }
    if (props.nextTitle !== undefined) {
        return `${props.title} is your home page. ${props.nextTitle} becomes the home page.`
    }
    return ''
})

function onCancel(): void {
    if (!props.busy) emit('cancel')
}

function onConfirm(): void {
    if (!props.busy) emit('confirm')
}

defineExpose({ dismiss: () => dialog.value?.dismiss() })
</script>

<template>
    <StudioDialog
        ref="dialog"
        title-id="del-title"
        body-id="del-body"
        :busy="busy"
        @cancel="emit('cancel')"
    >
        <template #title>Delete "{{ title }}"?</template>
        <p v-if="lead" class="hs-dialog__lead">{{ lead }}</p>
        <p>This deletes the page and all its blocks. It can't be undone.</p>
        <p class="hs-dialog__aside">Releases you have already published keep their copy.</p>
        <template #after>
            <p v-if="failed" class="hs-form-message hs-dialog__message" role="alert">
                <strong>Error:</strong> We couldn't delete the page. Please try again.
            </p>
        </template>
        <template #actions>
            <button
                type="button"
                class="hs-button hs-button--secondary"
                data-autofocus
                :aria-disabled="busy ? 'true' : undefined"
                @click="onCancel"
            >
                Cancel
            </button>
            <button
                type="button"
                class="hs-button hs-button--danger"
                :aria-disabled="busy ? 'true' : undefined"
                @click="onConfirm"
            >
                {{ busy ? 'Deleting…' : 'Delete page' }}
            </button>
        </template>
    </StudioDialog>
</template>
