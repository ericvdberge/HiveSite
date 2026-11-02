<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import DeletePageDialog from '../components/DeletePageDialog.vue'
import ScreenHead from '../components/ScreenHead.vue'
import { api, isApiError, listAll, type components } from '../api'
import { takeAddedPage } from '../composables/useAddedPage'
import { clearSiteNav, setSiteNav } from '../composables/useSiteNav'
import { glide, play } from '../motion'
import { dismissToast, showErrorToast } from '../composables/useToast'

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
// The one status line of the screen: add, delete and (later) reorder messages.
const notice = ref('')
const addedId = ref('')
const list = ref<HTMLElement | null>(null)

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const count = computed(() => pages.value.length)
const atLimit = computed(() => count.value >= PAGE_LIMIT)
const isEmpty = computed(() => phase.value === 'ready' && count.value === 0)
const countText = computed(() => `${count.value} of ${PAGE_LIMIT} pages`)
// The home marker follows the saved order; it moves with a drop, not during a drag.
const homeId = ref('')
const isHome = (p: PageItem) => p.id === homeId.value
const position = (p: PageItem) => pages.value.findIndex((x) => x.id === p.id) + 1

/** Takes a list in menu order as the saved state: menu_order follows the index and home is the first. */
function setPages(list: PageItem[]): void {
    pages.value = list.map((p, i) => ({ ...p, menu_order: i }))
    homeId.value = pages.value[0]?.id ?? ''
}

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
    notice.value = ''
    try {
        const [loadedSite, all] = await Promise.all([fetchSite(), fetchPagesRestarting()])
        site.value = loadedSite
        setSiteNav({ id: loadedSite.id, name: loadedSite.name })
        setPages(all)
        remember()
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

/** Links leave the screen; they do nothing while a save is out. */
function go(e: MouseEvent, navigate: (e?: MouseEvent) => unknown): void {
    if (busy.value) e.preventDefault()
    else navigate(e)
}

/** Confirm dialog state (delete-confirm.md). The dialog opens with data already on the page. */
const deleting = ref<PageItem | null>(null)
const deleteBusy = ref(false)
const deleteFailed = ref(false)
const dialog = ref<InstanceType<typeof DeletePageDialog> | null>(null)

const onlyPage = computed(() => count.value === 1)
const nextHomeTitle = computed(() =>
    deleting.value && isHome(deleting.value) && count.value > 1 ? pages.value[1]?.title : undefined,
)

// True from the confirm until the row is gone and focus has moved: no second delete meanwhile.
const removing = ref(false)

function openDelete(page: PageItem): void {
    if (deleting.value || removing.value || busy.value || grab.value) return
    deleteFailed.value = false
    deleteBusy.value = false
    deleting.value = page
}

function rowElement(id: string): HTMLElement | null {
    return list.value?.querySelector<HTMLElement>(`[data-page-id="${id}"]`) ?? null
}

/** Closes the dialog (it fades out first). */
async function closeDialog(): Promise<void> {
    await dialog.value?.dismiss()
    deleting.value = null
}

async function cancelDelete(): Promise<void> {
    if (deleteBusy.value || !deleting.value) return
    const id = deleting.value.id
    await closeDialog()
    await nextTick()
    // Focus goes back to the Delete button of the same row.
    rowElement(id)?.querySelector<HTMLElement>('[data-action="delete"]')?.focus()
}

/** Focus: the title link now at the deleted row's place, else the new last, else "Add a page". */
async function focusAfterRemoval(index: number): Promise<void> {
    await nextTick()
    const target = pages.value[Math.min(index, pages.value.length - 1)]
    if (!target) {
        document.querySelector<HTMLElement>('.hs-empty a')?.focus()
        return
    }
    rowElement(target.id)?.querySelector<HTMLElement>('.hs-row__title')?.focus()
}

async function confirmDelete(): Promise<void> {
    const target = deleting.value
    if (!target || deleteBusy.value || removing.value) return
    removing.value = true
    const index = pages.value.findIndex((p) => p.id === target.id)
    const wasHome = isHome(target)
    const nextTitle = wasHome ? pages.value[1]?.title : undefined
    deleteBusy.value = true
    deleteFailed.value = false
    try {
        await api.DELETE('/pages/{id}', {
            params: { path: { id: target.id } },
            signal: controller.signal,
        })
        if (controller.signal.aborted) return
        await closeDialog()
        if (controller.signal.aborted) return
        const at = await removeRow(target)
        if (controller.signal.aborted) return
        notice.value =
            wasHome && nextTitle !== undefined
                ? `${target.title} deleted. ${nextTitle} is now your home page.`
                : `${target.title} deleted.`
        await focusAfterRemoval(at)
    } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return
        if (isApiError(error) && error.code === 'unauthenticated') {
            // Sign-in owns a 401; the dialog just returns to idle.
        } else if (isApiError(error) && error.code === 'page_not_found') {
            // Already gone: not the not-found screen. Reload, then say so.
            await closeDialog()
            if (controller.signal.aborted) return
            await load()
            if (controller.signal.aborted || phase.value !== 'ready') return
            notice.value = 'That page was already deleted. The list is up to date.'
            await focusAfterRemoval(index)
        } else {
            deleteFailed.value = true
        }
    } finally {
        if (!controller.signal.aborted) {
            deleteBusy.value = false
            removing.value = false
        }
    }
}

/** The row fades out, then the rows below close the gap: one shape at a time. */
async function removeRow(target: PageItem): Promise<number> {
    const row = rowElement(target.id)
    if (row) await play(row, [{ opacity: 1 }, { opacity: 0 }])
    if (controller.signal.aborted) return 0
    // Everything is computed from the list as it is now, not as it was at the confirm.
    const index = pages.value.findIndex((p) => p.id === target.id)
    if (index < 0) return 0
    const below = pages.value.slice(index + 1)
    const tops = new Map(
        below.map((p) => [p.id, rowElement(p.id)?.getBoundingClientRect().top ?? 0] as const),
    )
    setPages(pages.value.filter((p) => p.id !== target.id))
    remember()
    await nextTick()
    await Promise.all(
        below.map((p) => {
            const el = rowElement(p.id)
            return el ? glide(el, tops.get(p.id) ?? 0) : Promise.resolve()
        }),
    )
    return index
}

/* ---- Reorder (menu-reorder.md) ---- */

type ControlKind = 'handle' | 'up' | 'down'
type Grab = { id: string; mode: 'key' | 'pointer'; origin: number }

const saving = ref(false)
const refreshing = ref(false)
const mismatch = ref(false)
const grab = ref<Grab | null>(null)
const movedId = ref('')
const dragDy = ref(0)
const dragSlot = ref(-1)
let dragStartY = 0
let dragStartScroll = 0
let dragPointerId = -1
let dragClientY = 0
let dragFrame = 0
let saved: PageItem[] = []
let suppressBlur = false
let lastControl: { id: string; kind: ControlKind } = { id: '', kind: 'handle' }

const busy = computed(() => saving.value || refreshing.value)
const canMove = computed(() => !busy.value && !removing.value && count.value > 1)

/** The saved state to go back to after a cancel or a failed save. */
function remember(): void {
    saved = pages.value.slice()
}

const dragOthers = computed(() =>
    grab.value?.mode === 'pointer' ? pages.value.filter((p) => p.id !== grab.value?.id) : [],
)
const overBeforeId = computed(() =>
    dragSlot.value >= 0 ? (dragOthers.value[dragSlot.value]?.id ?? '') : '',
)
const overAfterId = computed(() =>
    dragSlot.value >= 0 && dragSlot.value >= dragOthers.value.length
        ? (dragOthers.value[dragOthers.value.length - 1]?.id ?? '')
        : '',
)

function rowState(page: PageItem): 'rest' | 'grabbed' | 'saving' {
    if (grab.value?.id === page.id) return 'grabbed'
    return saving.value && movedId.value === page.id ? 'saving' : 'rest'
}

function rowStyle(page: PageItem): Record<string, string> | undefined {
    return grab.value?.mode === 'pointer' && grab.value.id === page.id
        ? { transform: `translateY(${dragDy.value}px)` }
        : undefined
}

function pageById(id: string): PageItem | undefined {
    return pages.value.find((p) => p.id === id)
}

function controlElement(id: string, kind: ControlKind): HTMLElement | null {
    return rowElement(id)?.querySelector<HTMLElement>(`[data-action="${kind}"]`) ?? null
}

async function focusControl(id: string, kind: ControlKind): Promise<void> {
    await nextTick()
    controlElement(id, kind)?.focus()
}

/** Moves a row in the list and glides it to its new place. The rows it passes jump. */
async function moveTo(id: string, to: number): Promise<boolean> {
    const from = pages.value.findIndex((p) => p.id === id)
    const target = Math.max(0, Math.min(pages.value.length - 1, to))
    if (from < 0 || from === target) return false
    const top = rowElement(id)?.getBoundingClientRect().top ?? 0
    const next = pages.value.slice()
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(target, 0, moved)
    suppressBlur = true
    pages.value = next
    await nextTick()
    const el = rowElement(id)
    if (el) void glide(el, top)
    return true
}

function where(id: string): string {
    const page = pageById(id)
    return `position ${page ? position(page) : 0} of ${count.value}`
}

function pickUp(page: PageItem, mode: Grab['mode']): void {
    grab.value = { id: page.id, mode, origin: pages.value.findIndex((p) => p.id === page.id) }
    notice.value =
        mode === 'key'
            ? `${page.title} picked up. Position ${position(page)} of ${count.value}. Use the up and down arrow keys to move, Space to drop, Escape to cancel.`
            : ''
}

/** Puts a picked-up row back where it was; nothing is sent. */
async function cancelGrab(): Promise<void> {
    const g = grab.value
    if (!g) return
    const title = pageById(g.id)?.title ?? ''
    const top = rowElement(g.id)?.getBoundingClientRect().top ?? 0
    grab.value = null
    dragDy.value = 0
    dragSlot.value = -1
    removeEscapeListener()
    suppressBlur = true
    pages.value = saved.slice()
    await nextTick()
    const el = rowElement(g.id)
    if (el) void glide(el, top)
    notice.value = `Move cancelled. ${title} is back at ${where(g.id)}.`
    suppressBlur = false
}

async function onHandleKey(e: KeyboardEvent, page: PageItem): Promise<void> {
    if (!canMove.value) return
    const g = grab.value
    const select = e.key === ' ' || e.key === 'Enter'
    if (!g) {
        if (select) {
            e.preventDefault()
            lastControl = { id: page.id, kind: 'handle' }
            pickUp(page, 'key')
        }
        return
    }
    if (g.mode !== 'key' || g.id !== page.id) return
    const index = pages.value.findIndex((p) => p.id === page.id)
    if (select) {
        e.preventDefault()
        grab.value = null
        await dropRow(page.id, g.origin, 'dropped')
    } else if (e.key === 'Escape') {
        e.preventDefault()
        await cancelGrab()
        await focusControl(page.id, 'handle')
    } else if (e.key === 'Tab') {
        // cancelGrab moves the row back first, so Tab would land in another row: move focus by hand
        // to where Tab goes from the row's original place.
        e.preventDefault()
        const back = e.shiftKey
        await cancelGrab()
        focusFromHandle(page.id, back)
    } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault()
        const to =
            e.key === 'ArrowUp'
                ? index - 1
                : e.key === 'ArrowDown'
                  ? index + 1
                  : e.key === 'Home'
                    ? 0
                    : pages.value.length - 1
        if (await moveTo(page.id, to)) {
            const home = position(page) === 1 && homeId.value !== page.id
            notice.value = `Moved to ${where(page.id)}.${home ? ` ${page.title} will become the home page.` : ''}`
        }
        await focusControl(page.id, 'handle')
        suppressBlur = false
    }
}

/** Where Tab (or Shift+Tab) goes from a row's handle: its title link, or the control before the row. */
function focusFromHandle(id: string, back: boolean): void {
    const row = rowElement(id)
    if (!row) return
    if (!back) {
        row.querySelector<HTMLElement>('.hs-row__title')?.focus()
        return
    }
    const before = row.previousElementSibling as HTMLElement | null
    const target = before
        ? before.querySelector<HTMLElement>('[data-action="delete"]')
        : document.querySelector<HTMLElement>(
              '.hs-screen-head__actions a, .hs-screen-head__actions button',
          )
    target?.focus()
}

function onHandleBlur(page: PageItem): void {
    if (suppressBlur) return
    if (grab.value?.mode === 'key' && grab.value.id === page.id) void cancelGrab()
}

/** A completed move: save unless the row is back where it started. */
async function dropRow(id: string, origin: number, verb: 'dropped' | 'moved'): Promise<void> {
    const page = pageById(id)
    if (!page) return
    if (pages.value.findIndex((p) => p.id === id) === origin) {
        notice.value = `${page.title} ${verb} at ${where(id)}.`
        return
    }
    // The home marker moves with the drop, not during the drag.
    homeId.value = pages.value[0]?.id ?? ''
    notice.value = `${page.title} ${verb === 'dropped' ? 'dropped at' : 'moved to'} ${where(id)}. Saving order.`
    await save(id)
}

async function onMove(page: PageItem, delta: -1 | 1, kind: 'up' | 'down'): Promise<void> {
    if (!canMove.value || grab.value) return
    const origin = pages.value.findIndex((p) => p.id === page.id)
    const target = origin + delta
    if (target < 0 || target >= pages.value.length) return
    lastControl = { id: page.id, kind }
    await moveTo(page.id, target)
    await dropRow(page.id, origin, 'moved')
}

async function save(id: string): Promise<void> {
    const title = pageById(id)?.title ?? ''
    const previous = saved
    saving.value = true
    movedId.value = id
    suppressBlur = true
    let refocus = true
    try {
        const { data } = await api.PUT('/sites/{id}/menu', {
            params: { path: { id: siteId } },
            body: { page_ids: pages.value.map((p) => p.id) },
            signal: controller.signal,
        })
        if (controller.signal.aborted) return
        const byId = new Map(pages.value.map((p) => [p.id, p] as const))
        const ordered = (data?.page_ids ?? [])
            .map((pid) => byId.get(pid))
            .filter((p): p is PageItem => p !== undefined)
        if (ordered.length !== pages.value.length) throw new Error('Unexpected menu response')
        const oldHome = previous[0]?.id
        // The echoed order wins.
        setPages(ordered)
        remember()
        mismatch.value = false
        dismissToast()
        const home = pages.value[0]
        notice.value =
            home && home.id !== oldHome
                ? `Order saved. ${home.title} is now your home page.`
                : 'Order saved.'
    } catch (error) {
        if (controller.signal.aborted || isAbort(error)) {
            refocus = false
            return
        }
        if (isApiError(error) && error.code === 'menu_mismatch') {
            await refresh()
            refocus = false
        } else if (isApiError(error) && error.code === 'site_not_found') {
            phase.value = 'missing'
            clearSiteNav()
            refocus = false
        } else {
            revert(previous)
            // Sign-in owns a 401: the order goes back and nothing else shows.
            if (isApiError(error) && error.code === 'unauthenticated') {
                notice.value = ''
            } else {
                showErrorToast(
                    "We couldn't save the new order. Your pages are back in their last saved order.",
                )
                notice.value = `Order not saved. ${title} is back at ${where(id)}.`
            }
        }
    } finally {
        if (!controller.signal.aborted) {
            saving.value = false
            movedId.value = ''
            if (refocus && phase.value === 'ready') {
                await focusControl(lastControl.id, lastControl.kind)
            }
            suppressBlur = false
        }
    }
}

/** Back to the last saved order, the moved row gliding home. */
function revert(previous: PageItem[]): void {
    const id = movedId.value
    const top = rowElement(id)?.getBoundingClientRect().top ?? 0
    pages.value = previous.slice()
    homeId.value = pages.value[0]?.id ?? ''
    void nextTick().then(() => {
        const el = rowElement(id)
        if (el) void glide(el, top)
    })
}

/** menu_mismatch: reload quietly (rows stay, controls wait), then ask to try again. */
async function refresh(): Promise<void> {
    refreshing.value = true
    notice.value = ''
    const id = lastControl.id
    try {
        const all = await fetchPagesRestarting()
        if (controller.signal.aborted) return
        setPages(all)
        remember()
        mismatch.value = true
        await nextTick()
        const handle = controlElement(id, 'handle')
        if (handle) handle.focus()
        else document.querySelector<HTMLElement>('h1')?.focus()
    } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return
        if (isApiError(error) && error.code === 'unauthenticated') return
        phase.value = 'failed'
    } finally {
        if (!controller.signal.aborted) refreshing.value = false
    }
}

/* Pointer drag: mouse, pen and touch share these events on the handle. */

function onEscapeDuringDrag(e: KeyboardEvent): void {
    if (e.key === 'Escape' && grab.value?.mode === 'pointer') void cancelGrab()
}

/** The row follows the pointer in page coordinates, so scrolling during a drag keeps it under the pointer. */
function updateDrag(): void {
    if (grab.value?.mode !== 'pointer') return
    dragDy.value = dragClientY + window.scrollY - (dragStartY + dragStartScroll)
    dragSlot.value = dragOthers.value.filter((p) => {
        const r = rowElement(p.id)?.getBoundingClientRect()
        return r ? r.top + r.height / 2 < dragClientY : false
    }).length
}

/** Pointer-captured drags get no browser drag scroll, so near the viewport edge the page scrolls. */
function autoScroll(): void {
    dragFrame = 0
    const g = grab.value
    if (g?.mode !== 'pointer') return
    // Edge and step come from the row itself: one row height from the edge, an eighth per frame.
    const height = rowElement(g.id)?.getBoundingClientRect().height ?? 0
    let step = 0
    if (dragClientY < height) step = -height / 8
    else if (dragClientY > window.innerHeight - height) step = height / 8
    if (!step) return
    window.scrollBy?.(0, step)
    updateDrag()
    dragFrame = requestAnimationFrame(autoScroll)
}

function removeEscapeListener(): void {
    window.removeEventListener('keydown', onEscapeDuringDrag)
    window.removeEventListener('scroll', updateDrag)
    if (dragFrame) cancelAnimationFrame(dragFrame)
    dragFrame = 0
}

function onPointerDown(e: PointerEvent, page: PageItem): void {
    if (!canMove.value || grab.value) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture?.(e.pointerId)
    lastControl = { id: page.id, kind: 'handle' }
    dragPointerId = e.pointerId
    dragStartY = e.clientY
    dragClientY = e.clientY
    dragStartScroll = window.scrollY
    dragDy.value = 0
    pickUp(page, 'pointer')
    dragSlot.value = pages.value.findIndex((p) => p.id === page.id)
    window.addEventListener('keydown', onEscapeDuringDrag)
    window.addEventListener('scroll', updateDrag)
}

function onPointerMove(e: PointerEvent): void {
    if (grab.value?.mode !== 'pointer' || e.pointerId !== dragPointerId) return
    dragClientY = e.clientY
    updateDrag()
    if (!dragFrame) dragFrame = requestAnimationFrame(autoScroll)
}

async function onPointerUp(e: PointerEvent): Promise<void> {
    const g = grab.value
    if (g?.mode !== 'pointer' || e.pointerId !== dragPointerId) return
    const handle = e.currentTarget as HTMLElement
    if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture?.(e.pointerId)
    const area = list.value?.getBoundingClientRect()
    const inside =
        !!area &&
        e.clientX >= area.left &&
        e.clientX <= area.right &&
        e.clientY >= area.top &&
        e.clientY <= area.bottom
    if (!inside) {
        await cancelGrab()
        return
    }
    const slot = dragSlot.value
    const releasedTop = rowElement(g.id)?.getBoundingClientRect().top ?? 0
    removeEscapeListener()
    grab.value = null
    dragDy.value = 0
    dragSlot.value = -1
    // The row settles from where it was released into its slot.
    suppressBlur = true
    const next = pages.value.filter((p) => p.id !== g.id)
    const row = pageById(g.id)
    if (row) next.splice(slot, 0, row)
    pages.value = next
    await nextTick()
    const el = rowElement(g.id)
    if (el) void glide(el, releasedTop)
    await dropRow(g.id, g.origin, 'dropped')
    suppressBlur = false
}

function onPointerCancel(e: PointerEvent): void {
    if (grab.value?.mode === 'pointer' && e.pointerId === dragPointerId) void cancelGrab()
}

/** After add: say where the page landed and focus its title link. */
async function announceAdded(): Promise<void> {
    const row = addedPage ? pages.value.find((p) => p.id === addedPage.id) : undefined
    if (!row) return
    addedId.value = row.id
    notice.value = `${row.title} added at position ${position(row)} of ${count.value}.`
    await nextTick()
    list.value?.querySelector<HTMLElement>(`[data-page-id="${row.id}"] .hs-row__title`)?.focus()
}

const documentTitle = computed(() =>
    site.value ? `Pages · ${site.value.name} · Hivesite Studio` : undefined,
)
const statusText = computed(() => {
    if (phase.value === 'loading') return 'Loading pages…'
    if (phase.value === 'failed') return "Error: We couldn't load the pages of this site."
    return notice.value
})

onMounted(() => {
    void load()
})
onBeforeUnmount(() => {
    controller.abort()
    removeEscapeListener()
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
                        v-slot="{ href, navigate }"
                        custom
                        :to="`/sites/${siteId}/pages/new`"
                    >
                        <a
                            class="hs-button"
                            :href="href"
                            aria-describedby="page-count"
                            :aria-disabled="busy ? 'true' : undefined"
                            @click="go($event, navigate)"
                            >Add page</a
                        >
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

        <template v-else>
            <p v-if="count > 1" id="reorder-help" class="hs-visually-hidden">
                Press Space to pick up the page. Use the up and down arrow keys to move it, Space to
                drop it, Escape to cancel.
            </p>
            <div v-if="mismatch" class="hs-note" role="alert">
                <strong>Note:</strong> Your pages changed somewhere else, so we reloaded the list.
                Please make your move again.
            </div>
            <ol ref="list" class="hs-list" aria-label="Pages" :aria-busy="busy ? 'true' : 'false'">
                <li
                    v-for="page in pages"
                    :key="page.id"
                    class="hs-row"
                    :class="{
                        'hs-row--new': page.id === addedId,
                        'hs-row--over-before': page.id === overBeforeId,
                        'hs-row--over-after': page.id === overAfterId,
                    }"
                    :data-page-id="page.id"
                    :data-reorder="rowState(page)"
                    :style="rowStyle(page)"
                >
                    <button
                        v-if="count > 1"
                        type="button"
                        class="hs-handle"
                        data-action="handle"
                        aria-describedby="reorder-help"
                        :aria-pressed="grab?.id === page.id ? 'true' : 'false'"
                        :aria-disabled="busy ? 'true' : undefined"
                        @keydown="onHandleKey($event, page)"
                        @keyup.space.prevent
                        @click.prevent
                        @pointerdown="onPointerDown($event, page)"
                        @pointermove="onPointerMove"
                        @pointerup="onPointerUp"
                        @pointercancel="onPointerCancel"
                        @focusout="onHandleBlur(page)"
                    >
                        <span aria-hidden="true">⠿</span>
                        <span class="hs-visually-hidden"
                            >Reorder {{ page.title }}, position {{ position(page) }} of
                            {{ count }}</span
                        >
                    </button>
                    <span class="hs-row__pos" aria-hidden="true">{{ position(page) }}</span>
                    <div class="hs-row__main">
                        <div class="hs-row__head">
                            <RouterLink
                                v-slot="{ href, navigate }"
                                custom
                                :to="`/pages/${page.id}/edit`"
                            >
                                <a
                                    class="hs-row__title"
                                    :href="href"
                                    :aria-describedby="isHome(page) ? `home-${page.id}` : undefined"
                                    :aria-disabled="busy ? 'true' : undefined"
                                    @click="go($event, navigate)"
                                    >{{ page.title }}</a
                                >
                            </RouterLink>
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
                            v-slot="{ href, navigate }"
                            custom
                            :to="`/pages/${page.id}/blocks`"
                        >
                            <a
                                class="hs-button hs-button--quiet"
                                :href="href"
                                :aria-label="`Edit blocks of ${page.title}`"
                                :aria-disabled="busy ? 'true' : undefined"
                                @click="go($event, navigate)"
                                >Edit blocks</a
                            >
                        </RouterLink>
                        <template v-if="count > 1">
                            <button
                                type="button"
                                class="hs-button hs-button--quiet"
                                data-action="up"
                                :aria-label="`Move ${page.title} up`"
                                :aria-describedby="
                                    position(page) === 1 ? `first-${page.id}` : undefined
                                "
                                :aria-disabled="busy || position(page) === 1 ? 'true' : undefined"
                                @click="onMove(page, -1, 'up')"
                            >
                                <span aria-hidden="true">↑</span>
                            </button>
                            <button
                                type="button"
                                class="hs-button hs-button--quiet"
                                data-action="down"
                                :aria-label="`Move ${page.title} down`"
                                :aria-describedby="
                                    position(page) === count ? `last-${page.id}` : undefined
                                "
                                :aria-disabled="
                                    busy || position(page) === count ? 'true' : undefined
                                "
                                @click="onMove(page, 1, 'down')"
                            >
                                <span aria-hidden="true">↓</span>
                            </button>
                            <span
                                v-if="position(page) === 1"
                                :id="`first-${page.id}`"
                                class="hs-visually-hidden"
                                >Already first</span
                            >
                            <span
                                v-if="position(page) === count"
                                :id="`last-${page.id}`"
                                class="hs-visually-hidden"
                                >Already last</span
                            >
                        </template>
                        <button
                            type="button"
                            class="hs-button hs-button--quiet"
                            data-action="delete"
                            :aria-label="`Delete ${page.title}`"
                            :aria-disabled="busy ? 'true' : undefined"
                            @click="openDelete(page)"
                        >
                            Delete
                        </button>
                    </div>
                </li>
            </ol>
        </template>

        <DeletePageDialog
            v-if="deleting"
            ref="dialog"
            :title="deleting.title"
            :next-title="nextHomeTitle"
            :only-page="onlyPage"
            :busy="deleteBusy"
            :failed="deleteFailed"
            @cancel="cancelDelete"
            @confirm="confirmDelete"
        />
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

.hs-note {
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
    position: relative;
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-areas:
        'handle pos main'
        'actions actions actions';
    align-items: center;
    column-gap: var(--hs-space-3);
    row-gap: var(--hs-space-2);
    padding-block: var(--hs-space-4);
    padding-inline: var(--hs-space-3);
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
    background: var(--hs-color-background);
    transition: background-color var(--hs-motion-duration-base) var(--hs-motion-easing-standard);
}

/* Grab: the row is lifted. The edge stands in for elevation (shell.md, Token gaps). */
.hs-row[data-reorder='grabbed'] {
    background: var(--hs-color-surface-sunk);
    outline: var(--hs-border-width-hairline) solid var(--hs-color-border-strong);
    outline-offset: calc(-1 * var(--hs-border-width-hairline));
}

/* The lifted and the saving row paint above the rows after them (z_index.drag has no token yet). */
.hs-row[data-reorder='grabbed'],
.hs-row[data-reorder='saving'] {
    z-index: 1;
}

/* Over: a line in the gap where the dragged row would land. No transition. */
.hs-row--over-before::before,
.hs-row--over-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    block-size: var(--hs-border-width-indicator);
    background: var(--hs-color-accent);
}

.hs-row--over-before::before {
    inset-block-start: calc(-0.5 * var(--hs-border-width-indicator));
}

.hs-row--over-after::after {
    inset-block-end: calc(-0.5 * var(--hs-border-width-indicator));
}

.hs-handle {
    grid-area: handle;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--hs-control-min-height);
    block-size: var(--hs-control-min-height);
    padding: 0;
    border: var(--hs-border-width-control) solid transparent;
    border-radius: var(--hs-radius-control);
    background: transparent;
    color: var(--hs-color-text-muted);
    font-size: var(--hs-font-size-body);
    cursor: grab;
    touch-action: none;
}

.hs-row[data-reorder='grabbed'] .hs-handle {
    cursor: grabbing;
}

.hs-handle[aria-disabled='true'] {
    border-color: var(--hs-color-disabled-border);
    color: var(--hs-color-disabled-text);
    cursor: default;
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
        grid-template-columns: auto auto minmax(0, 1fr) auto;
        grid-template-areas: 'handle pos main actions';
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
