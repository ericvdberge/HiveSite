import { ref } from 'vue'

// Set by the page form after a 201, read once by the page list (page-list.md, After add).
export interface AddedPage {
    id: string
    title: string
}

const added = ref<AddedPage | null>(null)

export function rememberAddedPage(page: AddedPage): void {
    added.value = page
}

/** Returns the page just added, if any, and forgets it. */
export function takeAddedPage(): AddedPage | null {
    const page = added.value
    added.value = null
    return page
}
