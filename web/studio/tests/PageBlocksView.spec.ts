import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

const SITE_ID = '0192f0a0-0000-7000-8000-00000000000a'
const PAGE_ID = '0192f0a0-0000-7000-8000-000000000002'
const PATH = `/pages/${PAGE_ID}/blocks`
const SITE = {
    id: SITE_ID,
    name: 'Atelier Noor',
    slug: 'atelier-noor',
    settings: { language: 'en', description: '' },
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-28T09:14:03Z',
}
const PAGE = {
    id: PAGE_ID,
    site_id: SITE_ID,
    title: 'About',
    slug: 'about',
    menu_order: 1,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-28T11:02:00Z',
}
const TYPES = [
    ['hero', 'Hero'],
    ['rich_text', 'Rich text'],
    ['image', 'Image'],
    ['gallery', 'Gallery'],
    ['card_list', 'Card list'],
    ['contact_form', 'Contact form'],
    ['embed', 'Embed'],
].map(([type, name]) => ({ type, name, description: `${name}.`, version: 1, schema: {} }))

const hero = (title: string) => ({
    type: 'hero',
    attrs: { title, subtitle: '', image: null, cta: null },
})
const doc = (content: unknown[]) => ({ type: 'doc', content })

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    })
}
const fail = (status: number, code: string) =>
    json({ error: { code, message: 'Server words.' } }, status)

interface Answers {
    blocks?: Response
    page?: Response
    types?: Response | Response[]
    site?: Response
}

function serve(a: Answers = {}) {
    const typeAnswers = Array.isArray(a.types) ? [...a.types] : undefined
    fetchMock.mockImplementation((req: Request) => {
        const url = new URL(req.url)
        const pick = (r: Response) => Promise.resolve(r.clone())
        if (url.pathname === `/pages/${PAGE_ID}/blocks`) {
            return pick(a.blocks ?? json(doc([hero('Made slowly')]), 200, { ETag: '"7"' }))
        }
        if (url.pathname === `/pages/${PAGE_ID}`) return pick(a.page ?? json(PAGE))
        if (url.pathname === '/block-types') {
            if (typeAnswers)
                return pick(typeAnswers.shift() ?? json({ items: [], next_cursor: null }))
            return pick(
                (a.types as Response | undefined) ?? json({ items: TYPES, next_cursor: null }),
            )
        }
        if (url.pathname === `/sites/${SITE_ID}`) return pick(a.site ?? json(SITE))
        return pick(json({ items: [], next_cursor: null }))
    })
}

const paths = () => fetchMock.mock.calls.map(([r]) => new URL((r as Request).url).pathname)

let router: Router
async function open(): Promise<VueWrapper> {
    router = createStudioRouter(createMemoryHistory())
    await router.push('/sites')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    await router.push(PATH)
    await flushPromises()
    return wrapper
}

const panels = (w: VueWrapper) => w.findAll('li.hs-block')

beforeEach(() => {
    fetchMock.mockReset()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('page blocks: loading', () => {
    it('(AC1) calls blocks, page and block types at once, then the site, and shows the editor after the first three', async () => {
        const gates: Array<() => void> = []
        fetchMock.mockImplementation((req: Request) => {
            const path = new URL(req.url).pathname
            const answer = (body: unknown, headers = {}) =>
                new Promise<Response>((resolve) => {
                    gates.push(() => resolve(json(body, 200, headers)))
                })
            if (path === `/pages/${PAGE_ID}/blocks`)
                return answer(doc([hero('A')]), { ETag: '"7"' })
            if (path === `/pages/${PAGE_ID}`) return answer(PAGE)
            if (path === '/block-types') return answer({ items: TYPES, next_cursor: null })
            if (path === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
            return Promise.resolve(json({ items: [], next_cursor: null }))
        })
        router = createStudioRouter(createMemoryHistory())
        await router.push(PATH)
        await router.isReady()
        const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
        await flushPromises()

        expect(paths().filter((p) => p !== '/sites')).toEqual([
            `/pages/${PAGE_ID}/blocks`,
            `/pages/${PAGE_ID}`,
            '/block-types',
        ])
        expect(w.find('.hs-block-list').exists()).toBe(false)
        gates.slice(0, 2).forEach((open) => open())
        await flushPromises()
        expect(w.find('.hs-block-list').exists()).toBe(false)
        expect(paths()).not.toContain(`/sites/${SITE_ID}`)
        gates[2]?.()
        await flushPromises()

        expect(paths()).toContain(`/sites/${SITE_ID}`)
        expect(panels(w)).toHaveLength(1)
    })

    it('(AC1) follows next_cursor on block types until it is null', async () => {
        serve({
            types: [
                json({ items: TYPES.slice(0, 3), next_cursor: 'c2' }),
                json({ items: TYPES.slice(3), next_cursor: null }),
            ],
        })
        const w = await open()
        const typeCalls = fetchMock.mock.calls
            .map(([r]) => new URL((r as Request).url))
            .filter((u) => u.pathname === '/block-types')
        expect(typeCalls).toHaveLength(2)
        expect(typeCalls[1]?.searchParams.get('cursor')).toBe('c2')
        expect(w.get('.hs-block__name').text()).toBe('Hero')
    })

    it('(AC3) while loading, the placeholders show', async () => {
        fetchMock.mockImplementation(() => new Promise(() => {}))
        router = createStudioRouter(createMemoryHistory())
        await router.push(PATH)
        await router.isReady()
        const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
        await flushPromises()
        expect(w.get('.hs-placeholder').attributes('aria-busy')).toBe('true')
        expect(w.get('[role="status"]').text()).toBe('Loading…')
    })
})

describe('page blocks: head', () => {
    it('(AC2) shows the site as eyebrow, "Blocks of {title}" with focus, the document title and the nav', async () => {
        serve()
        const w = await open()

        expect(w.get('.hs-eyebrow').text()).toBe('Atelier Noor')
        expect(w.get('h1').text()).toBe('Blocks of About')
        expect(document.activeElement).toBe(w.get('h1').element)
        expect(document.title).toBe('Blocks · About · Hivesite Studio')
        const nav = w
            .get('nav')
            .findAll('a')
            .find((a) => a.text() === 'Pages')
        expect(nav?.attributes('aria-current')).toBe('page')
    })

    it('(AC2) "Back to pages" links to the pages of the site', async () => {
        serve()
        const w = await open()
        const back = w.findAll('a').find((a) => a.text() === 'Back to pages')
        expect(back?.attributes('href')).toBe(`/sites/${SITE_ID}/pages`)
    })

    it('(AC9) has the status line, empty while saved, and a Save blocks button that does nothing yet', async () => {
        serve()
        const w = await open()
        expect(w.get('.hs-status').text()).toBe('')
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        const save = w.get('button[type="submit"]')
        expect(save.text()).toBe('Save blocks')
        const before = fetchMock.mock.calls.length
        await save.trigger('click')
        await flushPromises()
        expect(fetchMock.mock.calls.length).toBe(before)
        expect(w.get('.hs-status').text()).toBe('')
    })

    it('(AC9) every request carries an abort signal and leaving aborts them', async () => {
        serve()
        const w = await open()
        const signals = fetchMock.mock.calls
            .map(([r]) => r as Request)
            .filter((r) => new URL(r.url).pathname.startsWith('/pages'))
            .map((r) => r.signal)
        expect(signals.length).toBeGreaterThan(0)
        await router.push('/sites')
        await flushPromises()
        expect(signals.every((s) => s.aborted)).toBe(true)
        w.unmount()
    })
})

describe('page blocks: failures', () => {
    it.each([
        ['blocks', { blocks: fail(500, 'internal_error') }],
        ['page', { page: fail(500, 'internal_error') }],
        ['block types', { types: fail(400, 'invalid_request') }],
    ] as const)(
        '(AC3) a failing %s call shows the load error and no editor',
        async (_n, answers) => {
            serve(answers)
            const w = await open()
            expect(w.get('.hs-form-message').text()).toBe(
                "Error: We couldn't load the blocks of this page.",
            )
            expect(w.find('.hs-block-list').exists()).toBe(false)
            expect(w.find('button[type="submit"]').exists()).toBe(false)
        },
    )

    it('(AC3) "Try again" loads again', async () => {
        serve({ blocks: fail(500, 'internal_error') })
        const w = await open()
        serve()
        const retry = w.findAll('button').find((b) => b.text() === 'Try again')
        await retry?.trigger('click')
        await flushPromises()
        expect(panels(w)).toHaveLength(1)
        expect(w.find('.hs-form-message').exists()).toBe(false)
    })

    it('(AC3) page_not_found shows the not-found screen without "Back to pages"', async () => {
        serve({ page: fail(404, 'page_not_found'), blocks: fail(404, 'page_not_found') })
        const w = await open()
        expect(w.get('h1').text()).toBe("We can't find that page")
        expect(w.findAll('a').some((a) => a.text() === 'Back to pages')).toBe(false)
    })

    it('(AC3) a failing site call also shows the load error', async () => {
        serve({ site: fail(500, 'internal_error') })
        const w = await open()
        expect(w.find('.hs-form-message').exists()).toBe(true)
        expect(w.find('.hs-block-list').exists()).toBe(false)
    })
})

describe('page blocks: the list', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => hero(`Hero ${i + 1}`))

    it('(AC4) each block is a panel in order with its position, type name, summary and the count', async () => {
        serve({
            blocks: json(
                doc([
                    hero('Made slowly'),
                    { type: 'embed', attrs: { title: 'Map', provider: 'google_maps', url: 'x' } },
                ]),
            ),
        })
        const w = await open()
        const [first, second] = panels(w)
        expect(first?.get('.hs-block__pos').text()).toBe('1')
        expect(first?.get('.hs-block__name').text()).toBe('Hero')
        expect(first?.get('.hs-block__summary').text()).toBe('Made slowly')
        expect(second?.get('.hs-block__name').text()).toBe('Embed')
        expect(second?.get('.hs-block__summary').text()).toBe('Map · Google Maps')
        expect(w.get('#block-count').text()).toBe('2 of 40 blocks')
    })

    it('(AC5) with three blocks or fewer every block starts open', async () => {
        serve({ blocks: json(doc(many(3))) })
        const w = await open()
        const toggles = w.findAll('.hs-block__toggle')
        expect(toggles.map((t) => t.attributes('aria-expanded'))).toEqual(['true', 'true', 'true'])
    })

    it('(AC5) with more than three blocks every block starts closed; opening one leaves the others', async () => {
        serve({ blocks: json(doc(many(4))) })
        const w = await open()
        const toggles = () => w.findAll('.hs-block__toggle')
        expect(toggles().every((t) => t.attributes('aria-expanded') === 'false')).toBe(true)

        await toggles()[1]?.trigger('click')
        await toggles()[2]?.trigger('click')
        expect(toggles().map((t) => t.attributes('aria-expanded'))).toEqual([
            'false',
            'true',
            'true',
            'false',
        ])
        await toggles()[1]?.trigger('click')
        expect(toggles()[1]?.attributes('aria-expanded')).toBe('false')
    })

    it('(AC5) the title is an h2 holding a button that controls the body', async () => {
        serve()
        const w = await open()
        const toggle = w.get('h2 > button.hs-block__toggle')
        expect(toggle.element.tagName).toBe('BUTTON')
        expect(w.find(`#${toggle.attributes('aria-controls')}`).exists()).toBe(true)
    })

    it('(AC6) a page with no blocks shows the empty state and "0 of 40 blocks"', async () => {
        serve({ blocks: json(doc([])) })
        const w = await open()
        expect(w.text()).toContain('This page has no blocks yet.')
        expect(w.text()).toContain('Add a hero to open the page, then text, images or a form.')
        expect(w.get('#block-count').text()).toBe('0 of 40 blocks')
        expect(w.get('.hs-status').text()).toBe('')
        expect(panels(w)).toHaveLength(0)
    })

    it('(AC7) a block of an unknown type shows the Note in its body', async () => {
        serve({ blocks: json(doc([{ type: 'timeline', attrs: { a: 1 } }])) })
        const w = await open()
        expect(w.get('.hs-block__name').text()).toBe('timeline')
        expect(w.get('.hs-block__note').text()).toBe(
            "Note: This studio can't edit this block yet. It stays as it is when you save.",
        )
    })

    it('(AC7) a block whose type has a version other than 1 shows the Note', async () => {
        serve({
            types: json({
                items: TYPES.map((t) => (t.type === 'hero' ? { ...t, version: 2 } : t)),
                next_cursor: null,
            }),
        })
        const w = await open()
        expect(w.get('.hs-block__name').text()).toBe('Hero')
        expect(w.find('.hs-block__note').exists()).toBe(true)
    })

    it('(AC7) a supported block has no Note', async () => {
        serve()
        const w = await open()
        expect(w.find('.hs-block__note').exists()).toBe(false)
    })

    it('(AC8) a loaded document leaves nothing unsaved', async () => {
        serve({ blocks: json(doc([hero('A'), { type: 'timeline', attrs: { x: ' y ' } }])) })
        const w = await open()
        expect(w.get('.hs-status').text()).toBe('')
    })
})
