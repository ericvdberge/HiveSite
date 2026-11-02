import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast } from '../src/composables/useToast'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

const SITE_ID = '0192f0a0-0000-7000-8000-00000000000a'
const SITE = {
    id: SITE_ID,
    name: 'Atelier Noor',
    slug: 'atelier-noor',
    settings: { language: 'en', description: '' },
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-28T09:14:03Z',
}

function page(n: number, title = `Page ${n}`, order = n - 1) {
    return {
        id: `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
        site_id: SITE_ID,
        title,
        slug: `page-${n}`,
        menu_order: order,
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T09:14:03Z',
    }
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function fail(status: number, code: string): Response {
    return json({ error: { code, message: 'Server words.' } }, status)
}

type Pages = { items: ReturnType<typeof page>[]; next_cursor: string | null }

const pageCalls = () =>
    fetchMock.mock.calls
        .map(([req]) => new URL((req as Request).url))
        .filter((u) => u.pathname.endsWith('/pages'))

const deleteCalls = () =>
    fetchMock.mock.calls.map(([req]) => req as Request).filter((r) => r.method === 'DELETE')

/** Serves the site, the page lists (in order, last repeats) and DELETE with `deleteResponse`. */
function serveAll(pageResponses: Pages[], deleteResponse: Response) {
    const queue = [...pageResponses]
    fetchMock.mockImplementation((req: Request) => {
        const url = new URL(req.url)
        if (req.method === 'DELETE') return Promise.resolve(deleteResponse.clone())
        if (url.pathname === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
        const next = queue.length > 1 ? queue.shift() : queue[0]
        return Promise.resolve(json(next))
    })
}

async function open(): Promise<VueWrapper> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(`/sites/${SITE_ID}/pages`)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

const rows = (w: VueWrapper) => w.findAll('.hs-row')
const dialogOf = (w: VueWrapper) => w.find('dialog.hs-dialog')
function button(w: VueWrapper, label: string) {
    const found = w.findAll('dialog button').find((b) => b.text() === label)
    if (!found) throw new Error(`No dialog button "${label}"`)
    return found
}
function row(w: VueWrapper, index: number) {
    const found = rows(w)[index]
    if (!found) throw new Error(`No row ${index}`)
    return found
}
const deleteButton = (w: VueWrapper, index: number) => row(w, index).get('[data-action="delete"]')
const noContent = () => new Response(null, { status: 204 })
const three = () => [page(1, 'Home'), page(2, 'About'), page(3, 'Our work')]

async function confirm(w: VueWrapper, row: number) {
    await deleteButton(w, row).trigger('click')
    await button(w, 'Delete page').trigger('click')
    await flushPromises()
}

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('delete page: the confirm dialog names the page', () => {
    it('AC6: each row has a Delete button named with the page title that opens a dialog without any call', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        const calls = fetchMock.mock.calls.length

        expect(deleteButton(w, 1).attributes('aria-label')).toBe('Delete About')
        await deleteButton(w, 1).trigger('click')

        expect(dialogOf(w).exists()).toBe(true)
        expect(w.get('#del-title').text()).toBe('Delete "About"?')
        expect(w.get('#del-body').text()).toContain(
            "This deletes the page and all its blocks. It can't be undone.",
        )
        expect(w.get('#del-body').text()).toContain(
            'Releases you have already published keep their copy.',
        )
        expect(w.find('.hs-dialog__lead').exists()).toBe(false)
        expect(dialogOf(w).attributes('aria-labelledby')).toBe('del-title')
        expect(dialogOf(w).attributes('aria-describedby')).toBe('del-body')
        expect(fetchMock.mock.calls.length).toBe(calls)
        w.unmount()
    })

    it('AC6: deleting the home page says which page becomes home', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await deleteButton(w, 0).trigger('click')

        expect(w.get('#del-title').text()).toBe('Delete "Home"?')
        expect(w.get('.hs-dialog__lead').text()).toBe(
            'Home is your home page. About becomes the home page.',
        )
        w.unmount()
    })

    it('AC6: the only page says the site will have no home page', async () => {
        serveAll([{ items: [page(1, 'Home')], next_cursor: null }], noContent())
        const w = await open()
        await deleteButton(w, 0).trigger('click')

        expect(w.get('.hs-dialog__lead').text()).toBe(
            "This is the site's only page. The site will have no home page until you add one.",
        )
        w.unmount()
    })

    it('AC6: focus is on Cancel on open, and Cancel returns it to the row Delete button without a call', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await deleteButton(w, 1).trigger('click')

        expect(document.activeElement).toBe(button(w, 'Cancel').element)
        await button(w, 'Cancel').trigger('click')
        await flushPromises()

        expect(dialogOf(w).exists()).toBe(false)
        expect(document.activeElement).toBe(deleteButton(w, 1).element)
        expect(deleteCalls()).toHaveLength(0)
        w.unmount()
    })

    it('AC6: Escape cancels the dialog', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await deleteButton(w, 1).trigger('click')
        await dialogOf(w).trigger('cancel')
        await flushPromises()

        expect(dialogOf(w).exists()).toBe(false)
        w.unmount()
    })
})

describe('delete page: 204 closes the gap without a reload', () => {
    it('AC6: sends DELETE /pages/{id}, drops the row, renumbers, and focuses the row now in its place', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        const listCalls = pageCalls().length
        await confirm(w, 1)

        const call = deleteCalls()[0] as Request
        expect(new URL(call.url).pathname).toBe(`/pages/${page(2).id}`)
        expect(pageCalls().length).toBe(listCalls)
        expect(dialogOf(w).exists()).toBe(false)
        expect(rows(w).map((r) => r.get('.hs-row__title').text())).toEqual(['Home', 'Our work'])
        expect(rows(w).map((r) => r.get('.hs-row__pos').text())).toEqual(['1', '2'])
        expect(w.get('#page-count').text()).toBe('2 of 50 pages')
        expect(w.get('.hs-list-status').text()).toBe('About deleted.')
        expect(document.activeElement).toBe(row(w, 1).get('.hs-row__title').element)
        w.unmount()
    })

    it('AC6: deleting the last row focuses the new last row title', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await confirm(w, 2)

        expect(document.activeElement).toBe(row(w, 1).get('.hs-row__title').element)
        w.unmount()
    })

    it('AC6: deleting the home page makes the next page home and says so', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await confirm(w, 0)

        expect(row(w, 0).get('.hs-home').text()).toBe('Home page')
        expect(row(w, 0).get('.hs-row__title').text()).toBe('About')
        expect(row(w, 0).get('.hs-path').text()).toBe('/s/atelier-noor/')
        expect(w.findAll('.hs-home')).toHaveLength(1)
        expect(w.get('.hs-list-status').text()).toBe('Home deleted. About is now your home page.')
        w.unmount()
    })

    it('AC6: deleting the only page shows the empty state and focuses Add a page', async () => {
        serveAll([{ items: [page(1, 'Home')], next_cursor: null }], noContent())
        const w = await open()
        await confirm(w, 0)

        expect(w.get('h2').text()).toBe('This site has no pages yet')
        expect(document.activeElement).toBe(w.get('.hs-empty a').element)
        w.unmount()
    })

    it('AC6: while the call runs the buttons read Deleting… and are unavailable', async () => {
        let release: (r: Response) => void = () => {}
        fetchMock.mockImplementation((req: Request) => {
            const url = new URL(req.url)
            if (req.method === 'DELETE') return new Promise<Response>((r) => (release = r))
            if (url.pathname === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
            return Promise.resolve(json({ items: three(), next_cursor: null }))
        })
        const w = await open()
        await deleteButton(w, 1).trigger('click')
        await button(w, 'Delete page').trigger('click')
        await flushPromises()

        const busy = button(w, 'Deleting…')
        expect(busy.attributes('aria-disabled')).toBe('true')
        expect(button(w, 'Cancel').attributes('aria-disabled')).toBe('true')
        await button(w, 'Cancel').trigger('click')
        await busy.trigger('click')
        await dialogOf(w).trigger('cancel')
        expect(dialogOf(w).exists()).toBe(true)
        expect(deleteCalls()).toHaveLength(1)

        release(noContent())
        await flushPromises()
        expect(dialogOf(w).exists()).toBe(false)
        w.unmount()
    })
})

describe('delete page: failures', () => {
    it('AC6: a 404 page_not_found closes the dialog, reloads the list and says it was already deleted', async () => {
        serveAll(
            [
                { items: three(), next_cursor: null },
                { items: [page(1, 'Home', 0), page(3, 'Our work', 1)], next_cursor: null },
            ],
            fail(404, 'page_not_found'),
        )
        const w = await open()
        await confirm(w, 1)

        expect(w.find('.hs-not-found').exists()).toBe(false)
        expect(dialogOf(w).exists()).toBe(false)
        expect(pageCalls()).toHaveLength(2)
        expect(rows(w).map((r) => r.get('.hs-row__title').text())).toEqual(['Home', 'Our work'])
        expect(w.get('.hs-list-status').text()).toBe(
            'That page was already deleted. The list is up to date.',
        )
        expect(document.activeElement).toBe(row(w, 1).get('.hs-row__title').element)
        w.unmount()
    })

    it('AC6: a server failure keeps the dialog open with a message and returns the buttons to idle', async () => {
        serveAll([{ items: three(), next_cursor: null }], fail(500, 'internal_error'))
        const w = await open()
        await confirm(w, 1)

        expect(dialogOf(w).exists()).toBe(true)
        expect(w.get('dialog [role="alert"]').text()).toBe(
            "Error: We couldn't delete the page. Please try again.",
        )
        expect(button(w, 'Delete page').attributes('aria-disabled')).toBeUndefined()
        expect(rows(w)).toHaveLength(3)
        w.unmount()
    })

    it('AC6: a 401 shows nothing of its own and the dialog returns to idle', async () => {
        serveAll([{ items: three(), next_cursor: null }], fail(401, 'unauthenticated'))
        const w = await open()
        await confirm(w, 1)

        expect(w.find('dialog [role="alert"]').exists()).toBe(false)
        expect(button(w, 'Delete page').attributes('aria-disabled')).toBeUndefined()
        w.unmount()
    })
})

describe('delete page: fix round', () => {
    it('AC6: a second Escape and a browser close while Deleting… keep the dialog and its state', async () => {
        let release: (r: Response) => void = () => {}
        fetchMock.mockImplementation((req: Request) => {
            const url = new URL(req.url)
            if (req.method === 'DELETE') return new Promise<Response>((r) => (release = r))
            if (url.pathname === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
            return Promise.resolve(json({ items: three(), next_cursor: null }))
        })
        const w = await open()
        await deleteButton(w, 1).trigger('click')
        await button(w, 'Delete page').trigger('click')
        await flushPromises()

        await dialogOf(w).trigger('keydown', { key: 'Escape' })
        await dialogOf(w).trigger('keydown', { key: 'Escape' })
        dialogOf(w).element.dispatchEvent(new Event('close'))
        await flushPromises()
        expect(dialogOf(w).exists()).toBe(true)
        expect(dialogOf(w).attributes('open')).toBeDefined()

        release(fail(500, 'internal_error'))
        await flushPromises()
        expect(w.get('dialog [role="alert"]').text()).toContain("We couldn't delete the page.")
        w.unmount()
    })

    it('AC6: a browser close of an idle dialog is a cancel, so Delete keeps working', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const w = await open()
        await deleteButton(w, 1).trigger('click')
        dialogOf(w).element.dispatchEvent(new Event('close'))
        await flushPromises()

        expect(dialogOf(w).exists()).toBe(false)
        await confirm(w, 2)
        expect(rows(w)).toHaveLength(2)
        w.unmount()
    })

    it('AC6: a second delete cannot start while the first row is still being removed', async () => {
        serveAll([{ items: three(), next_cursor: null }], noContent())
        const animate = vi.fn(() => {
            let done: () => void = () => {}
            const finished = new Promise<void>((r) => (done = r))
            setTimeout(done, 40)
            return { finished }
        })
        Object.defineProperty(HTMLElement.prototype, 'animate', {
            value: animate,
            configurable: true,
            writable: true,
        })
        document.documentElement.style.setProperty('--hs-motion-duration-base', '300ms')
        try {
            const w = await open()
            await deleteButton(w, 0).trigger('click')
            await button(w, 'Delete page').trigger('click')
            // The dialog is closing or the row is fading: another Delete must do nothing.
            await new Promise((r) => setTimeout(r, 60))
            await deleteButton(w, 1).trigger('click')
            expect(dialogOf(w).exists()).toBe(false)
            await new Promise((r) => setTimeout(r, 200))
            await flushPromises()
            expect(deleteCalls()).toHaveLength(1)
            expect(rows(w).map((r) => r.get('.hs-row__title').text())).toEqual([
                'About',
                'Our work',
            ])
            expect(rows(w).map((r) => r.get('.hs-row__pos').text())).toEqual(['1', '2'])
            await deleteButton(w, 1).trigger('click')
            expect(dialogOf(w).exists()).toBe(true)
            w.unmount()
        } finally {
            document.documentElement.style.removeProperty('--hs-motion-duration-base')
            Reflect.deleteProperty(HTMLElement.prototype, 'animate')
        }
    })
})
