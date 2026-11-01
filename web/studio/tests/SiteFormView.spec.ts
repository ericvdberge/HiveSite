import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { suggestSlug } from '../src/siteForm'
import { dismissToast, useToast } from '../src/composables/useToast'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

const ID = '0192f0a0-0000-7000-8000-000000000001'

function site(overrides: Record<string, unknown> = {}) {
    return {
        id: ID,
        name: 'Atelier Noor',
        slug: 'atelier-noor',
        settings: { language: 'nl', description: 'Ceramics.' },
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T09:21:00Z',
        ...overrides,
    }
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function fail(status: number, code: string, field?: string): Response {
    return json(status, { error: { code, message: 'Server words.', ...(field ? { field } : {}) } })
}

/** Method, path and parsed body of each call, in order. */
async function calls() {
    return Promise.all(
        fetchMock.mock.calls.map(async ([req]) => {
            const r = req as Request
            const text = await r.clone().text()
            return {
                method: r.method,
                path: new URL(r.url).pathname,
                body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
            }
        }),
    )
}

async function open(
    path: string,
): Promise<{ wrapper: VueWrapper; router: ReturnType<typeof createStudioRouter> }> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return { wrapper, router }
}

const input = (w: VueWrapper, id: string) => w.find<HTMLInputElement>(`#site-${id}`)
async function type(w: VueWrapper, id: string, value: string) {
    await input(w, id).setValue(value)
}
const submit = async (w: VueWrapper) => {
    await w.find('form').trigger('submit')
    await flushPromises()
}
const errorOf = (w: VueWrapper, id: string) => w.find(`#site-${id}-error`)

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('create site: AC3 opens the new site; left-out settings show en and empty', () => {
    it('AC3: Language starts as en, counters read 0 of 80, 0 of 40, 2 of 35, 0 of 160', async () => {
        const { wrapper } = await open('/sites/new')
        expect(wrapper.find('h1').text()).toBe('New site')
        expect(input(wrapper, 'language').element.value).toBe('en')
        const counters = wrapper.findAll('.hs-counter').map((c) => c.text())
        expect(counters).toEqual(['0 of 80', '0 of 40', '2 of 35', '0 of 160'])
    })

    it('AC3: suggests the slug from the name until the owner types in Slug', async () => {
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Café Noor & Zoon!')
        expect(input(wrapper, 'slug').element.value).toBe('cafe-noor-zoon')
        expect(wrapper.find('.hs-path-preview').text()).toBe('Public path: /s/cafe-noor-zoon')
        await type(wrapper, 'slug', 'mine')
        await type(wrapper, 'name', 'Other name')
        expect(input(wrapper, 'slug').element.value).toBe('mine')
        await type(wrapper, 'slug', '')
        await type(wrapper, 'name', 'Other name')
        expect(input(wrapper, 'slug').element.value).toBe('other-name')
    })

    it('AC3: suggestSlug cuts to 40 and leaves short results empty', () => {
        expect(suggestSlug('a'.repeat(50) + '-b')).toBe('a'.repeat(40))
        expect(suggestSlug('Ab')).toBe('')
        expect(suggestSlug('  --Hello   World-- ')).toBe('hello-world')
    })

    it('AC3: with Language emptied and no description, sends en and an empty description, then opens the site', async () => {
        fetchMock.mockResolvedValueOnce(
            json(201, site({ settings: { language: 'en', description: '' } })),
        )
        const { wrapper, router } = await open('/sites/new')
        await type(wrapper, 'name', '  Atelier Noor ')
        await type(wrapper, 'language', '')
        await submit(wrapper)
        expect(await calls()).toEqual([
            {
                method: 'POST',
                path: '/sites',
                body: {
                    name: 'Atelier Noor',
                    slug: 'atelier-noor',
                    settings: { language: 'en', description: '' },
                },
            },
        ])
        expect(router.currentRoute.value.path).toBe(`/sites/${ID}/pages`)
    })

    it('AC3: the button is busy and the fields are read-only while sending', async () => {
        let release: (r: Response) => void = () => {}
        fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(wrapper.find('button[type=submit]').text()).toBe('Creating…')
        expect(input(wrapper, 'name').element.readOnly).toBe(true)
        await submit(wrapper)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        release(json(201, site()))
        await flushPromises()
    })
})

describe('create site: AC4 client checks and server errors on the named field', () => {
    it('AC4: counts trimmed code points and has no maxlength', async () => {
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', '  😀😀😀  ')
        expect(wrapper.findAll('.hs-counter')[0]?.text()).toBe('3 of 80')
        expect(input(wrapper, 'name').attributes('maxlength')).toBeUndefined()
    })

    it('AC4: a submit with broken values shows each client message, focuses the first and sends nothing', async () => {
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'slug', 'Bad_Slug')
        await type(wrapper, 'language', 'EN-x')
        await type(wrapper, 'description', 'd'.repeat(161))
        await submit(wrapper)
        expect(errorOf(wrapper, 'name').text()).toBe('Error: Enter a name.')
        expect(errorOf(wrapper, 'slug').text()).toContain(
            'Use lowercase letters, digits and hyphens',
        )
        expect(errorOf(wrapper, 'language').text()).toContain('Use a language tag')
        expect(errorOf(wrapper, 'description').text()).toBe('Error: Use 160 characters or fewer.')
        expect(input(wrapper, 'name').attributes('aria-invalid')).toBe('true')
        expect(document.activeElement?.id).toBe('site-name')
        expect(wrapper.findAll('.hs-counter')[3]?.classes()).toContain('hs-counter--over')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('AC4: slug length rules read "at least 3" and "40 or fewer"', async () => {
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'slug', 'ab')
        await submit(wrapper)
        expect(errorOf(wrapper, 'slug').text()).toBe('Error: Use at least 3 characters.')
        await type(wrapper, 'slug', 'a'.repeat(41))
        await submit(wrapper)
        expect(errorOf(wrapper, 'slug').text()).toBe('Error: Use 40 characters or fewer.')
    })

    it('AC4: nothing is red before the owner has tried; an error clears when the value is fine', async () => {
        const { wrapper } = await open('/sites/new')
        expect(wrapper.findAll('.hs-field__error')).toHaveLength(0)
        await submit(wrapper)
        expect(errorOf(wrapper, 'name').exists()).toBe(true)
        await type(wrapper, 'name', 'Noor')
        expect(errorOf(wrapper, 'name').exists()).toBe(false)
    })

    it.each([
        ['/name', 'name', 'Use 1 to 80 characters.'],
        ['/slug', 'slug', 'Use 3 to 40 characters: lowercase letters, digits and hyphens.'],
        ['/settings/language', 'language', 'Use a language tag such as en, nl or pt-BR.'],
        ['/settings/description', 'description', 'Use 160 characters or fewer.'],
    ])('AC4: invalid_request with field %s shows on the %s field', async (field, id, copy) => {
        fetchMock.mockResolvedValueOnce(fail(400, 'invalid_request', field))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(errorOf(wrapper, id).text()).toBe(`Error: ${copy}`)
        expect(wrapper.find('.hs-form-message').exists()).toBe(false)
        expect(document.activeElement?.id).toBe(`site-${id}`)
    })

    it('AC4: invalid_request without a field, or an unknown one, shows a form message and focuses it', async () => {
        fetchMock.mockResolvedValueOnce(fail(400, 'invalid_request'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        const message = wrapper.find('.hs-form-message')
        expect(message.text()).toBe(
            "Error: Something in the form wasn't accepted. Please check it and try again.",
        )
        expect(document.activeElement).toBe(message.element)
        expect(wrapper.findAll('.hs-field__error')).toHaveLength(0)
    })

    it('AC4: a server field error clears when the owner changes that field', async () => {
        fetchMock.mockResolvedValueOnce(fail(400, 'invalid_request', '/name'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        await type(wrapper, 'name', 'Atelier Noor 2')
        expect(errorOf(wrapper, 'name').exists()).toBe(false)
    })
})

describe('create site: AC5 slug_taken and too_many_sites', () => {
    it('AC5: slug_taken shows on the slug field', async () => {
        fetchMock.mockResolvedValueOnce(fail(400, 'slug_taken'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(errorOf(wrapper, 'slug').text()).toBe(
            'Error: Another site already uses this path. Try a different slug.',
        )
        expect(document.activeElement?.id).toBe('site-slug')
    })

    it('AC5: too_many_sites shows a form message, keeps the form and makes Create unavailable', async () => {
        fetchMock.mockResolvedValueOnce(fail(400, 'too_many_sites'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(wrapper.find('.hs-form-message').text()).toBe(
            "Error: You have 10 sites, the most for now. This site wasn't created.",
        )
        const button = wrapper.find('button[type=submit]')
        expect(button.attributes('aria-disabled')).toBe('true')
        await submit(wrapper)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('AC5: a network failure shows the save toast and keeps the values', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('offline'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(useToast().message.value).toBe(
            "We couldn't save the site. Your changes are still here.",
        )
        expect(input(wrapper, 'name').element.value).toBe('Atelier Noor')
    })

    it('AC5: leaving mid-save aborts the request and shows nothing when the response arrives', async () => {
        let release!: (r: Response) => void
        fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (release = res)))
        const { wrapper, router } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        const req = fetchMock.mock.calls[0]?.[0] as Request
        await router.push('/sites')
        await flushPromises()
        expect(req.signal.aborted).toBe(true)
        release(json(201, site()))
        await flushPromises()
        expect(router.currentRoute.value.path).toBe('/sites')
        expect(useToast().message.value).toBeNull()
    })

    it('AC3: after 201 the owner lands on the pages route of the new site', async () => {
        fetchMock.mockResolvedValueOnce(json(201, site()))
        const { wrapper, router } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(router.currentRoute.value.name).toBe('site-pages')
    })

    it('AC5: 401 unauthenticated shows nothing of its own', async () => {
        fetchMock.mockResolvedValueOnce(fail(401, 'unauthenticated'))
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'name', 'Atelier Noor')
        await submit(wrapper)
        expect(useToast().message.value).toBeNull()
        expect(wrapper.find('.hs-form-message').exists()).toBe(false)
    })
})

describe('edit site: AC6 only changed fields are sent; saved updated_at is shown', () => {
    it('AC6: loads the site into the form, with the eyebrow, lead and no suggestion', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        expect(await calls()).toMatchObject([{ method: 'GET', path: `/sites/${ID}` }])
        expect(wrapper.find('h1').text()).toBe('Site settings')
        expect(wrapper.find('.hs-eyebrow').text()).toBe('Atelier Noor')
        expect(wrapper.find('.hs-screen-head__lead time').attributes('datetime')).toBe(
            '2026-10-28T09:21:00Z',
        )
        expect(input(wrapper, 'slug').element.value).toBe('atelier-noor')
        expect(input(wrapper, 'language').element.value).toBe('nl')
        await type(wrapper, 'name', 'Atelier Noor Ceramics')
        expect(input(wrapper, 'slug').element.value).toBe('atelier-noor')
        expect(wrapper.find('button[type=submit]').text()).toBe('Save changes')
    })

    it('AC6: a name change sends only name', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(
            json(200, site({ name: 'Noor', updated_at: '2026-10-29T10:00:00Z' })),
        )
        await type(wrapper, 'name', ' Noor ')
        await submit(wrapper)
        const sent = (await calls())[1]
        expect(sent).toEqual({ method: 'PATCH', path: `/sites/${ID}`, body: { name: 'Noor' } })
    })

    it('AC6: settings holds just the changed keys', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(json(200, site()))
        await type(wrapper, 'description', 'Pots and cups.')
        await submit(wrapper)
        expect((await calls())[1]?.body).toEqual({ settings: { description: 'Pots and cups.' } })
        fetchMock.mockResolvedValueOnce(json(200, site()))
        await type(wrapper, 'language', 'pt-BR')
        await submit(wrapper)
        expect((await calls())[2]?.body).toEqual({ settings: { language: 'pt-BR' } })
    })

    it('AC6: an emptied Language is left out, so the saved value stays', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(json(200, site()))
        await type(wrapper, 'language', '')
        await type(wrapper, 'description', '')
        await submit(wrapper)
        expect((await calls())[1]?.body).toEqual({ settings: { description: '' } })
    })

    it('AC6: saving with no change makes no call and says so', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        await type(wrapper, 'name', '  Atelier Noor  ')
        await type(wrapper, 'language', '')
        await submit(wrapper)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(wrapper.find('.hs-form__status').text()).toBe('No changes to save.')
    })

    it('AC6: after a save the form shows the response, the new updated_at and the status line', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(
            json(200, site({ name: 'Noor', updated_at: '2026-10-29T10:00:00Z' })),
        )
        await type(wrapper, 'name', 'Noor')
        await submit(wrapper)
        expect(wrapper.find('.hs-eyebrow').text()).toBe('Noor')
        expect(wrapper.find('.hs-screen-head__lead time').attributes('datetime')).toBe(
            '2026-10-29T10:00:00Z',
        )
        expect(wrapper.find('.hs-form__status').text()).toMatch(/^Saved\. Last updated .+\.$/)
        expect(wrapper.find('button[type=submit]').text()).toBe('Save changes')
    })

    it('AC6: slug_taken on edit shows on the slug field and keeps the values', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(fail(400, 'slug_taken'))
        await type(wrapper, 'slug', 'taken-one')
        await submit(wrapper)
        expect(errorOf(wrapper, 'slug').exists()).toBe(true)
        expect(input(wrapper, 'slug').element.value).toBe('taken-one')
    })
})

describe('edit site: AC7 a slug change warns that the public path changes', () => {
    it('AC7: shows the Note with both paths, and removes it when the slug is back', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        expect(wrapper.find('.hs-note').exists()).toBe(false)
        await type(wrapper, 'slug', 'atelier-noor-ceramics')
        const note = wrapper.find('.hs-note')
        expect(note.attributes('role')).toBe('status')
        expect(note.text()).toBe(
            'Note: Your public path changes from /s/atelier-noor to /s/atelier-noor-ceramics. Old links may stop working.',
        )
        await type(wrapper, 'slug', 'atelier-noor')
        expect(wrapper.find('.hs-note').exists()).toBe(false)
    })

    it('AC7: create never shows the Note', async () => {
        const { wrapper } = await open('/sites/new')
        await type(wrapper, 'slug', 'abc')
        expect(wrapper.find('.hs-note').exists()).toBe(false)
    })
})

describe('edit site: AC8 a missing or foreign site shows the not-found screen', () => {
    it('AC8: GET 404 site_not_found shows the site not-found screen', async () => {
        fetchMock.mockResolvedValueOnce(fail(404, 'site_not_found'))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        expect(wrapper.find('h1').text()).toBe("We can't find that site")
        expect(wrapper.find('form').exists()).toBe(false)
    })

    it('AC8: PATCH 404 site_not_found also shows it', async () => {
        fetchMock.mockResolvedValueOnce(json(200, site()))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        fetchMock.mockResolvedValueOnce(fail(404, 'site_not_found'))
        await type(wrapper, 'name', 'Noor')
        await submit(wrapper)
        expect(wrapper.find('h1').text()).toBe("We can't find that site")
    })

    it('AC8: shows the loading placeholder while the site loads', async () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        expect(wrapper.find('[aria-busy=true]').findAll('.hs-skeleton')).toHaveLength(4)
        expect(wrapper.find('h1').text()).toBe('Site settings')
    })

    it('AC8: another load failure shows the inline message and Try again, without a toast', async () => {
        fetchMock.mockResolvedValueOnce(fail(500, 'internal_error'))
        const { wrapper } = await open(`/sites/${ID}/edit`)
        expect(useToast().message.value).toBeNull()
        expect(wrapper.find('.hs-form-message').text()).toContain("We couldn't load this site.")
        fetchMock.mockResolvedValueOnce(json(200, site()))
        await wrapper.find('.hs-form button').trigger('click')
        await flushPromises()
        expect(input(wrapper, 'name').element.value).toBe('Atelier Noor')
    })
})
