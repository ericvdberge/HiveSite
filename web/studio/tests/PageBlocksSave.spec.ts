import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { useToast, dismissToast } from '../src/composables/useToast'
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

const hero = (title: string, extra: Record<string, unknown> = {}) => ({
    type: 'hero',
    attrs: { title, subtitle: '', image: null, cta: null, ...extra },
})
const doc = (content: unknown[]) => ({ type: 'doc', content })

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    })
}
const fail = (status: number, code: string, field?: string) =>
    json({ error: { code, message: 'Server words.', ...(field ? { field } : {}) } }, status)

/** Serves the four loading calls; `put` answers the PUT. */
function serve(content: unknown[], put: (req: Request) => Promise<Response> | Response) {
    fetchMock.mockImplementation((req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === PATH) {
            if (req.method === 'PUT') return Promise.resolve(put(req))
            return Promise.resolve(json(doc(content), 200, { ETag: '"7"' }))
        }
        if (url.pathname === `/pages/${PAGE_ID}`) return Promise.resolve(json(PAGE))
        if (url.pathname === '/block-types') {
            return Promise.resolve(json({ items: TYPES, next_cursor: null }))
        }
        if (url.pathname === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
        return Promise.resolve(json({ items: [], next_cursor: null }))
    })
}

const puts = () => fetchMock.mock.calls.map(([r]) => r as Request).filter((r) => r.method === 'PUT')

// Unmounted after each test: the Save shortcut listens on window.
const mounted: VueWrapper[] = []

async function open(): Promise<VueWrapper> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push('/sites')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    mounted.push(wrapper)
    await flushPromises()
    await router.push(PATH)
    await flushPromises()
    return wrapper
}

const status = (w: VueWrapper) => w.get('.hs-status').text()
const saveButton = (w: VueWrapper) => w.get('button[type="submit"]')

async function type(w: VueWrapper, selector: string, value: string) {
    await w.get(selector).setValue(value)
}

async function blur(w: VueWrapper, selector: string) {
    await w.get(selector).trigger('blur')
}

beforeEach(() => {
    fetchMock.mockReset()
    dismissToast()
})
afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    document.body.innerHTML = ''
})

describe('save: client errors', () => {
    it('(AC4) a field loses focus after typing: its client error shows with the Errors copy', async () => {
        serve([hero('A')], () => json(doc([])))
        const w = await open()
        await type(w, '#b1-title', '')
        expect(w.find('#b1-title-error').exists()).toBe(false)
        await blur(w, '#b1-title')
        expect(w.get('#b1-title-error').text()).toBe('Error: Enter a title.')
        await type(w, '#b1-title', 'x'.repeat(81))
        expect(w.get('#b1-title-error').text()).toBe('Error: Use 80 characters or fewer.')
        await type(w, '#b1-title', 'Fine')
        expect(w.find('#b1-title-error').exists()).toBe(false)
    })

    it('(AC4) a field that was never typed in shows nothing on blur', async () => {
        serve([hero('')], () => json(doc([])))
        const w = await open()
        await blur(w, '#b1-title')
        expect(w.find('#b1-title-error').exists()).toBe(false)
    })

    it('(AC4) the image address and the button link show their own copy', async () => {
        serve([hero('A', { image: { url: '', alt: '' }, cta: { label: 'Go', href: '' } })], () =>
            json(doc([])),
        )
        const w = await open()
        await type(w, '#b1-image-url', 'http://a.test')
        await blur(w, '#b1-image-url')
        await type(w, '#b1-cta-href', 'https://')
        await blur(w, '#b1-cta-href')
        expect(w.get('#b1-image-url-error').text()).toBe(
            'Error: Use an address that starts with https://, with no spaces.',
        )
        expect(w.get('#b1-cta-href-error').text()).toBe(
            'Error: Use a page path such as /about, an address that starts with https://, or a mailto: address.',
        )
    })

    it('(AC5) with errors, Save makes no call, opens every invalid block, lists them and focuses the first invalid field', async () => {
        serve(
            [hero(''), hero('B'), hero('C', { cta: { label: 'Go', href: 'nope' } }), hero('D')],
            () => json(doc([])),
        )
        const w = await open()
        const toggles = () => w.findAll('.hs-block__toggle')
        expect(toggles().map((t) => t.attributes('aria-expanded'))).toEqual([
            'false',
            'false',
            'false',
            'false',
        ])
        const before = fetchMock.mock.calls.length
        await saveButton(w).trigger('click')
        await flushPromises()

        expect(fetchMock.mock.calls.length).toBe(before)
        expect(toggles().map((t) => t.attributes('aria-expanded'))).toEqual([
            'true',
            'false',
            'true',
            'false',
        ])
        expect(w.get('.hs-blocks__message').text()).toBe(
            'Error: 2 blocks need attention: 1. Hero, 3. Hero.',
        )
        expect(w.get('.hs-blocks__message').attributes('role')).toBe('alert')
        expect(document.activeElement?.id).toBe('b1-title')
        expect(w.get('#b1-title-error').text()).toBe('Error: Enter a title.')
    })

    it('(AC5) each listed block is a link that focuses its first invalid field', async () => {
        serve(
            [hero(''), hero('B'), hero('C', { cta: { label: 'Go', href: 'nope' } }), hero('D')],
            () => json(doc([])),
        )
        const w = await open()
        await saveButton(w).trigger('click')
        await flushPromises()
        const links = w.findAll('.hs-blocks__message a')
        expect(links.map((l) => l.text())).toEqual(['1. Hero', '3. Hero'])
        await links[1]?.trigger('click')
        await flushPromises()
        expect(document.activeElement?.id).toBe('b3-cta-href')
    })

    it('(AC5) the block head shows "Error: needs attention" also when the block is closed', async () => {
        serve([hero(''), hero('B'), hero('C'), hero('D')], () => json(doc([])))
        const w = await open()
        await saveButton(w).trigger('click')
        await flushPromises()
        const first = w.findAll('li.hs-block')[0]
        expect(first?.get('.hs-block__flag').text()).toBe('Error: needs attention')
        await first?.get('.hs-block__toggle').trigger('click')
        expect(first?.get('.hs-block__toggle').attributes('aria-expanded')).toBe('false')
        expect(first?.find('.hs-block__flag').exists()).toBe(true)
        expect(w.findAll('li.hs-block')[1]?.find('.hs-block__flag').exists()).toBe(false)
    })

    it('(AC5) one invalid block reads "1 block needs attention"', async () => {
        serve([hero('')], () => json(doc([])))
        const w = await open()
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-blocks__message').text()).toBe('Error: 1 block needs attention: 1. Hero.')
    })
})

describe('save: sending', () => {
    it('(AC6) one PUT with Content-Type application/json, If-Match set to the last ETag and the document to send', async () => {
        serve([hero('A')], (req) => {
            void req
            return json(doc([hero('  Hello  ')]), 200, { ETag: '"8"' })
        })
        const w = await open()
        await type(w, '#b1-title', '  Hello  ')
        await saveButton(w).trigger('click')
        await flushPromises()

        expect(puts()).toHaveLength(1)
        const put = puts()[0] as Request
        expect(new URL(put.url).pathname).toBe(PATH)
        expect(put.headers.get('Content-Type')).toContain('application/json')
        expect(put.headers.get('If-Match')).toBe('"7"')
        expect(await put.clone().json()).toEqual(doc([hero('Hello')]))
    })

    it('(AC6) Ctrl+S and Cmd+S save from anywhere on the screen', async () => {
        serve([hero('A')], () => json(doc([hero('B')]), 200, { ETag: '"8"' }))
        const w = await open()
        await type(w, '#b1-title', 'B')
        const ctrl = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
        window.dispatchEvent(ctrl)
        await flushPromises()
        expect(ctrl.defaultPrevented).toBe(true)
        expect(puts()).toHaveLength(1)

        await type(w, '#b1-title', 'C')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }))
        await flushPromises()
        expect(puts()).toHaveLength(2)
    })

    it('(AC6) Enter in a text input submits nothing', async () => {
        serve([hero('A')], () => json(doc([hero('B')])))
        const w = await open()
        await type(w, '#b1-title', 'B')
        const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        })
        w.get('#b1-title').element.dispatchEvent(enter)
        await flushPromises()
        expect(enter.defaultPrevented).toBe(true)
        expect(puts()).toHaveLength(0)
    })

    it('(AC7) on 200 the working copy becomes the response, the new ETag is kept, the status says "Blocks saved." and focus stays on Save', async () => {
        serve([hero('A')], () =>
            json(doc([hero('B', { subtitle: 'Filled in' })]), 200, { ETag: '"8"' }),
        )
        const w = await open()
        await type(w, '#b1-title', 'B')
        ;(saveButton(w).element as HTMLElement).focus()
        await saveButton(w).trigger('click')
        await flushPromises()

        expect(status(w)).toBe('Blocks saved.')
        expect((w.get('#b1-subtitle').element as HTMLTextAreaElement).value).toBe('Filled in')
        expect(document.activeElement).toBe(saveButton(w).element)

        await type(w, '#b1-title', 'C')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(puts()[1]?.headers.get('If-Match')).toBe('"8"')
    })

    it('(AC7) when the document to send equals the saved one, no call is made and the status says "No changes to save."', async () => {
        serve([hero('A')], () => json(doc([hero('A')])))
        const w = await open()
        await type(w, '#b1-title', '  A  ')
        expect(status(w)).toBe('')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(puts()).toHaveLength(0)
        expect(status(w)).toBe('No changes to save.')
    })

    it('(AC8) while sending every field is readonly, Save says "Saving…", the list is busy and a second save is not sent', async () => {
        let release: (r: Response) => void = () => {}
        serve(
            [hero('A')],
            () =>
                new Promise<Response>((resolve) => {
                    release = resolve
                }),
        )
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()

        expect(saveButton(w).text()).toBe('Saving…')
        expect(saveButton(w).attributes('aria-disabled')).toBe('true')
        expect(status(w)).toBe('Saving…')
        expect(w.get('.hs-block-list').attributes('aria-busy')).toBe('true')
        const fields = w.findAll('input[type="text"], input[type="url"], textarea')
        expect(fields.length).toBeGreaterThan(0)
        expect(fields.every((f) => f.attributes('readonly') !== undefined)).toBe(true)

        await saveButton(w).trigger('click')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
        await flushPromises()
        expect(puts()).toHaveLength(1)

        release(json(doc([hero('B')]), 200, { ETag: '"8"' }))
        await flushPromises()
        expect(saveButton(w).text()).toBe('Save blocks')
        expect(w.get('.hs-block-list').attributes('aria-busy')).toBe('false')
        expect(w.get('#b1-title').attributes('readonly')).toBeUndefined()
    })

    it('(AC8) the PUT carries the abort signal and leaving mid-save shows nothing', async () => {
        let release: (r: Response) => void = () => {}
        serve(
            [hero('A')],
            () =>
                new Promise<Response>((resolve) => {
                    release = resolve
                }),
        )
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        const signal = (puts()[0] as Request).signal
        w.unmount()
        expect(signal.aborted).toBe(true)
        release(json(doc([hero('B')])))
        await flushPromises()
        expect(useToast().message.value).toBeNull()
    })
})

describe('save: unsaved changes', () => {
    it('(AC9) the status says "Unsaved changes" while the document differs, and nothing once it is back', async () => {
        serve([hero('A')], () => json(doc([])))
        const w = await open()
        expect(status(w)).toBe('')
        await type(w, '#b1-title', 'B')
        expect(status(w)).toBe('Unsaved changes')
        await type(w, '#b1-title', 'A')
        expect(status(w)).toBe('')
    })

    it('(AC9) checking an optional object and unchecking it again leaves nothing unsaved', async () => {
        serve([hero('A')], () => json(doc([])))
        const w = await open()
        const box = w.get('input[aria-controls="b1-cta-fields"]')
        await box.setValue(true)
        expect(status(w)).toBe('Unsaved changes')
        await box.setValue(false)
        expect(status(w)).toBe('')
    })

    it('(AC9) the status region stays in the DOM through every state', async () => {
        serve([hero('A')], () => json(doc([hero('B')]), 200, { ETag: '"8"' }))
        const w = await open()
        const region = w.get('.hs-status').element
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-status').element).toBe(region)
        expect(w.findAll('[role="status"]')).toHaveLength(1)
    })
})

describe('save: server errors', () => {
    it('a 412 shows a plain form message for now', async () => {
        serve([hero('A')], () => fail(412, 'precondition_failed'))
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-blocks__message').text()).toContain('Error:')
        expect(document.activeElement).toBe(w.get('.hs-blocks__message').element)
        expect(status(w)).toBe('Unsaved changes')
    })

    it('an invalid_block with a field shows on that field of that block, which opens', async () => {
        serve([hero('A'), hero('B'), hero('C'), hero('D')], () =>
            fail(400, 'invalid_block', '/content/2/attrs/title'),
        )
        const w = await open()
        await w.findAll('.hs-block__toggle')[2]?.trigger('click')
        await type(w, '#b3-title', 'C2')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.get('#b3-title-error').text()).toBe(
            "Error: This value wasn't accepted. Please check it.",
        )
        expect(document.activeElement?.id).toBe('b3-title')
        await type(w, '#b3-title', 'C3')
        expect(w.find('#b3-title-error').exists()).toBe(false)
    })

    it('an invalid_block without a field the studio can place is a form message', async () => {
        serve([hero('A')], () => fail(400, 'invalid_block'))
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.get('.hs-blocks__message').text()).toBe(
            "Error: This block wasn't accepted. Please check its fields.",
        )
    })

    it('a 401 shows nothing', async () => {
        serve([hero('A')], () => fail(401, 'unauthenticated'))
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(w.find('.hs-blocks__message').exists()).toBe(false)
        expect(useToast().message.value).toBeNull()
        expect(saveButton(w).text()).toBe('Save blocks')
    })

    it('a network failure shows the error toast and keeps the changes', async () => {
        serve([hero('A')], () => {
            throw new TypeError('Failed to fetch')
        })
        const w = await open()
        await type(w, '#b1-title', 'B')
        await saveButton(w).trigger('click')
        await flushPromises()
        expect(useToast().message.value).toBe(
            "We couldn't save the blocks. Your changes are still here.",
        )
        expect((w.get('#b1-title').element as HTMLInputElement).value).toBe('B')
    })
})
