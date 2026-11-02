<script setup lang="ts">
// The shell dialog (shell.md, Dialog) on the native <dialog>: a title, a body and actions.
// Opened with showModal(), so focus stays inside and the page behind is inert. Focus goes to the
// element marked `data-autofocus` on open (the parent returns it on close). While `busy`, Escape
// does nothing until the call ends.
import { onMounted, ref } from 'vue'
import { play } from '../motion'

const props = withDefaults(
    defineProps<{
        titleId: string
        bodyId?: string
        busy?: boolean
    }>(),
    { bodyId: undefined, busy: false },
)
const emit = defineEmits<{ cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

function open(): void {
    // jsdom lacks showModal; the open attribute is then the fallback.
    if (typeof dialog.value?.showModal === 'function') dialog.value.showModal()
    else dialog.value?.setAttribute('open', '')
}

onMounted(() => {
    open()
    dialog.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
})

function onCancel(): void {
    if (!props.busy) emit('cancel')
}

/** Backstop: the browser closed the dialog by itself (a repeated Escape can skip `cancel`). */
function onClose(): void {
    if (props.busy) open()
    else emit('cancel')
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
        :aria-labelledby="titleId"
        :aria-describedby="bodyId"
        @cancel.prevent="onCancel"
        @keydown.esc.prevent="onCancel"
        @close="onClose"
    >
        <h2 :id="titleId"><slot name="title" /></h2>
        <div :id="bodyId"><slot /></div>
        <slot name="after" />
        <div class="hs-dialog__actions"><slot name="actions" /></div>
    </dialog>
</template>
