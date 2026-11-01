<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import ScreenHead from '../components/ScreenHead.vue'
import { api, isApiError, listAll, type components } from '../api'
import { takeAddedPage } from '../composables/useAddedPage'
import { clearSiteNav, setSiteNav } from '../composables/useSiteNav'

type Site = components['schemas']['SiteDto']
type PageItem = components['schemas']['PageDto']

/** Pages per site (API-002, Limits). */
const PAGE_LIMIT = 50

const route = useRoute()
const siteId = String(route.params.id)

const site = ref<Site | null>(null)
const pages = ref<PageItem[]>([])
const phase = ref<'loading' | 'ready' | 'failed' | 'missing'>('loading')
const addedPage = takeAddedPage()
const added = ref('')
const addedId = ref('')
const list = ref<HTMLElement | null>(null)

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const count = computed(() => pages.value.length)
const atLimit = computed(() => count.value >= PAGE_LIMIT)
const isEmpty = computed(() => phase.value === 'ready' && count.value === 0)
const countText = computed(() => `${count.value} of ${PAGE_LIMIT} pages`)
const isHome = (p: PageItem) => Number(p.menu_order) === 0
const position = (p: PageItem) => Number(p.menu_order) + 1

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

async function fetchSite(): Promise<Site> {
    const { data } = await api.GET('/sites/{id}', {
        params: { path: { id: siteId } },
        signal: controller.signal,
    })
    if (!data) throw new Error('Empty response')
    return data
}

/** Every page, in the server's order. Follows `next_cursor` as the fallback. */
function fetchPages(): Promise<PageItem[]> {
    return listAll<PageItem>(async (cursor) => {
        const { data } = await api.GET('/sites/{id}/pages', {
            params: {
                path: { id: siteId },
                query: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
            },
            signal: controller.signal,
        })
        if (!data) throw new Error('Empty response')
        return data
    })
}

async function fetchPagesRestarting(): Promise<PageItem[]> {
    try {
        return await fetchPages()
    } catch (error) {
        // A stale cursor: start over once. A second failure is the list error.
        if (isApiError(error) && error.code === 'invalid_cursor') return fetchPages()
        throw error
    }
}

async function load(): Promise<void> {
    phase.value = 'loading'
    try {
        const [loadedSite, all] = await Promise.all([fetchSite(), fetchPagesRestarting()])
        site.value = loadedSite
        setSiteNav({ id: loadedSite.id, name: loadedSite.name })
        pages.value = all
        phase.value = 'ready'
        await announceAdded()
    } catch (error) {
        if (isAbort(error)) return
        // Sign-in owns a 401 (shell.md); the list shows nothing of its own.
        if (isApiError(error) && error.code === 'unauthenticated') return
        phase.value = isApiError(error) && error.code === 'site_not_found' ? 'missing' : 'failed'
        if (phase.value === 'missing') clearSiteNav()
    }
}

/** After add: say where the page landed and focus its title link. */
async function announceAdded(): Promise<void> {
    const row = addedPage ? pages.value.find((p) => p.id === addedPage.id) : undefined
    if (!row) return
    addedId.value = row.id
    added.value = `${row.title} added at position ${position(row)} of ${count.value}.`
    await nextTick()
    list.value?.querySelector<HTMLElement>(`[data-page-id="${row.id}"] .hs-row__title`)?.focus()
}

const documentTitle = computed(() =>
    site.value ? `Pages · ${site.value.name} · Hivesite Studio` : undefined,
)
const statusText = computed(() => {
    if (phase.value === 'loading') return 'Loading pages…'
    if (phase.value === 'failed') return "Error: We couldn't load the pages of this site."
    return added.value
})

onMounted(() => {
    void load()
})
onBeforeUnmount(() => {
    controller.abort()
    clearSiteNav()
})
</script>

<template>
    <NotFoundScreen v-if="phase === 'missing'" code="site_not_found" />
    <template v-else>
        <ScreenHead title="Pages" :eyebrow="site?.name" :document-title="documentTitle">
            <template v-if="phase === 'ready'" #lead>
                <span id="page-count" class="hs-count" :class="{ 'hs-count--limit': atLimit }">{{
                    countText
                }}</span>
            </template>
            <template v-if="phase === 'ready' && !isEmpty" #actions>
                <div class="hs-new">
                    <button
                        v-if="atLimit"
                        type="button"
                        class="hs-button"
                        aria-disabled="true"
                        aria-describedby="page-count page-limit-reason"
                        @click.prevent
                    >
                        Add page
                    </button>
                    <RouterLink
                        v-else
                        class="hs-button"
                        :to="`/sites/${siteId}/pages/new`"
                        aria-describedby="page-count"
                    >
                        Add page
                    </RouterLink>
                    <p v-if="atLimit" id="page-limit-reason" class="hs-new__reason">
                        This site has {{ PAGE_LIMIT }} pages, the most a site can hold. Delete one
                        to add another.
                    </p>
                </div>
            </template>
        </ScreenHead>

        <!-- One status region for the whole screen; its text changes, the element stays. -->
        <p
            class="hs-list-status"
            :class="{ 'hs-visually-hidden': phase !== 'ready' }"
            role="status"
        >
            {{ statusText }}
        </p>

        <div v-if="phase === 'loading'" class="hs-placeholder" aria-busy="true">
            <div v-for="n in 3" :key="n" class="hs-placeholder__row" aria-hidden="true">
                <span class="hs-placeholder__line hs-placeholder__line--title" />
                <span class="hs-placeholder__line hs-placeholder__line--meta" />
            </div>
        </div>

        <div v-else-if="phase === 'failed'" class="hs-load-error">
            <p class="hs-form-message">
                <strong>Error:</strong> We couldn't load the pages of this site.
            </p>
            <button type="button" class="hs-button hs-button--secondary" @click="load()">
                Try again
            </button>
        </div>

        <section v-else-if="isEmpty" class="hs-empty" aria-labelledby="empty-title">
            <h2 id="empty-title">This site has no pages yet</h2>
            <p>The first page you add becomes your home page.</p>
            <RouterLink class="hs-button" :to="`/sites/${siteId}/pages/new`">Add a page</RouterLink>
        </section>

        <ol v-else ref="list" class="hs-list" aria-label="Pages">
            <li
                v-for="page in pages"
                :key="page.id"
                class="hs-row"
                :class="{ 'hs-row--new': page.id === addedId }"
                :data-page-id="page.id"
            >
                <span class="hs-row__pos" aria-hidden="true">{{ position(page) }}</span>
                <div class="hs-row__main">
                    <div class="hs-row__head">
                        <RouterLink
                            class="hs-row__title"
                            :to="`/pages/${page.id}/edit`"
                            :aria-describedby="isHome(page) ? `home-${page.id}` : undefined"
                            >{{ page.title }}</RouterLink
                        >
                        <span v-if="isHome(page)" :id="`home-${page.id}`" class="hs-home"
                            >Home page</span
                        >
                    </div>
                    <p class="hs-row__meta">
                        <span class="hs-path"
                            >/s/{{ site?.slug }}/{{ isHome(page) ? '' : page.slug }}</span
                        >
                    </p>
                </div>
                <div class="hs-row__actions">
                    <RouterLink
                        class="hs-button hs-button--quiet"
                        :to="`/pages/${page.id}/blocks`"
                        :aria-label="`Edit blocks of ${page.title}`"
                        >Edit blocks</RouterLink
                    >
                </div>
            </li>
        </ol>
    </template>
</template>

<style scoped>
.hs-count {
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    letter-spacing: var(--hs-letter-spacing-body);
    color: var(--hs-color-text-muted);
}

.hs-count--limit {
    color: var(--hs-color-text);
}

.hs-new {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
}

@media (width >= breakpoint(md)) {
    .hs-new {
        align-items: flex-end;
    }
}

.hs-new__reason {
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

.hs-list-status {
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

.hs-list-status:not(:empty):not(.hs-visually-hidden) {
    margin-block-end: var(--hs-space-4);
}

.hs-list {
    max-inline-size: var(--hs-layout-content-width);
    margin: 0;
    padding: 0;
    list-style: none;
    border-block-start: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
        'pos main'
        'actions actions';
    align-items: center;
    column-gap: var(--hs-space-3);
    row-gap: var(--hs-space-2);
    padding-block: var(--hs-space-4);
    padding-inline: var(--hs-space-3);
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-row__main {
    grid-area: main;
    min-inline-size: 0;
}

.hs-row__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--hs-space-3);
}

.hs-row__pos {
    grid-area: pos;
    min-inline-size: 2ch;
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    letter-spacing: var(--hs-letter-spacing-body);
    color: var(--hs-color-text-muted);
}

.hs-row__title {
    display: inline-flex;
    align-items: center;
    min-block-size: var(--hs-control-min-height);
    font-size: var(--hs-font-size-body);
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
    text-decoration: none;
    overflow-wrap: anywhere;
}

.hs-row__title:hover {
    text-decoration: underline;
}

.hs-home {
    padding-block: var(--hs-space-1);
    padding-inline: var(--hs-space-2);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border-strong);
    border-radius: var(--hs-radius-control);
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    font-weight: var(--hs-font-weight-label);
    letter-spacing: var(--hs-letter-spacing-label);
    text-transform: uppercase;
    color: var(--hs-color-text);
}

.hs-row__meta {
    margin: var(--hs-space-1) 0 0;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
    overflow-wrap: anywhere;
}

.hs-row__actions {
    grid-area: actions;
    display: flex;
    justify-content: flex-end;
    gap: var(--hs-space-2);
}

@media (width >= breakpoint(sm)) {
    .hs-row {
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'pos main actions';
    }
}

/* A new row fades in as the one moving shape. Reduced motion shortens it via the token. */
.hs-row--new {
    animation: hs-row-in var(--hs-motion-duration-base) var(--hs-motion-easing-enter) both;
}

@keyframes hs-row-in {
    from {
        opacity: 0;
    }
}

.hs-empty {
    max-inline-size: var(--hs-layout-content-width);
    padding: var(--hs-space-5);
    background: var(--hs-color-surface);
    border: var(--hs-border-width-hairline) solid var(--hs-color-border);
    border-radius: var(--hs-radius-card);
}

.hs-empty h2 {
    font-family: var(--hs-font-display);
    font-size: var(--hs-font-size-display-m);
    font-weight: var(--hs-font-weight-display-strong);
    line-height: var(--hs-line-height-heading);
}

.hs-empty p {
    margin-block-start: var(--hs-space-3);
    color: var(--hs-color-text-muted);
}

.hs-empty .hs-button {
    margin-block-start: var(--hs-space-5);
    inline-size: 100%;
}

.hs-load-error .hs-button {
    margin-block-start: var(--hs-space-4);
}

.hs-placeholder {
    max-inline-size: var(--hs-layout-content-width);
    border-block-start: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-placeholder__row {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-1);
    padding-block: var(--hs-space-4);
    padding-inline: var(--hs-space-3);
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-placeholder__line {
    display: block;
    background: var(--hs-color-placeholder-media);
    border-radius: var(--hs-radius-card);
    animation: hs-pulse var(--hs-motion-duration-slower) var(--hs-motion-easing-standard) infinite
        alternate;
}

.hs-placeholder__line--title {
    block-size: calc(var(--hs-font-size-body) * var(--hs-line-height-body));
    inline-size: 50%;
}

.hs-placeholder__line--meta {
    block-size: calc(var(--hs-font-size-body-s) * var(--hs-line-height-body));
    inline-size: 30%;
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

@media (width >= breakpoint(sm)) {
    .hs-empty .hs-button {
        inline-size: auto;
    }

    .hs-empty {
        padding: var(--hs-space-7);
    }
}
</style>
