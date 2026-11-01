import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast } from '../src/composables/useToast'
import { rememberAddedPage } from '../src/composables/useAddedPage'

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

function page(n: number, title = `Page ${n}`) {
    return {
        id: `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
        site_id: SITE_ID,
        title,
        slug: `page-${n}`,
        menu_order: n - 1,
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T09:14:03Z',
    }
}

const pagesOf = (count: number) => Array.from({ length: count }, (_, i) => page(i + 1))

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

/** Routes GET /sites/{id} and GET /sites/{id}/pages; `pageResponses` are used in order. */
function serve(pageResponses: Array<Pages | Response>, siteResponse: Response = json(SITE)) {
    const queue = [...pageResponses]
    fetchMock.mockImplementation((req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === `/sites/${SITE_ID}`) return Promise.resolve(siteResponse.clone())
        const next = queue.length > 1 ? queue.shift() : queue[0]
        return Promise.resolve(next instanceof Response ? next.clone() : json(next))
    })
}

const pageCalls = () =>
    fetchMock.mock.calls
        .map(([req]) => new URL((req as Request).url))
        .filter((u) => u.pathname.endsWith('/pages'))

async function open(path = `/sites/${SITE_ID}/pages`): Promise<VueWrapper> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

const rows = (w: VueWrapper) => w.findAll('.hs-row')

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('page list: AC1 loads all pages (up to 50) in menu_order', () => {
    it('AC1: shows titles, paths and positions in the order the server sent, asking for limit=50', async () => {
        serve([
            { items: [page(1, 'Home'), page(2, 'About'), page(3, 'Our work')], next_cursor: null },
        ])
        const w = await open()

        expect(w.get('h1').text()).toBe('Pages')
        expect(w.get('.hs-eyebrow').text()).toBe('Atelier Noor')
        expect(rows(w).map((r) => r.get('.hs-row__title').text())).toEqual([
            'Home',
            'About',
            'Our work',
        ])
        expect(rows(w).map((r) => r.get('.hs-row__pos').text())).toEqual(['1', '2', '3'])
        expect(rows(w)[1]?.get('.hs-path').text()).toBe('/s/atelier-noor/page-2')
        expect(rows(w)[1]?.get('.hs-row__title').attributes('href')).toBe(
            `/pages/${page(2).id}/edit`,
        )
        expect(w.get('ol').attributes('aria-label')).toBe('Pages')
        expect(pageCalls()[0]?.searchParams.get('limit')).toBe('50')
    })

    it('AC1: follows next_cursor until it is null and shows one list', async () => {
        serve([
            { items: [page(1), page(2)], next_cursor: 'c1' },
            { items: [page(3)], next_cursor: null },
        ])
        const w = await open()

        expect(rows(w)).toHaveLength(3)
        expect(pageCalls().map((u) => u.searchParams.get('cursor'))).toEqual([null, 'c1'])
        expect(w.get('#page-count').text()).toBe('3 of 50 pages')
    })

    it('AC1: restarts the list once on invalid_cursor', async () => {
        serve([
            { items: [page(1)], next_cursor: 'stale' },
            fail(400, 'invalid_cursor'),
            { items: [page(1), page(2)], next_cursor: null },
        ])
        const w = await open()

        expect(rows(w)).toHaveLength(2)
        expect(pageCalls().map((u) => u.searchParams.get('cursor'))).toEqual([null, 'stale', null])
    })

    it('AC1: shows the list error with Try again when a page fails, never a half list', async () => {
        serve([{ items: [page(1)], next_cursor: 'c1' }, fail(500, 'internal_error')])
        const w = await open()

        expect(rows(w)).toHaveLength(0)
        expect(w.get('.hs-load-error').text()).toContain("We couldn't load the pages of this site.")
        expect(w.get('[role="status"]').text()).toContain('Error:')

        serve([{ items: [page(1)], next_cursor: null }])
        await w.get('.hs-load-error button').trigger('click')
        await flushPromises()
        expect(rows(w)).toHaveLength(1)
    })

    it('AC1: shows nothing of its own on 401', async () => {
        serve([fail(401, 'unauthenticated')])
        const w = await open()

        expect(w.find('.hs-load-error').exists()).toBe(false)
        expect(w.find('.hs-not-found').exists()).toBe(false)
    })

    it('AC1: site_not_found shows the not-found screen for a site', async () => {
        serve([fail(404, 'site_not_found')], fail(404, 'site_not_found'))
        const w = await open()

        expect(w.get('h1').text()).toBe("We can't find that site")
    })
})

describe('page list: the first page is marked as home', () => {
    it('AC4: marks only the first row with the words "Home page" and shows the site root path', async () => {
        serve([{ items: [page(1, 'Welcome'), page(2, 'About')], next_cursor: null }])
        const w = await open()

        const first = rows(w)[0]
        const second = rows(w)[1]
        expect(first?.get('.hs-home').text()).toBe('Home page')
        expect(first?.get('.hs-path').text()).toBe('/s/atelier-noor/')
        expect(first?.get('.hs-row__title').attributes('aria-describedby')).toBe(
            first?.get('.hs-home').attributes('id'),
        )
        expect(second?.find('.hs-home').exists()).toBe(false)
        expect(w.findAll('.hs-home')).toHaveLength(1)
    })

    it('AC4: links each row to its blocks', async () => {
        serve([{ items: [page(1, 'Home')], next_cursor: null }])
        const w = await open()

        const link = w.get('.hs-row__actions a')
        expect(link.text()).toBe('Edit blocks')
        expect(link.attributes('href')).toBe(`/pages/${page(1).id}/blocks`)
        expect(link.attributes('aria-label')).toBe('Edit blocks of Home')
    })
})

describe('page list: the count against the 50-page limit', () => {
    it('AC4: shows "n of 50 pages" and an enabled Add page link below the limit', async () => {
        serve([{ items: pagesOf(5), next_cursor: null }])
        const w = await open()

        expect(w.get('#page-count').text()).toBe('5 of 50 pages')
        const add = w.get('.hs-screen-head__actions a')
        expect(add.text()).toBe('Add page')
        expect(add.attributes('href')).toBe(`/sites/${SITE_ID}/pages/new`)
    })

    it('AC4: at 50 pages Add page is unavailable and its reason is given', async () => {
        serve([{ items: pagesOf(50), next_cursor: null }])
        const w = await open()

        expect(w.get('#page-count').text()).toBe('50 of 50 pages')
        const add = w.get('.hs-screen-head__actions button')
        expect(add.attributes('aria-disabled')).toBe('true')
        expect(add.attributes('aria-describedby')).toBe('page-count page-limit-reason')
        expect(w.get('#page-limit-reason').text()).toBe(
            'This site has 50 pages, the most a site can hold. Delete one to add another.',
        )
        expect(w.find('.hs-screen-head__actions a').exists()).toBe(false)
    })
})

describe('page list: empty state', () => {
    it('AC4: a site with no pages shows the empty panel, "0 of 50 pages" and no head action', async () => {
        serve([{ items: [], next_cursor: null }])
        const w = await open()

        expect(w.get('h2').text()).toBe('This site has no pages yet')
        expect(w.text()).toContain('The first page you add becomes your home page.')
        expect(w.get('#page-count').text()).toBe('0 of 50 pages')
        expect(w.find('.hs-screen-head__actions').exists()).toBe(false)
        expect(w.get('.hs-empty a').text()).toBe('Add a page')
        expect(w.get('.hs-empty a').attributes('href')).toBe(`/sites/${SITE_ID}/pages/new`)
    })
})

describe('page list: site navigation and document title', () => {
    it('shows the site name and its links in the side nav, and leaves them on unmount', async () => {
        serve([{ items: [page(1, 'Home')], next_cursor: null }])
        const w = await open()

        const nav = w.get('nav')
        expect(nav.get('.hs-nav__site').text()).toBe('Atelier Noor')
        const hrefs = nav.findAll('a').map((a) => [a.text(), a.attributes('href')])
        expect(hrefs).toContainEqual(['Pages', `/sites/${SITE_ID}/pages`])
        expect(hrefs).toContainEqual(['Site settings', `/sites/${SITE_ID}/edit`])

        await w.vm.$router.push('/nowhere')
        await flushPromises()
        expect(w.find('.hs-nav__site').exists()).toBe(false)
    })

    it('sets the document title to "Pages · {site} · Hivesite Studio"', async () => {
        serve([{ items: [page(1, 'Home')], next_cursor: null }])
        await open()

        expect(document.title).toBe('Pages · Atelier Noor · Hivesite Studio')
    })
})

describe('page list: after add', () => {
    it('says where the new page landed and focuses its title link', async () => {
        serve([
            {
                items: pagesOf(5).map((p, i) => (i === 4 ? page(5, 'Our work') : p)),
                next_cursor: null,
            },
        ])
        rememberAddedPage({ id: page(5).id, title: 'Our work' })
        const w = await open()

        expect(w.get('.hs-list-status').text()).toBe('Our work added at position 5 of 5.')
        expect(document.activeElement).toBe(rows(w)[4]?.get('.hs-row__title').element)
    })
})
