<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ScreenHead from '../components/ScreenHead.vue'
import { api, isApiError, type components } from '../api'

type Site = components['schemas']['SiteDto']
type SiteList = components['schemas']['SiteDtoList']

/** Sites per owner (API-001, Limits). */
const SITE_LIMIT = 10
/** The API default; the studio always sends it (site-list.md, Data). */
const PAGE_SIZE = 20

const sites = ref<Site[]>([])
const nextCursor = ref<string | null>(null)
const phase = ref<'loading' | 'ready' | 'failed'>('loading')
const more = ref<'idle' | 'loading' | 'failed'>('idle')
const notice = ref('')
const noticeKind = ref<'loaded' | 'refreshed' | ''>('')
const newIds = ref(new Set<string>())
const list = ref<HTMLElement | null>(null)
const moreBtn = ref<HTMLElement | null>(null)

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const count = computed(() => sites.value.length)
const atLimit = computed(() => count.value >= SITE_LIMIT)
const isEmpty = computed(() => phase.value === 'ready' && count.value === 0)
const atEnd = computed(() => phase.value === 'ready' && nextCursor.value === null)
const countText = computed(() => `${count.value} of ${SITE_LIMIT} sites`)

async function fetchPage(cursor: string | null): Promise<SiteList> {
    const { data } = await api.GET('/sites', {
        params: { query: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) } },
        signal: controller.signal,
    })
    if (!data) throw new Error('Empty response')
    return data
}

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

/** A site whose id is already shown is skipped, so no site shows twice. */
function dedupe(existing: Site[], incoming: Site[]): Site[] {
    const seen = new Set(existing.map((s) => s.id))
    const out = [...existing]
    for (const site of incoming) {
        if (seen.has(site.id)) continue
        seen.add(site.id)
        out.push(site)
    }
    return out
}

/** First load, and the reload after `invalid_cursor`. Replaces the list. */
async function loadFromStart(refreshed = false): Promise<void> {
    if (!refreshed) phase.value = 'loading'
    const hadFocus = refreshed && isFocused(moreBtn.value)
    const shownBefore = new Set(sites.value.map((s) => s.id))
    try {
        const page = await fetchPage(null)
        sites.value = dedupe([], page.items)
        nextCursor.value = page.next_cursor
        newIds.value = new Set()
        phase.value = 'ready'
        more.value = 'idle'
        notice.value = refreshed ? 'The list was refreshed.' : ''
        noticeKind.value = refreshed ? 'refreshed' : ''
        if (hadFocus) {
            await nextTick()
            focusAfterMore(sites.value.filter((s) => !shownBefore.has(s.id)))
        }
    } catch (error) {
        if (isAbort(error)) return
        // Sign-in owns a 401 (shell.md); the list shows nothing of its own.
        if (isApiError(error) && error.code === 'unauthenticated') return
        if (refreshed) more.value = 'failed'
        else phase.value = 'failed'
    }
}

function isFocused(el: HTMLElement | null): boolean {
    return el !== null && document.activeElement === el
}

/** Focus the first newly shown row link, or the first row link when none were added. */
function focusAfterMore(added: Site[]): void {
    const target = added[0] ?? sites.value[0]
    if (!target) return
    list.value?.querySelector<HTMLElement>(`[data-site-id="${target.id}"] a`)?.focus()
}

async function loadMore(): Promise<void> {
    // One Load more request at a time; the busy button does nothing.
    if (more.value === 'loading' || nextCursor.value === null) return
    const hadFocus = isFocused(moreBtn.value)
    more.value = 'loading'
    notice.value = ''
    noticeKind.value = ''
    try {
        const page = await fetchPage(nextCursor.value)
        const before = sites.value
        const merged = dedupe(before, page.items)
        const added = merged.slice(before.length)
        sites.value = merged
        nextCursor.value = page.next_cursor
        newIds.value = new Set(added.map((s) => s.id))
        more.value = 'idle'
        const n = added.length
        notice.value = `${n} more ${n === 1 ? 'site' : 'sites'} loaded.`
        noticeKind.value = 'loaded'
        await nextTick()
        if (added.length > 0 || (hadFocus && nextCursor.value === null)) focusAfterMore(added)
    } catch (error) {
        if (isAbort(error)) return
        if (isApiError(error) && error.code === 'unauthenticated') return
        if (isApiError(error) && error.code === 'invalid_cursor') {
            await loadFromStart(true)
            return
        }
        more.value = 'failed'
    }
}

const statusText = computed(() => {
    if (more.value === 'loading') return 'Loading more sites…'
    const end =
        atEnd.value && count.value > 0 && noticeKind.value === 'loaded'
            ? "That's all your sites."
            : ''
    return [notice.value, end].filter(Boolean).join(' ')
})
// Visible for the refresh note; the other announcements stay out of the way.
const statusHidden = computed(
    () => more.value === 'loading' || (atEnd.value && noticeKind.value !== 'refreshed'),
)

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

onMounted(() => {
    void loadFromStart()
})
onBeforeUnmount(() => controller.abort())
</script>

<template>
    <ScreenHead title="Your sites">
        <template v-if="phase === 'ready'" #lead>
            <span id="site-count" class="hs-count" :class="{ 'hs-count--limit': atLimit }">{{
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
                    aria-describedby="site-count site-limit-reason"
                    @click.prevent
                >
                    New site
                </button>
                <RouterLink v-else class="hs-button" to="/sites/new" aria-describedby="site-count">
                    New site
                </RouterLink>
                <p v-if="atLimit" id="site-limit-reason" class="hs-new__reason">
                    You have {{ SITE_LIMIT }} sites, the most for now. Sites can't be deleted yet.
                </p>
            </div>
        </template>
    </ScreenHead>

    <!-- One status region while the list is not ready; its text changes, the element stays. -->
    <p v-if="phase !== 'ready'" class="hs-visually-hidden" role="status">
        {{ phase === 'failed' ? "Error: We couldn't load your sites." : 'Loading sites…' }}
    </p>

    <div v-if="phase === 'loading'" class="hs-placeholder" aria-busy="true">
        <div v-for="n in 3" :key="n" class="hs-placeholder__row" aria-hidden="true">
            <span class="hs-placeholder__line hs-placeholder__line--title" />
            <span class="hs-placeholder__line hs-placeholder__line--meta" />
        </div>
    </div>

    <div v-else-if="phase === 'failed'" class="hs-load-error">
        <p class="hs-form-message"><strong>Error:</strong> We couldn't load your sites.</p>
        <button type="button" class="hs-button hs-button--secondary" @click="loadFromStart()">
            Try again
        </button>
    </div>

    <section v-else-if="isEmpty" class="hs-empty" aria-labelledby="empty-title">
        <h2 id="empty-title">Your first site starts here</h2>
        <p>Give it a name and a path. You can change both later.</p>
        <RouterLink class="hs-button" to="/sites/new">Create a site</RouterLink>
    </section>

    <template v-else>
        <ul ref="list" class="hs-list" aria-label="Your sites">
            <li
                v-for="site in sites"
                :key="site.id"
                class="hs-row"
                :class="{ 'hs-row--new': newIds.has(site.id) }"
                :data-site-id="site.id"
            >
                <RouterLink class="hs-row__title" :to="`/sites/${site.id}/pages`">{{
                    site.name
                }}</RouterLink>
                <p class="hs-row__meta">
                    <span class="hs-path">/s/{{ site.slug }}</span>
                    <span class="hs-row__lang">Language: {{ site.settings.language }}</span>
                    <span class="hs-row__updated"
                        >Updated
                        <time :datetime="site.updated_at">{{
                            formatDate(site.updated_at)
                        }}</time></span
                    >
                </p>
            </li>
        </ul>

        <div class="hs-more">
            <button
                v-if="nextCursor !== null"
                ref="moreBtn"
                type="button"
                class="hs-button hs-button--secondary"
                :aria-disabled="more === 'loading' ? 'true' : undefined"
                @click="loadMore"
            >
                {{
                    more === 'loading' ? 'Loading…' : more === 'failed' ? 'Try again' : 'Load more'
                }}
            </button>
            <p
                class="hs-more__status"
                :class="{
                    'hs-more__status--error': more === 'failed',
                    'hs-visually-hidden': more !== 'failed' && statusHidden,
                }"
                role="status"
            >
                <template v-if="more === 'failed'">
                    <strong>Error:</strong> We couldn't load more sites.
                </template>
                <template v-else>{{ statusText }}</template>
            </p>
            <p v-if="atEnd" class="hs-end">That's all your sites.</p>
        </div>
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

/* List row (shell.md): rows divided by hairlines, the title link covers the row. */
.hs-list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-block-start: var(--hs-border-width-hairline) solid var(--hs-color-border);
    /* After first load the list fades and rises as one shape. Reduced motion zeroes the tokens. */
    animation: hs-list-in var(--hs-motion-duration-base) var(--hs-motion-easing-enter) both;
}

@keyframes hs-list-in {
    from {
        opacity: 0;
        transform: translateY(var(--hs-motion-rise-distance));
    }
}

.hs-row {
    position: relative;
    min-block-size: var(--hs-control-min-height);
    padding-block: var(--hs-space-4);
    padding-inline: var(--hs-space-3);
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
    transition: background-color var(--hs-motion-duration-base) var(--hs-motion-easing-standard);
}

.hs-row:hover {
    background: var(--hs-color-surface);
}

.hs-row:hover .hs-row__title {
    text-decoration: underline;
}

/* The shared focus ring goes around the whole row. */
.hs-row:focus-within {
    outline: var(--hs-border-width-focus) solid var(--hs-color-focus);
    outline-offset: calc(-1 * var(--hs-border-width-focus));
}

.hs-row__title {
    font-family: var(--hs-font-text);
    font-size: var(--hs-font-size-body);
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
    text-decoration: none;
    overflow-wrap: anywhere;
}

.hs-row__title:focus-visible {
    outline: none;
}

.hs-row__title::after {
    content: '';
    position: absolute;
    inset: 0;
}

.hs-row__meta {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-1);
    margin-block-start: var(--hs-space-1);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
    overflow-wrap: anywhere;
}

.hs-path {
    font-family: var(--hs-font-label);
    letter-spacing: var(--hs-letter-spacing-body);
}

/* New rows fade in together, as one shape. Reduced motion shortens it via the duration token. */
.hs-row--new {
    animation: hs-rows-in var(--hs-motion-duration-base) var(--hs-motion-easing-enter) both;
}

@keyframes hs-rows-in {
    from {
        opacity: 0;
    }
}

.hs-more {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--hs-space-3);
    margin-block-start: var(--hs-space-6);
}

.hs-more > .hs-button {
    inline-size: 100%;
}

.hs-more__status {
    font-size: var(--hs-font-size-body-s);
}

.hs-more__status--error {
    color: var(--hs-color-error);
}

.hs-more__status--error strong {
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-end {
    flex-basis: 100%;
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

/* Empty state */
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

/* List error: a form message block, then Try again. */
.hs-form-message {
    padding: var(--hs-space-4);
    background: var(--hs-color-surface);
    border-inline-start: var(--hs-border-width-focus) solid var(--hs-color-error);
    color: var(--hs-color-text);
}

.hs-form-message strong {
    color: var(--hs-color-error);
    font-weight: var(--hs-font-weight-text-strong);
}

.hs-load-error .hs-button {
    margin-block-start: var(--hs-space-4);
}

/* Loading placeholder: three rows, pulsing between two tokens. */
.hs-placeholder {
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

/* Static placeholders under reduced motion. */
@media (prefers-reduced-motion: reduce) {
    .hs-placeholder__line {
        animation-name: none;
    }
}

@media (width >= breakpoint(sm)) {
    .hs-row__meta {
        flex-direction: row;
        flex-wrap: wrap;
        column-gap: var(--hs-space-4);
    }

    .hs-more > .hs-button,
    .hs-empty .hs-button {
        inline-size: auto;
    }

    .hs-empty {
        padding: var(--hs-space-7);
    }
}

@media (width >= breakpoint(md)) {
    .hs-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: var(--hs-space-5);
    }

    .hs-row__meta {
        display: contents;
    }

    .hs-row__lang {
        margin-inline-start: auto;
    }
}
</style>
