import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, type Router } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast, useToast } from '../src/composables/useToast'
import { takeAddedPage } from '../src/composables/useAddedPage'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

const SITE_ID = '0192f0a0-0000-7000-8000-00000000000a'
const PAGE_ID = '0192f0a0-0000-7000-8000-000000000002'
const SITE = {
    id: SITE_ID,
    name: 'Atelier Noor',
    slug: 'atelier-noor',
    settings: { language: 'en', description: '' },
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-28T09:14:03Z',
}

function page(overrides: Record<string, unknown> = {}) {
    return {
        id: PAGE_ID,
        site_id: SITE_ID,
        title: 'About',
        slug: 'about',
        menu_order: 1,
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T11:02:00Z',
        ...overrides,
    }
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function fail(status: number, code: string, field?: string): Response {
    return json({ error: { code, message: 'Server words.', ...(field ? { field } : {}) } }, status)
}

/** Serves GETs for the site and the page; `write` answers the POST or PATCH. */
function serve(write: Response | (() => Response) = json(page()), pageResponse?: Response) {
    fetchMock.mockImplementation((req: Request) => {
        const url = new URL(req.url)
        if (req.method === 'GET' && url.pathname === `/sites/${SITE_ID}`) {
            return Promise.resolve(json(SITE))
        }
        if (req.method === 'GET' && url.pathname === `/pages/${PAGE_ID}`) {
            return Promise.resolve((pageResponse ?? json(page())).clone())
        }
        if (req.method === 'GET') return Promise.resolve(json({ items: [], next_cursor: null }))
        return Promise.resolve((typeof write === 'function' ? write() : write).clone())
    })
}

/** The body of the one write request, parsed. */
async function writeCall(): Promise<{ method: string; path: string; body: unknown }> {
    const req = fetchMock.mock.calls.map(([r]) => r as Request).find((r) => r.method !== 'GET')
    if (!req) throw new Error('No write request')
    return { method: req.method, path: new URL(req.url).pathname, body: await req.clone().json() }
}

const writes = () => fetchMock.mock.calls.filter(([r]) => (r as Request).method !== 'GET')

let router: Router
async function open(path: string): Promise<VueWrapper> {
    router = createStudioRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

const addPath = `/sites/${SITE_ID}/pages/new`
const editPath = `/pages/${PAGE_ID}/edit`

async function type(w: VueWrapper, id: string, value: string, blur = true) {
    const input = w.get(`#${id}`)
    await input.setValue(value)
    if (blur) await input.trigger('blur')
}

async function submit(w: VueWrapper) {
    await w.get('form').trigger('submit')
    await flushPromises()
}

const fieldError = (w: VueWrapper, id: string) => w.find(`#${id}-error`).text()

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
    takeAddedPage()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('page form: AC1 one form for add and edit with limits and a slug suggestion', () => {
    it('AC1: add shows empty Title and Slug with counters, the site as eyebrow and a path preview', async () => {
        serve()
        const w = await open(addPath)

        expect(w.get('h1').text()).toBe('New page')
        expect(w.get('.hs-eyebrow').text()).toBe('Atelier Noor')
        expect(w.get('#page-title-count').text()).toBe('0 of 80')
        expect(w.get('#page-slug-count').text()).toBe('0 of 60')
        expect(w.get('.hs-path-preview .hs-path').text()).toBe('/s/atelier-noor/…')
        expect(w.get('#page-slug').attributes('autocapitalize')).toBe('none')
        expect(w.get('button[type="submit"]').text()).toBe('Add page')
        expect(w.find('.hs-screen-head__actions').exists()).toBe(false)
    })

    it('AC1: edit shows the saved values and the same two fields', async () => {
        serve()
        const w = await open(editPath)

        expect(w.get('h1').text()).toBe('Edit page')
        expect((w.get('#page-title').element as HTMLInputElement).value).toBe('About')
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('about')
        expect(w.get('button[type="submit"]').text()).toBe('Save changes')
        expect(w.get('.hs-path-preview .hs-path').text()).toBe('/s/atelier-noor/about')
    })

    it('AC1: the slug follows the title until the owner types in Slug, and starts again when cleared', async () => {
        serve()
        const w = await open(addPath)

        await type(w, 'page-title', 'Our Work & Café', false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('our-work-cafe')
        await type(w, 'page-slug', 'work', false)
        await type(w, 'page-title', 'Our work 2', false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('work')
        await type(w, 'page-slug', '', false)
        await type(w, 'page-title', 'Contact', false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('contact')
    })

    it('AC1: edit never suggests a slug', async () => {
        serve()
        const w = await open(editPath)

        await type(w, 'page-title', 'About us', false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('about')
    })

    it('AC1: a one-character slug is accepted and a long title is cut off in the suggestion at 60', async () => {
        serve(json(page({ id: 'new-id', title: 'A', slug: 'a' }), 201))
        const w = await open(addPath)

        await type(w, 'page-title', 'x'.repeat(70), false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('x'.repeat(60))
        await type(w, 'page-title', 'A', false)
        await submit(w)
        expect((await writeCall()).body).toEqual({ title: 'A', slug: 'a' })
    })

    it('AC1: client checks name the broken rule and block the request', async () => {
        serve()
        const w = await open(addPath)

        await type(w, 'page-title', '   ')
        await type(w, 'page-slug', 'About Us')
        await submit(w)
        expect(fieldError(w, 'page-title')).toContain('Enter a title.')
        expect(fieldError(w, 'page-slug')).toContain('Use lowercase letters, digits and hyphens')
        await type(w, 'page-title', 'y'.repeat(81))
        await type(w, 'page-slug', 'z'.repeat(61))
        expect(fieldError(w, 'page-title')).toContain('Use 80 characters or fewer.')
        expect(fieldError(w, 'page-slug')).toContain('Use 60 characters or fewer.')
        expect(w.get('#page-title-count').classes()).toContain('hs-counter--over')
        expect(writes()).toHaveLength(0)
    })

    it('AC1: counts code points, not UTF-16 units', async () => {
        serve()
        const w = await open(addPath)

        await type(w, 'page-title', '😀'.repeat(80), false)
        expect(w.get('#page-title-count').text()).toBe('80 of 80')
        expect(w.get('#page-title-count').classes()).not.toContain('hs-counter--over')
    })
})

describe('page form: AC2 PATCH sends only title and/or slug, never menu_order', () => {
    it('AC2: a changed title sends only the title', async () => {
        serve(json(page({ title: 'About us' })))
        const w = await open(editPath)

        await type(w, 'page-title', '  About us  ')
        await submit(w)

        const call = await writeCall()
        expect(call.method).toBe('PATCH')
        expect(call.path).toBe(`/pages/${PAGE_ID}`)
        expect(call.body).toEqual({ title: 'About us' })
    })

    it('AC2: a changed slug sends only the slug, and the status line shows the saved time', async () => {
        serve(json(page({ slug: 'about-us' })))
        const w = await open(editPath)

        await type(w, 'page-slug', 'about-us')
        expect(w.get('.hs-note').text()).toContain(
            '/s/atelier-noor/about to /s/atelier-noor/about-us',
        )
        await submit(w)

        expect((await writeCall()).body).toEqual({ slug: 'about-us' })
        expect(w.get('.hs-form__status').text()).toMatch(/^Saved\. Last updated .*2026/)
    })

    it('AC2: both changed sends both and no other key', async () => {
        serve(json(page({ title: 'Studio', slug: 'studio' })))
        const w = await open(editPath)

        await type(w, 'page-title', 'Studio')
        await type(w, 'page-slug', 'studio')
        await submit(w)

        const body = (await writeCall()).body as Record<string, unknown>
        expect(Object.keys(body).sort()).toEqual(['slug', 'title'])
        expect(body).not.toHaveProperty('menu_order')
    })

    it('AC2: nothing changed makes no call and says so', async () => {
        serve()
        const w = await open(editPath)

        await submit(w)

        expect(writes()).toHaveLength(0)
        expect(w.get('.hs-form__status').text()).toBe('No changes to save.')
    })

    it('AC2: the home page adds the site root to the preview and the slug note', async () => {
        serve(json(page()), json(page({ menu_order: 0 })))
        const w = await open(editPath)

        expect(w.text()).toContain('As the home page it is also served at /s/atelier-noor/.')
        await type(w, 'page-slug', 'start')
        expect(w.get('.hs-note').text()).toContain('Your home page stays at /s/atelier-noor/.')
    })

    it('AC2: Edit blocks links to the blocks of the page, in edit only', async () => {
        serve()
        const w = await open(editPath)

        const link = w.get('.hs-screen-head__actions a')
        expect(link.text()).toBe('Edit blocks')
        expect(link.attributes('href')).toBe(`/pages/${PAGE_ID}/blocks`)
    })
})

describe('page form: AC3 errors', () => {
    it('AC3: slug_taken shows on Slug and moves focus there', async () => {
        serve(fail(400, 'slug_taken'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        expect(fieldError(w, 'page-slug')).toContain(
            'Another page of this site already uses this slug. Try a different one.',
        )
        expect(document.activeElement).toBe(w.get('#page-slug').element)
        expect(w.get('#page-slug').attributes('aria-invalid')).toBe('true')
    })

    it('AC3: slug_reserved from the server names assets on Slug', async () => {
        serve(fail(400, 'slug_reserved'))
        const w = await open(editPath)

        await type(w, 'page-slug', 'media')
        await submit(w)

        expect(fieldError(w, 'page-slug')).toContain('The slug assets is kept for your site')
    })

    it('AC3: the slug assets is refused before any request, also when suggested from the title', async () => {
        serve()
        const w = await open(addPath)

        await type(w, 'page-title', 'Assets')
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('assets')
        await submit(w)

        expect(fieldError(w, 'page-slug')).toContain('The slug assets is kept for your site')
        expect(writes()).toHaveLength(0)
    })

    it('AC3: invalid_request with /title shows on Title', async () => {
        serve(fail(400, 'invalid_request', '/title'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        expect(fieldError(w, 'page-title')).toContain('Use 1 to 80 characters.')
        expect(document.activeElement).toBe(w.get('#page-title').element)
    })

    it('AC3: invalid_request with /slug shows on Slug', async () => {
        serve(fail(400, 'invalid_request', '/slug'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        expect(fieldError(w, 'page-slug')).toContain('Use 1 to 60 characters')
    })

    it('AC3: invalid_request without a known field shows a form message that takes focus', async () => {
        serve(fail(400, 'invalid_request'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        const message = w.get('#page-form-message')
        expect(message.text()).toContain("Something in the form wasn't accepted.")
        expect(document.activeElement).toBe(message.element)
    })

    it('AC3: too_many_pages is a message, not a field error, and makes Add page unavailable', async () => {
        serve(fail(400, 'too_many_pages'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        expect(w.get('#page-form-message').text()).toContain(
            "This site has 50 pages, the most it can hold. This page wasn't added.",
        )
        expect(w.find('.hs-field__error').exists()).toBe(false)
        expect(w.get('button[type="submit"]').attributes('aria-disabled')).toBe('true')
        const before = writes().length
        await submit(w)
        expect(writes()).toHaveLength(before)
    })

    it('AC3: a network failure keeps the values and shows the save toast', async () => {
        fetchMock.mockImplementation((req: Request) =>
            req.method === 'GET'
                ? Promise.resolve(json(SITE))
                : Promise.reject(new TypeError('Failed to fetch')),
        )
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)

        expect(useToast().message.value).toBe(
            "We couldn't save the page. Your changes are still here.",
        )
        expect((w.get('#page-title').element as HTMLInputElement).value).toBe('About')
    })

    it('AC3: a field error clears when the owner changes that field', async () => {
        serve(fail(400, 'slug_taken'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)
        await type(w, 'page-slug', 'about-2', false)

        expect(w.find('#page-slug-error').exists()).toBe(false)
    })
})

describe('page form: AC5 a new page appears last; AC9 404 shows not-found', () => {
    it('AC5: POST sends title and slug, then returns to the page list with the new page remembered', async () => {
        serve(
            json(
                page({ id: 'new-page-id', title: 'Our work', slug: 'our-work', menu_order: 4 }),
                201,
            ),
        )
        const serveAll = fetchMock.getMockImplementation() as (req: Request) => Promise<Response>
        const created = page({
            id: 'new-page-id',
            title: 'Our work',
            slug: 'our-work',
            menu_order: 0,
        })
        fetchMock.mockImplementation((req: Request) =>
            req.method === 'GET' && new URL(req.url).pathname === `/sites/${SITE_ID}/pages`
                ? Promise.resolve(json({ items: [created], next_cursor: null }))
                : serveAll(req),
        )
        const w = await open(addPath)

        await type(w, 'page-title', 'Our work')
        await submit(w)

        const call = await writeCall()
        expect(call.method).toBe('POST')
        expect(call.path).toBe(`/sites/${SITE_ID}/pages`)
        expect(call.body).toEqual({ title: 'Our work', slug: 'our-work' })
        expect(router.currentRoute.value.path).toBe(`/sites/${SITE_ID}/pages`)
        expect(w.get('.hs-list-status').text()).toBe('Our work added at position 1 of 1.')
    })

    it('AC5: Cancel returns to the page list', async () => {
        serve()
        const w = await open(addPath)

        expect(w.get('.hs-form__actions a').attributes('href')).toBe(`/sites/${SITE_ID}/pages`)
    })

    it('AC9: page_not_found on load shows the not-found screen for a page, no form', async () => {
        serve(json(page()), fail(404, 'page_not_found'))
        const w = await open(editPath)

        expect(w.get('h1').text()).toBe("We can't find that page")
        expect(w.find('form').exists()).toBe(false)
        expect(w.text()).toContain('Back to your sites')
    })

    it('AC9: page_not_found on save shows the not-found screen with Back to pages', async () => {
        serve(fail(404, 'page_not_found'))
        const w = await open(editPath)

        await type(w, 'page-title', 'Gone')
        await submit(w)

        expect(w.get('h1').text()).toBe("We can't find that page")
        expect(w.get('.hs-not-found a').text()).toBe('Back to pages')
        expect(w.get('.hs-not-found a').attributes('href')).toBe(`/sites/${SITE_ID}/pages`)
    })

    it('AC9: site_not_found on add shows the not-found screen for a site', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(fail(404, 'site_not_found')))
        const w = await open(addPath)

        expect(w.get('h1').text()).toBe("We can't find that site")
    })

    it('AC9: a failed load shows one inline error with Try again and no toast', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(fail(500, 'internal_error')))
        const w = await open(addPath)

        expect(w.text()).toContain("We couldn't load this site.")
        expect(useToast().message.value).toBeNull()
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        expect(w.get('[role="status"]').text()).toBe("Error: We couldn't load this site.")
        serve()
        await w.get('.hs-form .hs-button').trigger('click')
        await flushPromises()
        expect(w.find('form').exists()).toBe(true)
    })
})

describe('page form: leaving mid-save and stale errors', () => {
    /** A write that stays pending until `release()` is called. */
    function pendingWrite() {
        let release: () => void = () => {}
        const gate = new Promise<void>((r) => (release = r))
        fetchMock.mockImplementation(async (req: Request) => {
            const url = new URL(req.url)
            if (req.method === 'GET') {
                return url.pathname === `/sites/${SITE_ID}` ? json(SITE) : json(page())
            }
            await gate
            return json(page({ id: 'late-id', title: 'Late', slug: 'late' }), 201)
        })
        return release
    }

    it('AC5: a late 201 after leaving the form does not navigate, remember the page or toast', async () => {
        const release = pendingWrite()
        const w = await open(addPath)

        await type(w, 'page-title', 'Late')
        await w.get('form').trigger('submit')
        await router.push('/nowhere')
        release()
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/nowhere')
        expect(takeAddedPage()).toBeNull()
        expect(useToast().message.value).toBeNull()
        w.unmount()
    })

    it('Cancel and Edit blocks do nothing while a save is out', async () => {
        const release = pendingWrite()
        const w = await open(editPath)

        await type(w, 'page-title', 'Changed')
        await w.get('form').trigger('submit')
        await w.get('.hs-form__actions a').trigger('click')
        await w.get('.hs-screen-head__actions a').trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.path).toBe(editPath)
        expect(w.get('.hs-form__actions a').attributes('aria-disabled')).toBe('true')
        release()
        await flushPromises()
    })

    it('Cancel navigates to the list when nothing is being sent', async () => {
        serve()
        const w = await open(addPath)

        await w.get('.hs-form__actions a').trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.path).toBe(`/sites/${SITE_ID}/pages`)
    })

    it('a stale slug_taken clears when the title rewrites the suggested slug', async () => {
        serve(fail(400, 'slug_taken'))
        const w = await open(addPath)

        await type(w, 'page-title', 'About')
        await submit(w)
        expect(w.find('#page-slug-error').exists()).toBe(true)
        await type(w, 'page-title', 'About us', false)

        expect(w.find('#page-slug-error').exists()).toBe(false)
        expect((w.get('#page-slug').element as HTMLInputElement).value).toBe('about-us')
    })

    it('shows the site in the side nav and the page in the document title on edit', async () => {
        serve()
        const w = await open(editPath)

        expect(w.get('.hs-nav__site').text()).toBe('Atelier Noor')
        expect(document.title).toBe('Edit page · About · Hivesite Studio')
    })
})
