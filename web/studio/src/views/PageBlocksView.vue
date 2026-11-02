<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BlockPanel from '../components/BlockPanel.vue'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import ScreenHead from '../components/ScreenHead.vue'
import { api, getPageBlocks, isApiError, listAllBlockTypes, type components } from '../api'
import {
    documentToSend,
    sameDocument,
    toWorkingCopy,
    type BlocksDocument,
    type WorkingCopy,
} from '../blocks/model'
import { blockSummary } from '../blocks/summary'
import { clearSiteNav, setSiteNav } from '../composables/useSiteNav'

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
// The last saved document and its ETag (kept for the save part), and the copy the screen works on.
const saved = shallowRef<BlocksDocument | null>(null)
const etag = ref<string | null>(null)
const copy = shallowRef<WorkingCopy>({ blocks: [] })

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const pagesPath = computed(() => (page.value ? `/sites/${page.value.site_id}/pages` : '/'))
const documentTitle = computed(() =>
    page.value ? `Blocks · ${page.value.title} · Hivesite Studio` : undefined,
)
const heading = computed(() => (page.value ? `Blocks of ${page.value.title}` : 'Blocks'))
const countText = computed(() => `${copy.value.blocks.length} of ${BLOCK_LIMIT} blocks`)
const startOpen = computed(() => copy.value.blocks.length <= OPEN_ALL_UP_TO)
const unsaved = computed(
    () => saved.value !== null && !sameDocument(documentToSend(copy.value), saved.value),
)
const statusText = computed(() => {
    if (phase.value === 'loading') return 'Loading…'
    if (phase.value === 'failed') return `Error: ${LOAD_ERROR}`
    return unsaved.value ? 'Unsaved changes' : ''
})

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
        const versions = new Map(types.map((t) => [t.type, Number(t.version)]))
        page.value = pageData
        site.value = data
        saved.value = document
        etag.value = blocks.etag
        copy.value = toWorkingCopy(document, versions)
        setSiteNav({ id: data.id, name: data.name, section: 'pages' })
        phase.value = 'ready'
    } catch (error) {
        if (isAbort(error) || signal.aborted) return
        if (isApiError(error) && error.code === 'unauthenticated') return
        phase.value = 'failed'
    }
}

onMounted(() => {
    void load()
})
onBeforeUnmount(() => {
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
                <template v-if="phase === 'ready'">
                    <RouterLink class="hs-button hs-button--secondary" :to="pagesPath"
                        >Back to pages</RouterLink
                    >
                    <button type="submit" form="blocks" class="hs-button">Save blocks</button>
                </template>
                <!-- One status region for the whole screen; its text changes, the element stays. -->
                <p
                    class="hs-status"
                    :class="{ 'hs-visually-hidden': phase !== 'ready' }"
                    role="status"
                >
                    {{ statusText }}
                </p>
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

        <form v-else id="blocks" class="hs-blocks" novalidate :aria-label="heading" @submit.prevent>
            <section v-if="copy.blocks.length === 0" class="hs-empty">
                <p class="hs-empty__title">This page has no blocks yet.</p>
                <p class="hs-empty__hint">
                    Add a hero to open the page, then text, images or a form.
                </p>
            </section>
            <ol v-else class="hs-block-list" aria-labelledby="block-count">
                <BlockPanel
                    v-for="(block, i) in copy.blocks"
                    :key="block.key"
                    :block-id="block.key"
                    :position="i + 1"
                    :name="names.get(block.node.type) ?? block.node.type"
                    :summary="names.has(block.node.type) ? blockSummary(block.node) : undefined"
                    :unsupported="block.readOnly"
                    :start-open="startOpen"
                />
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
