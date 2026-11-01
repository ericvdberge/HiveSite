<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { play } from '../motion'

const props = defineProps<{
    title: string
    /** Title of the page that becomes home; set only when the home page is deleted and pages follow. */
    nextTitle?: string
    onlyPage: boolean
    busy: boolean
    failed: boolean
}>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)

const lead = computed(() => {
    if (props.onlyPage) {
        return "This is the site's only page. The site will have no home page until you add one."
    }
    if (props.nextTitle !== undefined) {
        return `${props.title} is your home page. ${props.nextTitle} becomes the home page.`
    }
    return ''
})

onMounted(() => {
    // showModal puts the dialog in the top layer and makes the page behind inert.
    // jsdom lacks it; the open attribute is then the fallback.
    if (typeof dialog.value?.showModal === 'function') dialog.value.showModal()
    else dialog.value?.setAttribute('open', '')
    cancelButton.value?.focus()
})

// Escape does nothing until the call ends.
function onCancel(): void {
    if (!props.busy) emit('cancel')
}

function onConfirm(): void {
    if (!props.busy) emit('confirm')
}

/** Fades the panel out over motion.duration_base; the parent removes the dialog afterwards. */
async function dismiss(): Promise<void> {
    if (dialog.value) await play(dialog.value, [{ opacity: 1 }, { opacity: 0 }])
}
defineExpose({ dismiss })
</script>

<template>
    <dialog
        ref="dialog"
        class="hs-dialog"
        aria-labelledby="del-title"
        aria-describedby="del-body"
        @cancel.prevent="onCancel"
    >
        <h2 id="del-title">Delete "{{ title }}"?</h2>
        <div id="del-body">
            <p v-if="lead" class="hs-dialog__lead">{{ lead }}</p>
            <p>This deletes the page and all its blocks. It can't be undone.</p>
            <p class="hs-dialog__aside">Releases you have already published keep their copy.</p>
        </div>
        <p v-if="failed" class="hs-form-message hs-dialog__message" role="alert">
            <strong>Error:</strong> We couldn't delete the page. Please try again.
        </p>
        <div class="hs-dialog__actions">
            <button
                ref="cancelButton"
                type="button"
                class="hs-button hs-button--secondary"
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
        </div>
    </dialog>
</template>
