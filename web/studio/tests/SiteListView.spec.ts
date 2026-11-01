import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast, useToast } from '../src/composables/useToast'
import { readFileSync } from 'node:fs'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

interface SiteFixture {
    id: string
    name: string
    slug: string
    settings: { language: string; description: string }
    created_at: string
    updated_at: string
}

function site(n: number, overrides: Partial<SiteFixture> = {}): SiteFixture {
    const id = `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`
    return {
        id,
        name: `Site ${n}`,
        slug: `site-${n}`,
        settings: { language: 'nl', description: '' },
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T09:14:03Z',
        ...overrides,
    }
}

function sites(from: number, to: number): SiteFixture[] {
    return Array.from({ length: to - from + 1 }, (_, i) => site(from + i))
}

function ok(items: SiteFixture[], next: string | null = null): Response {
    return new Response(JSON.stringify({ items, next_cursor: next }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

function fail(status: number, code: string): Response {
    return new Response(JSON.stringify({ error: { code, message: 'Server words.' } }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

/** The cursor each GET /sites call sent, in order ('' for the first page). */
function cursors(): string[] {
    return fetchMock.mock.calls.map(
        ([req]) => new URL((req as Request).url).searchParams.get('cursor') ?? '',
    )
}

async function open(path = '/sites'): Promise<VueWrapper> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

function at<T>(items: T[], i: number): T {
    const item = items[i]
    if (item === undefined) throw new Error('No item at ' + i)
    return item
}

const rows = (w: VueWrapper) => w.findAll('.hs-row')
const moreButton = (w: VueWrapper) => w.find('.hs-more > button')

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('site list: AC1 lists sites newest first and loads more with next_cursor', () => {
    it('AC1: shows name, /s/{slug}, language and last updated in the order the server sent', async () => {
        fetchMock.mockResolvedValueOnce(
            ok([
                site(2, {
                    name: 'Newest',
                    slug: 'newest',
                    settings: { language: 'en-GB', description: '' },
                }),
                site(1, { name: 'Oldest', slug: 'oldest' }),
            ]),
        )
        const w = await open()

        expect(w.get('h1').text()).toBe('Your sites')
        const r = rows(w)
        const r0 = at(r, 0)
        expect(r.map((x) => x.get('.hs-row__title').text())).toEqual(['Newest', 'Oldest'])
        expect(r0.get('.hs-row__title').attributes('href')).toBe(
            '/sites/0192f0a0-0000-7000-8000-000000000002/pages',
        )
        expect(r0.get('.hs-path').text()).toBe('/s/newest')
        expect(r0.text()).toContain('Language: en-GB')
        const time = r0.get('time')
        expect(time.attributes('datetime')).toBe('2026-10-28T09:14:03Z')
        expect(time.text()).toMatch(/2026/)
        expect(r0.text()).toContain('Updated')
        expect(w.get('.hs-list').attributes('aria-label')).toBe('Your sites')
        // The first request asks for the default page size and no cursor.
        const url = new URL((at(fetchMock.mock.calls, 0)[0] as Request).url)
        expect(url.pathname).toBe('/sites')
        expect(url.searchParams.get('limit')).toBe('20')
        expect(url.searchParams.has('cursor')).toBe(false)
    })

    it('AC1: "/" shows the same list', async () => {
        fetchMock.mockResolvedValueOnce(ok(sites(1, 2)))
        const w = await open('/')
        expect(w.get('h1').text()).toBe('Your sites')
        expect(rows(w)).toHaveLength(2)
    })

    it('AC1: Load more follows next_cursor until it is null, then shows the end line', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 3), 'c1'))
            .mockResolvedValueOnce(ok(sites(4, 5), 'c2'))
            .mockResolvedValueOnce(ok(sites(6, 6), null))
        const w = await open()

        expect(rows(w)).toHaveLength(3)
        expect(w.find('.hs-end').exists()).toBe(false)
        await moreButton(w).trigger('click')
        await flushPromises()
        expect(rows(w)).toHaveLength(5)
        expect(moreButton(w).text()).toBe('Load more')
        await moreButton(w).trigger('click')
        await flushPromises()

        expect(cursors()).toEqual(['', 'c1', 'c2'])
        expect(rows(w)).toHaveLength(6)
        expect(moreButton(w).exists()).toBe(false)
        expect(w.get('.hs-end').text()).toBe("That's all your sites.")
        expect(w.get('#site-count').text()).toBe('6 of 10 sites')
    })

    it('AC1: no site shows twice when pages overlap', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 3), 'c1'))
            .mockResolvedValueOnce(ok(sites(3, 5), null))
        const w = await open()
        await moreButton(w).trigger('click')
        await flushPromises()

        const names = rows(w).map((x) => x.get('.hs-row__title').text())
        expect(names).toEqual(['Site 1', 'Site 2', 'Site 3', 'Site 4', 'Site 5'])
    })

    it('AC1: after Load more, focus moves to the first new row and the status says how many loaded', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 3), 'c1'))
            .mockResolvedValueOnce(ok(sites(4, 8), 'c2'))
        const w = await open()
        await moreButton(w).trigger('click')
        await flushPromises()

        expect(document.activeElement).toBe(at(rows(w), 3).get('a').element)
        expect(w.get('[role="status"]').text()).toBe('5 more sites loaded.')
    })

    it('AC1: Load more is busy while loading and ignores a second press', async () => {
        let resolve!: (r: Response) => void
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'c1'))
            .mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
        const w = await open()
        const button = moreButton(w)
        await button.trigger('click')
        await flushPromises()

        expect(button.text()).toBe('Loading…')
        expect(button.attributes('aria-disabled')).toBe('true')
        expect(w.get('[role="status"]').text()).toBe('Loading more sites…')
        await button.trigger('click')
        expect(fetchMock).toHaveBeenCalledTimes(2)

        resolve(ok(sites(3, 3)))
        await flushPromises()
        expect(rows(w)).toHaveLength(3)
    })

    it('AC1: a failed Load more says so, keeps the rows, and Try again retries the same page', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'c1'))
            .mockResolvedValueOnce(fail(500, 'internal_error'))
            .mockResolvedValueOnce(ok(sites(3, 3)))
        const w = await open()
        await moreButton(w).trigger('click')
        await flushPromises()

        expect(rows(w)).toHaveLength(2)
        expect(moreButton(w).text()).toBe('Try again')
        expect(w.get('.hs-more__status').text()).toBe("Error: We couldn't load more sites.")
        expect(useToast().message.value).toBeNull()

        await moreButton(w).trigger('click')
        await flushPromises()
        expect(cursors()).toEqual(['', 'c1', 'c1'])
        expect(rows(w)).toHaveLength(3)
        expect(useToast().message.value).toBeNull()
    })

    it('AC1: invalid_cursor reloads the list from the start and says "The list was refreshed."', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'stale'))
            .mockResolvedValueOnce(fail(400, 'invalid_cursor'))
            .mockResolvedValueOnce(ok(sites(1, 4), null))
        const w = await open()
        await moreButton(w).trigger('click')
        await flushPromises()

        expect(cursors()).toEqual(['', 'stale', ''])
        expect(rows(w)).toHaveLength(4)
        const status = w.get('[role="status"]')
        expect(status.text()).toBe('The list was refreshed.')
        expect(status.classes()).not.toContain('hs-visually-hidden')
        expect(useToast().message.value).toBeNull()
    })

    it('AC1: shows a loading placeholder of three rows while the first page loads', async () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}))
        const w = await open()

        expect(w.get('.hs-placeholder').attributes('aria-busy')).toBe('true')
        expect(w.findAll('.hs-placeholder__row')).toHaveLength(3)
        expect(w.get('[role="status"]').text()).toBe('Loading sites…')
        expect(w.get('h1').text()).toBe('Your sites')
        expect(w.find('#site-count').exists()).toBe(false)
    })

    it('AC1: a failed first load shows the list error with Try again, and no toast', async () => {
        fetchMock
            .mockResolvedValueOnce(fail(500, 'internal_error'))
            .mockResolvedValueOnce(ok(sites(1, 1)))
        const w = await open()

        expect(w.get('.hs-form-message').text()).toBe("Error: We couldn't load your sites.")
        expect(useToast().message.value).toBeNull()
        expect(w.find('.hs-form-message').attributes('role')).toBeUndefined()
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        expect(w.get('[role="status"]').text()).toBe("Error: We couldn't load your sites.")
        expect(w.text()).not.toContain('Server words.')

        await w.get('.hs-load-error button').trigger('click')
        await flushPromises()
        expect(rows(w)).toHaveLength(1)
        expect(w.find('.hs-form-message').exists()).toBe(false)
        expect(useToast().message.value).toBeNull()
    })
})

describe('site list: live regions, sign-in, focus and motion', () => {
    it('AC1: a 401 unauthenticated on first load shows no list error', async () => {
        fetchMock.mockResolvedValueOnce(fail(401, 'unauthenticated'))
        const w = await open()
        expect(w.find('.hs-form-message').exists()).toBe(false)
        expect(w.find('.hs-list').exists()).toBe(false)
        expect(useToast().message.value).toBeNull()
    })

    it('AC1: a 401 unauthenticated on Load more shows no failed state', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'c1'))
            .mockResolvedValueOnce(fail(401, 'unauthenticated'))
        const w = await open()
        await moreButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-more__status').text()).not.toContain('Error')
        expect(w.find('.hs-more__status--error').exists()).toBe(false)
    })

    it('AC1: one status element stays in the DOM across Load more states', async () => {
        let resolve!: (r: Response) => void
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'c1'))
            .mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
        const w = await open()
        const el = w.get('.hs-more__status').element
        await moreButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-more__status').element).toBe(el)
        resolve(ok(sites(3, 3), null))
        await flushPromises()
        expect(w.get('.hs-more__status').element).toBe(el)
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        expect(el.textContent?.trim()).toBe("1 more site loaded. That's all your sites.")
    })

    it('AC1: the end line is not repeated in the status on first load', async () => {
        fetchMock.mockResolvedValueOnce(ok(sites(1, 2), null))
        const w = await open()
        expect(w.get('.hs-end').text()).toBe("That's all your sites.")
        expect(w.get('.hs-more__status').text()).toBe('')
    })

    it('AC1: when Load more adds no rows and the button goes, focus moves to the first row link', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'c1'))
            .mockResolvedValueOnce(ok(sites(1, 2), null))
        const w = await open()
        ;(moreButton(w).element as HTMLElement).focus()
        await moreButton(w).trigger('click')
        await flushPromises()
        expect(moreButton(w).exists()).toBe(false)
        expect(document.activeElement).toBe(at(rows(w), 0).get('a').element)
    })

    it('AC1: a refresh that reaches the end moves focus to the first newly shown row link', async () => {
        fetchMock
            .mockResolvedValueOnce(ok(sites(1, 2), 'stale'))
            .mockResolvedValueOnce(fail(400, 'invalid_cursor'))
            .mockResolvedValueOnce(ok(sites(1, 4), null))
        const w = await open()
        ;(moreButton(w).element as HTMLElement).focus()
        await moreButton(w).trigger('click')
        await flushPromises()
        expect(moreButton(w).exists()).toBe(false)
        expect(document.activeElement).toBe(at(rows(w), 2).get('a').element)
    })

    it('Motion: the list fades and rises once with motion tokens', () => {
        const src = readFileSync('src/views/SiteListView.vue', 'utf8')
        expect(src).toMatch(
            /\.hs-list \{[^}]*animation: hs-list-in var\(--hs-motion-duration-base\) var\(--hs-motion-easing-enter\)/,
        )
        expect(src).toMatch(
            /@keyframes hs-list-in[\s\S]*opacity: 0[\s\S]*var\(--hs-motion-rise-distance\)/,
        )
    })
})

describe('site list: AC2 empty state', () => {
    it('AC2: with no sites it shows the empty state and a create action linking to the create route', async () => {
        fetchMock.mockResolvedValueOnce(ok([]))
        const w = await open()

        const empty = w.get('.hs-empty')
        expect(empty.get('h2').text()).toBe('Your first site starts here')
        expect(empty.text()).toContain('Give it a name and a path. You can change both later.')
        expect(empty.get('a').text()).toBe('Create a site')
        expect(empty.get('a').attributes('href')).toBe('/sites/new')
        expect(w.find('.hs-list').exists()).toBe(false)
        expect(w.find('.hs-end').exists()).toBe(false)
        expect(w.get('#site-count').text()).toBe('0 of 10 sites')
        // One primary button: the head action is hidden.
        expect(w.findAll('.hs-screen-head a.hs-button')).toHaveLength(0)
    })

    it('AC2: the create action opens the create route', async () => {
        fetchMock.mockResolvedValueOnce(ok([]))
        const w = await open()
        await w.get('.hs-empty a').trigger('click')
        await flushPromises()
        expect(w.get('h1').text()).toBe('New site')
    })
})

describe('site list: AC5 limit of 10 sites', () => {
    it('AC5: under the limit it shows "n of 10 sites" and New site links to the create route', async () => {
        fetchMock.mockResolvedValueOnce(ok(sites(1, 4)))
        const w = await open()

        expect(w.get('#site-count').text()).toBe('4 of 10 sites')
        const action = w.get('.hs-screen-head a.hs-button')
        expect(action.text()).toBe('New site')
        expect(action.attributes('href')).toBe('/sites/new')
        expect(action.attributes('aria-describedby')).toBe('site-count')
        expect(w.find('#site-limit-reason').exists()).toBe(false)
    })

    it('AC5: at 10 sites create is unavailable with the reason in words, and pressing it does nothing', async () => {
        fetchMock.mockResolvedValueOnce(ok(sites(1, 10)))
        const w = await open()

        expect(w.get('#site-count').text()).toBe('10 of 10 sites')
        const action = w.get('.hs-screen-head button.hs-button')
        expect(action.text()).toBe('New site')
        expect(action.attributes('aria-disabled')).toBe('true')
        expect(action.attributes('disabled')).toBeUndefined()
        expect(action.attributes('aria-describedby')).toBe('site-count site-limit-reason')
        expect(w.get('#site-limit-reason').text()).toBe(
            "You have 10 sites, the most for now. Sites can't be deleted yet.",
        )
        expect(w.find('.hs-screen-head a.hs-button').exists()).toBe(false)
        await action.trigger('click')
        await flushPromises()
        expect(w.get('h1').text()).toBe('Your sites')
    })

    it('AC5: above 10 sites the count and the limit state still hold', async () => {
        fetchMock.mockResolvedValueOnce(ok(sites(1, 11)))
        const w = await open()
        expect(w.get('#site-count').text()).toBe('11 of 10 sites')
        expect(w.get('.hs-screen-head button.hs-button').attributes('aria-disabled')).toBe('true')
    })
})
