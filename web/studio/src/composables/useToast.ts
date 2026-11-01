import { readonly, ref } from 'vue'

// One toast at a time. A new error replaces the text of the open toast.
// It closes only when the owner dismisses it or the failed action succeeds, never on a timer.
const message = ref<string | null>(null)

export const toastCopy = {
    network: "We can't reach Hivesite. Check your connection and try again.",
    server: 'Something went wrong on our side. Please try again.',
    saveFailed: (noun: string) => `We couldn't save the ${noun}. Your changes are still here.`,
}

export function showErrorToast(text: string): void {
    message.value = text
}

export function dismissToast(): void {
    message.value = null
}

export function useToast() {
    return { message: readonly(message), showErrorToast, dismissToast }
}
