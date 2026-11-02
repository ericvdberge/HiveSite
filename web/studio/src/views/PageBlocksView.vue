<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    shallowRef,
    watch,
    type Ref,
} from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BlockPanel from '../components/BlockPanel.vue'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import ScreenHead from '../components/ScreenHead.vue'
import {
    api,
    fieldKey,
    getPageBlocks,
    isApiError,
    listAllBlockTypes,
    putPageBlocks,
    type BlocksDocumentDto,
    type components,
} from '../api'
import {
    documentToSend,
    type WorkingBlock,
    sameDocument,
    toWorkingCopy,
    type BlocksDocument,
    type TypeVersions,
    type WorkingCopy,
} from '../blocks/model'
import { fieldId } from '../blocks/ids'
import { registry } from '../blocks/registry'
import { blockSummary } from '../blocks/summary'
import { clearSiteNav, setSiteNav } from '../composables/useSiteNav'
import { dismissToast, showErrorToast, toastCopy } from '../composables/useToast'

type Site = components['schemas']['SiteDto']
type PageItem = components['schemas']['PageDto']

/** Blocks per page (API-004, Limits). */
const BLOCK_LIMIT = 40
/** With more blocks than this, every block starts closed. */
const OPEN_ALL_UP_TO = 3

const route = useRoute()
const pageId = String(route.params.id)

const phase = ref<'loading' | 'ready' | 'failed' | 'missing'>('loading')
const page = ref<PageItem | null>(null)
const site = ref<Site | null>(null)
const names = ref(new Map<string, string>())
// The last saved document and its ETag, and the copy the screen works on.
const saved = shallowRef<BlocksDocument | null>(null)
const etag = ref<string | null>(null)
// Deeply reactive, so the forms edit it in place. Typed by hand: Json is too deep for UnwrapRef.
const copy = ref({ blocks: [] }) as Ref<WorkingCopy>
const versions = shallowRef<TypeVersions>(new Map())
const openBlocks = reactive(new Set<string>())
const sending = ref(false)
// "Blocks saved." or "No changes to save.", until the next edit.
const notice = ref('')
// A message for the whole form, or for a client-error summary with links to the blocks.
const formMessage = ref<{ text: string; links: Array<{ label: string; target: string }> } | null>(
    null,
)
const messageEl = ref<HTMLElement | null>(null)
// Keys are `${block key}|${path inside attrs}`. A client error shows once its field was typed in
// and left, or after a save; a server error stays until the field changes.
const typed = reactive(new Set<string>())
const touched = reactive(new Set<string>())
const serverErrors = reactive(new Map<string, string>())

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const pagesPath = computed(() => (page.value ? `/sites/${page.value.site_id}/pages` : '/'))
const documentTitle = computed(() =>
    page.value ? `Blocks · ${page.value.title} · Hivesite Studio` : undefined,
)
const heading = computed(() => (page.value ? `Blocks of ${page.value.title}` : 'Blocks'))
const countText = computed(() => `${copy.value.blocks.length} of ${BLOCK_LIMIT} blocks`)
const unsaved = computed(
    () => saved.value !== null && !sameDocument(documentToSend(copy.value), saved.value),
)
const statusText = computed(() => {
    if (phase.value === 'loading') return 'Loading…'
    if (phase.value === 'failed') return `Error: ${LOAD_ERROR}`
    if (sending.value) return 'Saving…'
    return unsaved.value ? 'Unsaved changes' : notice.value
})
watch(unsaved, (now) => {
    if (now) notice.value = ''
})

const entryOf = (block: WorkingBlock) => (block.readOnly ? undefined : registry[block.node.type])
const keyOf = (block: WorkingBlock, path: string) => `${block.key}|${path}`

/** Client errors of every block as they would be sent, by path inside `attrs`, in field order. */
const clientErrors = computed(() => {
    const sent = documentToSend(copy.value).content
    return copy.value.blocks.map((block, i) => {
        const node = sent[i]
        return node ? (entryOf(block)?.check(node) ?? {}) : {}
    })
})

/** The errors to show for a block: server errors, and client errors of fields that were visited. */
function shownErrors(index: number): Record<string, string> {
    const block = copy.value.blocks[index]
    if (!block) return {}
    const out: Record<string, string> = {}
    for (const [path, error] of Object.entries(clientErrors.value[index] ?? {})) {
        if (touched.has(keyOf(block, path))) out[path] = error
    }
    const prefix = `${block.key}|`
    for (const [key, error] of serverErrors) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = error
    }
    return out
}

function onEdit(block: WorkingBlock, path: string): void {
    typed.add(keyOf(block, path))
    serverErrors.delete(keyOf(block, path))
}

function onBlur(block: WorkingBlock, path: string): void {
    if (typed.has(keyOf(block, path))) touched.add(keyOf(block, path))
}

const LOAD_ERROR = "We couldn't load the blocks of this page."

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

async function load(): Promise<void> {
    phase.value = 'loading'
    const signal = controller.signal
    // The three at once; the screen shows only when all three have answered.
    const results = await Promise.allSettled([
        getPageBlocks(pageId, signal),
        api.GET('/pages/{id}', { params: { path: { id: pageId } }, signal }),
        listAllBlockTypes(signal),
    ])
    if (signal.aborted) return
    if (results.some((r) => r.status === 'rejected')) {
        const reasons = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))
        // Sign-in owns a 401 (shell.md).
        if (reasons.some((e) => isApiError(e) && e.code === 'unauthenticated')) return
        phase.value = reasons.some((e) => isApiError(e) && e.code === 'page_not_found')
            ? 'missing'
            : 'failed'
        return
    }
    const [blocksResult, pageResult, typesResult] = results
    if (
        blocksResult.status !== 'fulfilled' ||
        pageResult.status !== 'fulfilled' ||
        typesResult.status !== 'fulfilled'
    ) {
        phase.value = 'failed'
        return
    }
    const blocks = blocksResult.value
    const types = typesResult.value
    const pageData = pageResult.value.data
    if (!pageData) {
        phase.value = 'failed'
        return
    }
    try {
        const { data } = await api.GET('/sites/{id}', {
            params: { path: { id: pageData.site_id } },
            signal,
        })
        if (signal.aborted) return
        if (!data) throw new Error('Empty response')
        const document = blocks.document as unknown as BlocksDocument
        names.value = new Map(types.map((t) => [t.type, t.name]))
        versions.value = new Map(types.map((t) => [t.type, Number(t.version)]))
        page.value = pageData
        site.value = data
        saved.value = document
        etag.value = blocks.etag
        copy.value = toWorkingCopy(document, versions.value)
        openBlocks.clear()
        if (copy.value.blocks.length <= OPEN_ALL_UP_TO) {
            copy.value.blocks.forEach((b) => openBlocks.add(b.key))
        }
        setSiteNav({ id: data.id, name: data.name, section: 'pages' })
        phase.value = 'ready'
    } catch (error) {
        if (isAbort(error) || signal.aborted) return
        if (isApiError(error) && error.code === 'unauthenticated') return
        phase.value = 'failed'
    }
}

function nameOf(block: WorkingBlock): string {
    return names.value.get(block.node.type) ?? block.node.type
}

async function focusField(id: string): Promise<void> {
    await nextTick()
    document.getElementById(id)?.focus()
}

async function showMessage(text: string): Promise<void> {
    formMessage.value = { text, links: [] }
    await nextTick()
    messageEl.value?.focus()
}

/** "Error: 2 blocks need attention: 1. Hero, 4. Gallery." and focus on the first invalid field. */
async function showClientErrors(invalid: number[]): Promise<void> {
    const blocks = copy.value.blocks
    for (const i of invalid) {
        const block = blocks[i]
        if (!block) continue
        openBlocks.add(block.key)
        for (const path of Object.keys(clientErrors.value[i] ?? {})) touched.add(keyOf(block, path))
    }
    const targets = invalid.flatMap((i) => {
        const block = blocks[i]
        const path = Object.keys(clientErrors.value[i] ?? {})[0]
        return block && path
            ? [{ label: `${i + 1}. ${nameOf(block)}`, target: fieldId(block.key, path) }]
            : []
    })
    formMessage.value = {
        text: `${targets.length} ${targets.length === 1 ? 'block needs' : 'blocks need'} attention:`,
        links: targets,
    }
    if (targets[0]) await focusField(targets[0].target)
}

async function save(): Promise<void> {
    if (phase.value !== 'ready' || sending.value) return
    formMessage.value = null
    notice.value = ''
    const invalid = copy.value.blocks.flatMap((_, i) =>
        Object.keys(clientErrors.value[i] ?? {}).length > 0 ? [i] : [],
    )
    if (invalid.length > 0) {
        await showClientErrors(invalid)
        return
    }
    const document = documentToSend(copy.value)
    if (saved.value && sameDocument(document, saved.value)) {
        notice.value = 'No changes to save.'
        return
    }
    sending.value = true
    const signal = controller.signal
    try {
        const result = await putPageBlocks(
            pageId,
            document as unknown as BlocksDocumentDto,
            etag.value,
            signal,
        )
        if (signal.aborted) return
        const savedDocument = result.document as unknown as BlocksDocument
        const fresh = toWorkingCopy(savedDocument, versions.value)
        // Values kept for an unchecked optional object survive the save.
        fresh.blocks.forEach((b, i) => {
            const before = copy.value.blocks[i]
            if (before && before.node.type === b.node.type) b.kept = before.kept
        })
        saved.value = savedDocument
        // Without a new ETag the old one stays: a stale value is refused, never overwritten.
        if (result.etag) etag.value = result.etag
        copy.value = fresh
        serverErrors.clear()
        notice.value = 'Blocks saved.'
        dismissToast()
    } catch (error) {
        if (isAbort(error) || signal.aborted) return
        await showFailure(error)
    } finally {
        sending.value = false
    }
}

// Server errors (block-editor.md, Errors). The changed-elsewhere dialog and the finer copy of
// each rule are a later part (story 144); for now a 412 is a plain form message.
async function showFailure(error: unknown): Promise<void> {
    if (!isApiError(error)) return showErrorToast(toastCopy.saveFailed('blocks'))
    const pointer = /^\/content\/(\d+)\/attrs\/(.+)$/.exec(error.field ?? '')
    const block = pointer ? copy.value.blocks[Number(pointer[1])] : undefined
    switch (error.code) {
        case 'unauthenticated':
            return
        case 'page_not_found':
            phase.value = 'missing'
            return
        case 'invalid_block':
            if (block && pointer?.[2]) {
                const path = fieldKey('/' + pointer[2]) as string
                serverErrors.set(keyOf(block, path), "This value wasn't accepted. Please check it.")
                openBlocks.add(block.key)
                return focusField(fieldId(block.key, path))
            }
            return showMessage("This block wasn't accepted. Please check its fields.")
        case 'unknown_block_type':
            return showMessage(
                "This block type can't be saved here. Remove the block to save the page.",
            )
        case 'too_many_blocks':
            return showMessage('A page holds 40 blocks at most. Remove one to save.')
        case 'request_too_large':
            return showMessage(
                'This page is too large to save. Remove a block or shorten some text.',
            )
        case 'invalid_request':
            return showMessage(
                "Something on this page wasn't accepted. Please check it and try again.",
            )
        case 'precondition_failed':
            return showMessage(
                'This page was changed somewhere else. Reload it to see the latest blocks.',
            )
        default:
            return showErrorToast(toastCopy.saveFailed('blocks'))
    }
}

/** Enter in a field submits nothing: a page has many blocks. Buttons keep their own Enter. */
function onEnter(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) event.preventDefault()
}

function onShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
    }
}

onMounted(() => {
    window.addEventListener('keydown', onShortcut)
    void load()
})
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onShortcut)
    controller.abort()
    clearSiteNav()
})
</script>

<template>
    <NotFoundScreen v-if="phase === 'missing'" code="page_not_found" />
    <template v-else>
        <ScreenHead :title="heading" :eyebrow="site?.name" :document-title="documentTitle">
            <template v-if="phase === 'ready'" #lead>
                <span id="block-count" class="hs-count">{{ countText }}</span>
            </template>
            <template #actions>
                <div class="hs-actions">
                    <template v-if="phase === 'ready'">
                        <RouterLink class="hs-button hs-button--secondary" :to="pagesPath"
                            >Back to pages</RouterLink
                        >
                        <button
                            type="submit"
                            form="blocks"
                            class="hs-button"
                            :aria-disabled="sending ? 'true' : undefined"
                        >
                            {{ sending ? 'Saving…' : 'Save blocks' }}
                        </button>
                    </template>
                    <!-- One status region for the whole screen; its text changes, the element stays. -->
                    <p
                        class="hs-status"
                        :class="{ 'hs-visually-hidden': phase !== 'ready' }"
                        role="status"
                    >
                        {{ statusText }}
                    </p>
                </div>
            </template>
        </ScreenHead>

        <div v-if="phase === 'loading'" class="hs-placeholder" aria-busy="true">
            <div v-for="n in 3" :key="n" class="hs-placeholder__panel" aria-hidden="true">
                <span class="hs-placeholder__line" />
            </div>
        </div>

        <div v-else-if="phase === 'failed'" class="hs-load-error">
            <p class="hs-form-message"><strong>Error:</strong> {{ LOAD_ERROR }}</p>
            <button type="button" class="hs-button hs-button--secondary" @click="load()">
                Try again
            </button>
        </div>

        <form
            v-else
            id="blocks"
            class="hs-blocks"
            novalidate
            :aria-label="heading"
            @submit.prevent="save"
            @keydown.enter="onEnter"
        >
            <div
                v-if="formMessage"
                ref="messageEl"
                class="hs-form-message hs-blocks__message"
                role="alert"
                tabindex="-1"
            >
                <strong>Error:</strong> {{ formMessage.text }}
                <template v-for="(link, i) in formMessage.links" :key="link.target">
                    <a href="#" @click.prevent="focusField(link.target)">{{ link.label }}</a
                    >{{ i < formMessage.links.length - 1 ? ', ' : '.' }}
                </template>
            </div>
            <section v-if="copy.blocks.length === 0" class="hs-empty">
                <p class="hs-empty__title">This page has no blocks yet.</p>
                <p class="hs-empty__hint">
                    Add a hero to open the page, then text, images or a form.
                </p>
            </section>
            <ol
                v-else
                class="hs-block-list"
                aria-labelledby="block-count"
                :aria-busy="sending ? 'true' : 'false'"
            >
                <BlockPanel
                    v-for="(block, i) in copy.blocks"
                    :key="block.key"
                    :block-id="block.key"
                    :position="i + 1"
                    :name="names.get(block.node.type) ?? block.node.type"
                    :summary="names.has(block.node.type) ? blockSummary(block.node) : undefined"
                    :unsupported="block.readOnly || !registry[block.node.type]"
                    :open="openBlocks.has(block.key)"
                    :flagged="Object.keys(shownErrors(i)).length > 0"
                    @update:open="
                        (open) => (open ? openBlocks.add(block.key) : openBlocks.delete(block.key))
                    "
                >
                    <component
                        :is="entryOf(block)?.form"
                        v-if="entryOf(block)"
                        :block="block"
                        :block-id="block.key"
                        :errors="shownErrors(i)"
                        :readonly="sending"
                        @edit="onEdit(block, $event)"
                        @blur="onBlur(block, $event)"
                    />
                </BlockPanel>
            </ol>
        </form>
    </template>
</template>

<style scoped>
.hs-count {
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    letter-spacing: var(--hs-letter-spacing-body);
    color: var(--hs-color-text-muted);
}

/* Below sm: Back to pages, Save blocks, then the status line, stacked. From sm: a row. */
.hs-actions {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
}

@media (width >= breakpoint(sm)) {
    .hs-actions {
        flex-direction: row;
        align-items: center;
    }
}

.hs-status {
    align-self: center;
    margin: 0;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

.hs-blocks,
.hs-load-error,
.hs-placeholder {
    max-inline-size: var(--hs-layout-content-width);
}

.hs-blocks__message {
    margin-block-end: var(--hs-space-5);
}

.hs-blocks__message a {
    color: var(--hs-color-text);
}

.hs-block-list {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    margin: 0;
    padding: 0;
    list-style: none;
}

.hs-load-error .hs-button {
    margin-block-start: var(--hs-space-4);
}

.hs-empty {
    padding: var(--hs-space-6);
    background: var(--hs-color-surface);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border);
    border-radius: var(--hs-radius-card);
}

.hs-empty__title {
    margin: 0;
    font-size: var(--hs-font-size-body-l);
    color: var(--hs-color-text);
}

.hs-empty__hint {
    margin: var(--hs-space-3) 0 0;
    color: var(--hs-color-text-muted);
}

.hs-placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
}

.hs-placeholder__panel {
    padding-block: var(--hs-space-3);
    padding-inline: var(--hs-space-4);
    background: var(--hs-color-surface);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border);
    border-radius: var(--hs-radius-card);
}

.hs-placeholder__line {
    display: block;
    block-size: var(--hs-control-min-height);
    background: var(--hs-color-placeholder-media);
    border-radius: var(--hs-radius-card);
    animation: hs-pulse var(--hs-motion-duration-slower) var(--hs-motion-easing-standard) infinite
        alternate;
}

@keyframes hs-pulse {
    to {
        background: var(--hs-color-surface-sunk);
    }
}

@media (prefers-reduced-motion: reduce) {
    .hs-placeholder__line {
        animation-name: none;
    }
}
</style>
