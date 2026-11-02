import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
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
].map(([type, name]) => ({ type, name, description: `${name} words.`, version: 1, schema: {} }))

const hero = (title: string) => ({
    type: 'hero',
    attrs: { title, subtitle: '', image: null, cta: null },
})
const text = (n: number) => ({ type: 'rich_text', attrs: { n } })

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    })
}

function serve(content: unknown[], types: unknown[] = TYPES) {
    fetchMock.mockImplementation((req: Request) => {
        const path = new URL(req.url).pathname
        if (path === `/pages/${PAGE_ID}/blocks`) {
            return Promise.resolve(json({ type: 'doc', content }, 200, { ETag: '"7"' }))
        }
        if (path === `/pages/${PAGE_ID}`) return Promise.resolve(json(PAGE))
        if (path === '/block-types') {
            return Promise.resolve(json({ items: types, next_cursor: null }))
        }
        if (path === `/sites/${SITE_ID}`) return Promise.resolve(json(SITE))
        return Promise.resolve(json({ items: [], next_cursor: null }))
    })
}

async function open(content: unknown[], types?: unknown[]): Promise<VueWrapper> {
    serve(content, types)
    const router = createStudioRouter(createMemoryHistory())
    await router.push('/sites')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    await router.push(`/pages/${PAGE_ID}/blocks`)
    await flushPromises()
    return wrapper
}

const panels = (w: VueWrapper) => w.findAll('li.hs-block')
function panel(w: VueWrapper, i: number) {
    const p = panels(w)[i]
    if (!p) throw new Error(`no panel ${i}`)
    return p
}
const names = (w: VueWrapper) => panels(w).map((p) => p.get('.hs-block__name').text())
const head = (w: VueWrapper) => w.get('.hs-status').text()
const listStatus = (w: VueWrapper) => w.get('[role="status"] > p:last-child').text()
const dialogTitle = (w: VueWrapper) => w.find('dialog h2').text()
const button = (w: VueWrapper, label: string) => w.findAll('button').find((b) => b.text() === label)

async function addBlock(w: VueWrapper, type: string, place = 'end'): Promise<void> {
    await w.get('#add-block').trigger('click')
    await w.get(`dialog input[value="${type}"]`).setValue(true)
    await w.get('dialog select').setValue(place)
    await w.get('dialog form').trigger('submit')
    await flushPromises()
}

beforeEach(() => {
    fetchMock.mockReset()
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('add a block', () => {
    it('(AC1) "Add block" at the end of the list opens "Add a block" with the types that have a form', async () => {
        const w = await open([hero('A'), text(1)])
        await w.get('#add-block').trigger('click')
        expect(dialogTitle(w)).toBe('Add a block')
        // Only Hero has a form so far; the others appear as their forms land.
        const rows = w.findAll('dialog .hs-choice')
        expect(rows).toHaveLength(1)
        expect(rows[0]?.text()).toContain('Hero')
        expect(rows[0]?.text()).toContain('Hero words.')
    })

    it('(AC1) does not offer a type whose version is not 1', async () => {
        const w = await open(
            [text(1)],
            TYPES.map((t) => (t.type === 'hero' ? { ...t, version: 2 } : t)),
        )
        await w.get('#add-block').trigger('click')
        expect(w.findAll('dialog .hs-choice')).toHaveLength(0)
    })

    it('(AC1) the empty state has "Add a block", and the dialog checks Hero and has no Place', async () => {
        const w = await open([])
        expect(w.find('#add-block').exists()).toBe(false)
        await w.get('#add-block-empty').trigger('click')
        expect((w.get('dialog input:checked').element as HTMLInputElement).value).toBe('hero')
        expect(w.find('dialog select').exists()).toBe(false)
    })

    it('(AC2) Place lists the blocks of the page', async () => {
        const w = await open([hero('A'), text(1)])
        await w.get('#add-block').trigger('click')
        expect(w.findAll('dialog option').map((o) => o.text())).toEqual([
            'At the end',
            'At the start',
            'After 1. Hero',
            'After 2. Rich text',
        ])
    })

    it('(AC3) a second hero shows the Note and can still be added', async () => {
        const w = await open([hero('A')])
        await w.get('#add-block').trigger('click')
        await w.get('dialog input[value="hero"]').setValue(true)
        expect(w.get('dialog .hs-note').text()).toBe(
            "Note: This page already has a hero. Only the first hero's title becomes the page heading.",
        )
        await w.get('dialog form').trigger('submit')
        await flushPromises()
        expect(names(w)).toEqual(['Hero', 'Hero'])
    })

    it('(AC4) inserts the block with its defaults at the place, open, focused on its first field, and says so', async () => {
        const w = await open([text(1), text(2), text(3), text(4), text(5)])
        await addBlock(w, 'hero', 'after:2')

        expect(w.find('dialog').exists()).toBe(false)
        expect(names(w)).toEqual([
            'Rich text',
            'Rich text',
            'Hero',
            'Rich text',
            'Rich text',
            'Rich text',
        ])
        const added = panel(w, 2)
        expect(added.get('.hs-block__toggle').attributes('aria-expanded')).toBe('true')
        expect(
            (added.get('input[type="text"], input:not([type])').element as HTMLInputElement).value,
        ).toBe('')
        expect(document.activeElement?.id).toMatch(/-title$/)
        expect(added.element.contains(document.activeElement)).toBe(true)
        expect(listStatus(w)).toBe('Hero added at position 3 of 6. Not saved yet.')
        expect(head(w)).toBe('Unsaved changes')
        expect(w.get('#block-count').text()).toBe('6 of 40 blocks')
    })

    it('(AC4) at the start and at the end', async () => {
        const w = await open([text(1)])
        await addBlock(w, 'hero', 'start')
        expect(names(w)).toEqual(['Hero', 'Rich text'])
        expect(listStatus(w)).toBe('Hero added at position 1 of 2. Not saved yet.')
        await addBlock(w, 'hero', 'end')
        expect(names(w)).toEqual(['Hero', 'Rich text', 'Hero'])
    })

    it('(AC4) from the empty state the block is added and the empty state goes', async () => {
        const w = await open([])
        await w.get('#add-block-empty').trigger('click')
        await w.get('dialog form').trigger('submit')
        await flushPromises()
        expect(names(w)).toEqual(['Hero'])
        expect(w.find('.hs-empty').exists()).toBe(false)
        expect(listStatus(w)).toBe('Hero added at position 1 of 1. Not saved yet.')
    })

    it('(AC5) at 40 blocks "Add block" is unavailable, with its reason linked, and the count reads 40 of 40', async () => {
        const w = await open(Array.from({ length: 40 }, (_, i) => text(i)))
        const add = w.get('#add-block')
        expect(add.attributes('aria-disabled')).toBe('true')
        const reason = w.get(`#${add.attributes('aria-describedby')}`)
        expect(reason.text()).toBe('A page holds 40 blocks at most.')
        expect(w.get('#block-count').text()).toBe('40 of 40 blocks')
        await add.trigger('click')
        expect(w.find('dialog').exists()).toBe(false)
    })

    it('(AC5) below 40 blocks there is no limit text', async () => {
        const w = await open([text(1)])
        expect(w.get('#add-block').attributes('aria-disabled')).toBeUndefined()
        expect(w.text()).not.toContain('A page holds 40 blocks at most.')
    })

    it('(AC10) Cancel and Escape close the dialog, add nothing and return focus to "Add block"', async () => {
        const w = await open([text(1)])
        await w.get('#add-block').trigger('click')
        await w.get('dialog').trigger('keydown', { key: 'Escape' })
        await flushPromises()
        expect(w.find('dialog').exists()).toBe(false)
        expect(document.activeElement?.id).toBe('add-block')
        expect(names(w)).toEqual(['Rich text'])

        await w.get('#add-block').trigger('click')
        await button(w, 'Cancel')?.trigger('click')
        await flushPromises()
        expect(w.find('dialog').exists()).toBe(false)
        expect(head(w)).toBe('')
    })
})

describe('remove a block', () => {
    it('(AC6) "Remove" opens the confirm with the title, body, secondary line, and Cancel focused', async () => {
        const w = await open([hero('A'), text(1)])
        await panel(w, 1).get('.hs-block__actions button').trigger('click')
        expect(dialogTitle(w)).toBe('Remove block 2, "Rich text"?')
        expect(w.get('dialog').text()).toContain(
            'This removes the block and everything in it from the page. It is gone for good when you save.',
        )
        expect(w.get('dialog').text()).toContain(
            'Releases you have already published keep their copy.',
        )
        expect(document.activeElement?.textContent?.trim()).toBe('Cancel')
        expect(button(w, 'Remove block')?.classes()).toContain('hs-button--danger')
    })

    it("(AC6) Escape and Cancel keep the block and return focus to that block's Remove", async () => {
        const w = await open([hero('A'), text(1)])
        const remove = panel(w, 1).get('.hs-block__actions button')
        await remove.trigger('click')
        await w.get('dialog').trigger('keydown', { key: 'Escape' })
        await flushPromises()
        expect(w.find('dialog').exists()).toBe(false)
        expect(names(w)).toEqual(['Hero', 'Rich text'])
        expect(document.activeElement).toBe(remove.element)

        await remove.trigger('click')
        await button(w, 'Cancel')?.trigger('click')
        await flushPromises()
        expect(document.activeElement).toBe(remove.element)
        expect(head(w)).toBe('')
    })

    it('(AC7) confirming removes the block, renumbers, says so and focuses the toggle now at that place', async () => {
        const w = await open([hero('A'), text(1), text(2)])
        await panel(w, 1).get('.hs-block__actions button').trigger('click')
        await button(w, 'Remove block')?.trigger('click')
        await flushPromises()

        expect(w.find('dialog').exists()).toBe(false)
        expect(panels(w).map((p) => p.get('.hs-block__pos').text())).toEqual(['1', '2'])
        expect(listStatus(w)).toBe('Rich text removed. Not saved yet.')
        expect(head(w)).toBe('Unsaved changes')
        expect(w.get('#block-count').text()).toBe('2 of 40 blocks')
        expect(document.activeElement).toBe(panel(w, 1).get('.hs-block__toggle').element)
    })

    it('(AC7) removing the last block focuses the new last block', async () => {
        const w = await open([hero('A'), text(1)])
        await panel(w, 1).get('.hs-block__actions button').trigger('click')
        await button(w, 'Remove block')?.trigger('click')
        await flushPromises()
        expect(document.activeElement).toBe(panel(w, 0).get('.hs-block__toggle').element)
    })

    it('(AC7) removing the only block focuses "Add a block" in the empty state', async () => {
        const w = await open([text(1)])
        await panel(w, 0).get('.hs-block__actions button').trigger('click')
        await button(w, 'Remove block')?.trigger('click')
        await flushPromises()
        expect(w.find('.hs-empty').exists()).toBe(true)
        expect(document.activeElement?.id).toBe('add-block-empty')
    })

    it('(AC8) a new block nothing was typed into is removed without the dialog', async () => {
        const w = await open([text(1)])
        await addBlock(w, 'hero', 'start')
        await panel(w, 0).get('.hs-block__actions button').trigger('click')
        await flushPromises()
        expect(w.find('dialog').exists()).toBe(false)
        expect(names(w)).toEqual(['Rich text'])
        expect(listStatus(w)).toBe('Hero removed. Not saved yet.')
    })

    it('(AC8) a new block with typing in it asks first', async () => {
        const w = await open([text(1)])
        await addBlock(w, 'hero', 'start')
        await panel(w, 0).get('input').setValue('Hello')
        await panel(w, 0).get('.hs-block__actions button').trigger('click')
        expect(dialogTitle(w)).toBe('Remove block 1, "Hero"?')
    })

    it('(AC9) a block added and removed again leaves the document as saved and the status empty', async () => {
        const w = await open([hero('A')])
        await addBlock(w, 'hero')
        expect(head(w)).toBe('Unsaved changes')
        await panel(w, 1).get('.hs-block__actions button').trigger('click')
        await flushPromises()
        expect(head(w)).toBe('')

        const calls = fetchMock.mock.calls.length
        await button(w, 'Save blocks')?.trigger('click')
        await flushPromises()
        expect(head(w)).toBe('No changes to save.')
        expect(fetchMock.mock.calls).toHaveLength(calls)
    })

    it('(AC9) removing a block and nothing else sends a document without it', async () => {
        const w = await open([hero('A'), text(1)])
        await panel(w, 1).get('.hs-block__actions button').trigger('click')
        await button(w, 'Remove block')?.trigger('click')
        await flushPromises()
        fetchMock.mockImplementationOnce(async (req: Request) => {
            expect(req.method).toBe('PUT')
            expect(await req.json()).toEqual({ type: 'doc', content: [hero('A')] })
            return json({ type: 'doc', content: [hero('A')] }, 200, { ETag: '"8"' })
        })
        await w.get('form#blocks').trigger('submit')
        await flushPromises()
        expect(head(w)).toBe('Blocks saved.')
        expect(listStatus(w)).toBe('')
    })

    it('(AC10) there is one status region on the screen', async () => {
        const w = await open([hero('A')])
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        await addBlock(w, 'hero')
        expect(w.findAll('[role="status"]')).toHaveLength(1)
        expect(w.findAll('dialog')).toHaveLength(0)
    })
})
