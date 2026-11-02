import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast, useToast } from '../src/composables/useToast'
import { readFileSync } from 'node:fs'
import { baseDuration, glide, play } from '../src/motion'

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

const ids = (n: number) => `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`

function page(n: number, title: string) {
    return {
        id: ids(n),
        site_id: SITE_ID,
        title,
        slug: `page-${n}`,
        menu_order: n - 1,
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-28T09:14:03Z',
    }
}

const FIVE = [
    page(1, 'Home'),
    page(2, 'About'),
    page(3, 'Our work'),
    page(4, 'Journal'),
    page(5, 'Contact'),
]
const THREE = FIVE.slice(0, 3)

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function fail(status: number, code: string): Response {
    return json({ error: { code, message: 'Server words.' } }, status)
}

type Item = ReturnType<typeof page>
type PutHandler = (sent: string[]) => Response | Promise<Response>

const puts: string[][] = []

/** Serves the site, page lists (in order, last repeats) and PUT /sites/{id}/menu through `onPut`. */
function serve(lists: Item[][], onPut: PutHandler) {
    const queue = lists.map((items) => ({ items, next_cursor: null }))
    fetchMock.mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (req.method === 'PUT' && url.pathname === `/sites/${SITE_ID}/menu`) {
            const body = (await req.clone().json()) as { page_ids: string[] }
            puts.push(body.page_ids)
            return onPut(body.page_ids)
        }
        if (url.pathname === `/sites/${SITE_ID}`) return json(SITE)
        const next = queue.length > 1 ? queue.shift() : queue[0]
        return json(next)
    })
}

/** The server accepts the order and echoes it. */
const echo: PutHandler = (sent) => json({ site_id: SITE_ID, page_ids: sent })

async function open(): Promise<VueWrapper> {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(`/sites/${SITE_ID}/pages`)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

const rows = (w: VueWrapper) => w.findAll('.hs-row')
const titles = (w: VueWrapper) => rows(w).map((r) => r.get('.hs-row__title').text())
const status = (w: VueWrapper) => w.get('.hs-list-status').text()

function control(w: VueWrapper, row: number, kind: 'handle' | 'up' | 'down'): DOMWrapper<Element> {
    const found = rows(w)[row]?.find(`[data-action="${kind}"]`)
    if (!found?.exists()) throw new Error(`No ${kind} on row ${row}`)
    return found
}

const key = (w: VueWrapper, row: number, k: string) =>
    control(w, row, 'handle').trigger('keydown', { key: k })

const idsOf = (...ns: number[]) => ns.map(ids)

beforeEach(() => {
    fetchMock.mockReset()
    puts.length = 0
    dismissToast()
})
afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('menu reorder: the controls', () => {
    it('AC7: every row has a handle named with its page and position, plus Move up and Move down', async () => {
        serve([FIVE], echo)
        const w = await open()

        const handle = control(w, 1, 'handle')
        expect(handle.text()).toContain('Reorder About, position 2 of 5')
        expect(handle.attributes('aria-pressed')).toBe('false')
        expect(handle.attributes('aria-describedby')).toBe('reorder-help')
        expect(w.get('#reorder-help').text()).toContain('Press Space to pick up the page.')
        expect(control(w, 1, 'up').attributes('aria-label')).toBe('Move About up')
        expect(control(w, 1, 'down').attributes('aria-label')).toBe('Move About down')
        expect(w.get('ol').attributes('aria-busy')).toBe('false')
        w.unmount()
    })

    it('AC7: Move up on the first row and Move down on the last are unavailable and say why', async () => {
        serve([FIVE], echo)
        const w = await open()

        const up = control(w, 0, 'up')
        expect(up.attributes('aria-disabled')).toBe('true')
        expect(w.get(`#${up.attributes('aria-describedby')}`).text()).toBe('Already first')
        const down = control(w, 4, 'down')
        expect(down.attributes('aria-disabled')).toBe('true')
        expect(w.get(`#${down.attributes('aria-describedby')}`).text()).toBe('Already last')
        await up.trigger('click')
        await down.trigger('click')
        await flushPromises()
        expect(puts).toHaveLength(0)
        w.unmount()
    })

    it('AC7: with one page there are no reorder controls', async () => {
        serve([[page(1, 'Home')]], echo)
        const w = await open()

        expect(w.find('[data-action="handle"]').exists()).toBe(false)
        expect(w.find('[data-action="up"]').exists()).toBe(false)
        expect(w.find('[data-action="down"]').exists()).toBe(false)
        w.unmount()
    })
})

describe('menu reorder: keyboard', () => {
    it('AC7: Space picks up, Arrow Down moves, Space drops and sends the full id list in the new order', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        expect(control(w, 1, 'handle').attributes('aria-pressed')).toBe('true')
        expect(rows(w)[1]?.attributes('data-reorder')).toBe('grabbed')
        expect(status(w)).toBe(
            'About picked up. Position 2 of 3. Use the up and down arrow keys to move, Space to drop, Escape to cancel.',
        )

        await key(w, 1, 'ArrowDown')
        await flushPromises()
        expect(titles(w)).toEqual(['Home', 'Our work', 'About'])
        expect(status(w)).toBe('Moved to position 3 of 3.')
        expect(puts).toHaveLength(0)
        expect(document.activeElement).toBe(control(w, 2, 'handle').element)

        await key(w, 2, ' ')
        await flushPromises()
        expect(puts).toEqual([idsOf(1, 3, 2)])
        expect(status(w)).toBe('Order saved.')
        expect(titles(w)).toEqual(['Home', 'Our work', 'About'])
        expect(control(w, 2, 'handle').attributes('aria-pressed')).toBe('false')
        expect(document.activeElement).toBe(control(w, 2, 'handle').element)
        w.unmount()
    })

    it('AC7: Home and End jump to the first and last place', async () => {
        serve([FIVE], echo)
        const w = await open()

        await key(w, 2, 'Enter')
        await key(w, 2, 'End')
        await flushPromises()
        expect(titles(w)).toEqual(['Home', 'About', 'Journal', 'Contact', 'Our work'])
        await key(w, 4, 'Home')
        await flushPromises()
        expect(titles(w)[0]).toBe('Our work')
        expect(status(w)).toBe('Moved to position 1 of 5. Our work will become the home page.')
        w.unmount()
    })

    it('AC7: moving to the top changes the home marker only on drop, and the save says so', async () => {
        let release: (r: Response) => void = () => {}
        serve([THREE], () => new Promise<Response>((r) => (release = r)))
        const w = await open()

        await key(w, 2, ' ')
        await key(w, 2, 'Home')
        await flushPromises()
        expect(w.get('.hs-home').element.closest('li')?.getAttribute('data-page-id')).toBe(ids(1))

        await key(w, 0, ' ')
        await flushPromises()
        expect(status(w)).toBe('Our work dropped at position 1 of 3. Saving order.')
        expect(w.get('.hs-home').element.closest('li')?.getAttribute('data-page-id')).toBe(ids(3))

        release(json({ site_id: SITE_ID, page_ids: idsOf(3, 1, 2) }))
        await flushPromises()
        expect(status(w)).toBe('Order saved. Our work is now your home page.')
        expect(w.findAll('.hs-home')).toHaveLength(1)
        w.unmount()
    })

    it('AC7: Escape puts the row back and sends nothing', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        await key(w, 1, 'ArrowUp')
        await flushPromises()
        expect(titles(w)[0]).toBe('About')
        await key(w, 0, 'Escape')
        await flushPromises()

        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(status(w)).toBe('Move cancelled. About is back at position 2 of 3.')
        expect(puts).toHaveLength(0)
        expect(document.activeElement).toBe(control(w, 1, 'handle').element)
        w.unmount()
    })

    it('AC7: Tab while picked up cancels like Escape', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        await key(w, 1, 'ArrowDown')
        await flushPromises()
        await key(w, 2, 'Tab')
        await flushPromises()

        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(puts).toHaveLength(0)
        w.unmount()
    })

    it('AC7: dropping a row where it started sends nothing', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        await key(w, 1, ' ')
        await flushPromises()
        expect(puts).toHaveLength(0)
        expect(status(w)).toBe('About dropped at position 2 of 3.')
        w.unmount()
    })
})

describe('menu reorder: move buttons', () => {
    it('AC7: Move up saves at once with the full id list and focus stays on the button', async () => {
        serve([THREE], echo)
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(puts).toEqual([idsOf(1, 3, 2)])
        expect(titles(w)).toEqual(['Home', 'Our work', 'About'])
        expect(status(w)).toBe('Order saved.')
        expect(document.activeElement).toBe(control(w, 1, 'up').element)
        w.unmount()
    })

    it('AC7: the move is announced with its position, then saved; a new home is named', async () => {
        let release: (r: Response) => void = () => {}
        serve([THREE], () => new Promise<Response>((r) => (release = r)))
        const w = await open()

        await control(w, 1, 'up').trigger('click')
        await flushPromises()
        expect(status(w)).toBe('About moved to position 1 of 3. Saving order.')

        release(json({ site_id: SITE_ID, page_ids: idsOf(2, 1, 3) }))
        await flushPromises()
        expect(status(w)).toBe('Order saved. About is now your home page.')
        w.unmount()
    })
})

describe('menu reorder: saving waits for the response', () => {
    it('AC7: handles and buttons are unavailable, the list is busy, and only one request is sent', async () => {
        let release: (r: Response) => void = () => {}
        serve([THREE], () => new Promise<Response>((r) => (release = r)))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(w.get('ol').attributes('aria-busy')).toBe('true')
        expect(rows(w)[1]?.attributes('data-reorder')).toBe('saving')
        for (const row of [0, 1, 2]) {
            expect(control(w, row, 'handle').attributes('aria-disabled')).toBe('true')
            expect(control(w, row, 'up').attributes('aria-disabled')).toBe('true')
            expect(control(w, row, 'down').attributes('aria-disabled')).toBe('true')
        }
        await control(w, 0, 'down').trigger('click')
        await key(w, 0, ' ')
        await w.get('[data-action="delete"]').trigger('click')
        expect(puts).toHaveLength(1)
        expect(w.find('dialog').exists()).toBe(false)

        release(json({ site_id: SITE_ID, page_ids: idsOf(1, 3, 2) }))
        await flushPromises()
        expect(w.get('ol').attributes('aria-busy')).toBe('false')
        expect(control(w, 0, 'down').attributes('aria-disabled')).toBeUndefined()
        w.unmount()
    })

    it('AC7: the echoed order wins over the order that was sent', async () => {
        serve([THREE], () => json({ site_id: SITE_ID, page_ids: idsOf(3, 1, 2) }))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(titles(w)).toEqual(['Our work', 'Home', 'About'])
        expect(rows(w).map((r) => r.get('.hs-row__pos').text())).toEqual(['1', '2', '3'])
        expect(w.get('.hs-home').element.closest('li')?.getAttribute('data-page-id')).toBe(ids(3))
        w.unmount()
    })
})

describe('menu reorder: pointer drag', () => {
    function layout() {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement,
        ) {
            const li = this.closest('li')
            const rect = (top: number, height: number, left = 0, width = 400) =>
                ({
                    top,
                    height,
                    left,
                    width,
                    right: left + width,
                    bottom: top + height,
                    x: left,
                    y: top,
                    toJSON: () => ({}),
                }) as DOMRect
            if (this.tagName === 'OL') return rect(0, 500)
            if (li?.parentElement) {
                const index = [...li.parentElement.children].indexOf(li)
                return rect(index * 100, 100)
            }
            return rect(0, 0)
        })
    }

    /** jsdom has no PointerEvent: a MouseEvent of the pointer type carries the same fields. */
    async function fire(el: Element, type: string, x: number, y: number, id = 1) {
        const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
        Object.defineProperty(event, 'pointerId', { value: id })
        Object.defineProperty(event, 'pointerType', { value: 'mouse' })
        el.dispatchEvent(event)
        await flushPromises()
    }

    async function drag(w: VueWrapper, row: number, to: number, x = 50) {
        const handle = control(w, row, 'handle').element
        await fire(handle, 'pointerdown', 20, row * 100 + 50)
        await fire(handle, 'pointermove', 20, to)
        return { release: () => fire(handle, 'pointerup', x, to) }
    }

    it('AC7: dragging the handle shows the grab look and the over line at the landing slot', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        await drag(w, 0, 300)
        expect(rows(w)[0]?.attributes('data-reorder')).toBe('grabbed')
        expect(rows(w)[0]?.attributes('style')).toContain('translateY(250px)')
        // Dragged below the last other row: the line sits after it.
        expect(rows(w)[2]?.classes()).toContain('hs-row--over-after')
        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        w.unmount()
    })

    it('AC7: releasing over the list saves the full id list in the new order', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        const { release } = await drag(w, 0, 160)
        await release()
        await flushPromises()

        expect(puts).toEqual([idsOf(2, 1, 3)])
        expect(titles(w)).toEqual(['About', 'Home', 'Our work'])
        expect(status(w)).toBe('Order saved. About is now your home page.')
        w.unmount()
    })

    it('AC7: releasing outside the list puts the row back and sends nothing', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        const { release } = await drag(w, 0, 160, 900)
        await release()
        await flushPromises()

        expect(puts).toHaveLength(0)
        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(rows(w)[0]?.attributes('data-reorder')).toBe('rest')
        w.unmount()
    })

    it('AC7: Escape during a drag cancels it and sends nothing', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        const { release } = await drag(w, 0, 160)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()
        await release()
        await flushPromises()

        expect(puts).toHaveLength(0)
        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(status(w)).toBe('Move cancelled. Home is back at position 1 of 3.')
        w.unmount()
    })
    it('AC7: a pointercancel (the browser takes the touch) cancels the drag and sends nothing', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        await drag(w, 0, 160)
        await fire(control(w, 0, 'handle').element, 'pointercancel', 20, 160)

        expect(puts).toHaveLength(0)
        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(rows(w)[0]?.attributes('data-reorder')).toBe('rest')
        expect(status(w)).toBe('Move cancelled. Home is back at position 1 of 3.')
        w.unmount()
    })

    it('AC7: events from another pointer are ignored during a drag', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()

        await drag(w, 0, 160)
        const handle = control(w, 0, 'handle').element
        await fire(handle, 'pointermove', 20, 400, 2)
        await fire(handle, 'pointerup', 50, 400, 2)
        await fire(handle, 'pointercancel', 20, 400, 2)

        expect(rows(w)[0]?.attributes('data-reorder')).toBe('grabbed')
        expect(rows(w)[0]?.attributes('style')).toContain('translateY(110px)')
        expect(puts).toHaveLength(0)
        w.unmount()
    })

    it('AC7: scrolling during a drag keeps the row under the pointer', async () => {
        layout()
        serve([THREE], echo)
        const w = await open()
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })

        await drag(w, 0, 160)
        expect(rows(w)[0]?.attributes('style')).toContain('translateY(110px)')
        Object.defineProperty(window, 'scrollY', { value: 100, configurable: true, writable: true })
        window.dispatchEvent(new Event('scroll'))
        await flushPromises()

        expect(rows(w)[0]?.attributes('style')).toContain('translateY(210px)')
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
        w.unmount()
    })

    it('AC7: dragging near the top edge scrolls the page', async () => {
        layout()
        serve([THREE], echo)
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
        const scrollBy = vi.fn()
        window.scrollBy = scrollBy as unknown as typeof window.scrollBy
        const w = await open()

        await drag(w, 1, 20)
        frames.shift()?.(0)

        expect(scrollBy).toHaveBeenCalledTimes(1)
        expect((scrollBy.mock.calls[0] as number[])[1]).toBeLessThan(0)
        w.unmount()
    })
})

describe('menu reorder: menu_mismatch', () => {
    it('AC8: reloads the list, shows the Note asking to try again, and focuses the moved row handle', async () => {
        serve(
            [THREE, [page(1, 'Home'), page(3, 'Our work'), page(2, 'About'), page(4, 'Journal')]],
            () => fail(400, 'menu_mismatch'),
        )
        const w = await open()
        const lists = () =>
            fetchMock.mock.calls.filter(([r]) =>
                new URL((r as Request).url).pathname.endsWith('/pages'),
            )
        const before = lists().length

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(lists().length).toBe(before + 1)
        expect(titles(w)).toEqual(['Home', 'Our work', 'About', 'Journal'])
        const note = w.get('.hs-note')
        expect(note.attributes('role')).toBe('alert')
        expect(note.text()).toBe(
            'Note: Your pages changed somewhere else, so we reloaded the list. Please make your move again.',
        )
        expect(w.get('ol').attributes('aria-busy')).toBe('false')
        expect(document.activeElement).toBe(control(w, 1, 'handle').element)
        expect(useToast().message.value).toBeNull()
        w.unmount()
    })

    it('AC8: keeps the rows visible with controls unavailable while the list reloads', async () => {
        let releaseList: (r: Response) => void = () => {}
        let listCalls = 0
        fetchMock.mockImplementation(async (req: Request) => {
            const url = new URL(req.url)
            if (req.method === 'PUT') return fail(400, 'menu_mismatch')
            if (url.pathname === `/sites/${SITE_ID}`) return json(SITE)
            listCalls += 1
            if (listCalls === 1) return json({ items: THREE, next_cursor: null })
            return new Promise<Response>((r) => (releaseList = r))
        })
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()
        expect(rows(w)).toHaveLength(3)
        expect(w.get('ol').attributes('aria-busy')).toBe('true')
        expect(control(w, 0, 'handle').attributes('aria-disabled')).toBe('true')

        releaseList(json({ items: THREE, next_cursor: null }))
        await flushPromises()
        expect(w.get('ol').attributes('aria-busy')).toBe('false')
        w.unmount()
    })

    it('AC8: the Note goes away after the next successful save', async () => {
        let first = true
        serve([THREE], (sent) => {
            if (first) {
                first = false
                return fail(400, 'menu_mismatch')
            }
            return echo(sent)
        })
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()
        expect(w.find('.hs-note').exists()).toBe(true)
        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(puts).toHaveLength(2)
        expect(w.find('.hs-note').exists()).toBe(false)
        w.unmount()
    })
})

describe('menu reorder: failures', () => {
    it('AC7: a server failure returns the last saved order, shows the toast and says so', async () => {
        serve([THREE], () => fail(500, 'internal_error'))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(useToast().message.value).toBe(
            "We couldn't save the new order. Your pages are back in their last saved order.",
        )
        expect(status(w)).toBe('Order not saved. Our work is back at position 3 of 3.')
        expect(w.get('.hs-home').element.closest('li')?.getAttribute('data-page-id')).toBe(ids(1))
        expect(w.get('ol').attributes('aria-busy')).toBe('false')
        w.unmount()
    })

    it('AC7: a 401 returns the last saved order and shows nothing of its own', async () => {
        serve([THREE], () => fail(401, 'unauthenticated'))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(useToast().message.value).toBeNull()
        w.unmount()
    })

    it('AC7: site_not_found shows the not-found screen for a site', async () => {
        serve([THREE], () => fail(404, 'site_not_found'))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(w.get('h1').text()).toBe("We can't find that site")
        w.unmount()
    })
})

describe('menu reorder: motion', () => {
    function withDuration(value: string, run: () => Promise<void>) {
        document.documentElement.style.setProperty('--hs-motion-duration-base', value)
        return run().finally(() => {
            document.documentElement.style.removeProperty('--hs-motion-duration-base')
        })
    }

    it('AC7: a glide plays over motion.duration_base, which is 300 ms or more', async () => {
        const animate = vi.fn(() => ({ finished: Promise.resolve() }))
        const el = document.createElement('div') as HTMLElement
        el.animate = animate as unknown as HTMLElement['animate']
        await withDuration('300ms', async () => {
            expect(baseDuration()).toBe(300)
            await play(el, [{ opacity: 0 }, { opacity: 1 }])
        })
        expect(animate).toHaveBeenCalledTimes(1)
        const calls = animate.mock.calls as unknown as Array<[unknown, { duration: number }]>
        expect(calls[0]?.[1].duration).toBeGreaterThanOrEqual(300)
    })

    it('AC7: under reduced motion (duration token 0) nothing is animated', async () => {
        const animate = vi.fn(() => ({ finished: Promise.resolve() }))
        const el = document.createElement('div') as HTMLElement
        el.animate = animate as unknown as HTMLElement['animate']
        await withDuration('0ms', async () => {
            await play(el, [{ opacity: 0 }, { opacity: 1 }])
        })
        expect(animate).not.toHaveBeenCalled()
    })
})

describe('menu reorder: fix round', () => {
    it('AC7: Tab while a moved row is picked up cancels and focuses the title link of its original row', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        await key(w, 1, 'ArrowDown')
        await flushPromises()
        await control(w, 2, 'handle').trigger('keydown', { key: 'Tab' })
        await flushPromises()

        expect(titles(w)).toEqual(['Home', 'About', 'Our work'])
        expect(document.activeElement).toBe(rows(w)[1]?.get('.hs-row__title').element)
        w.unmount()
    })

    it('AC7: Shift+Tab while picked up focuses the control before the original row', async () => {
        serve([THREE], echo)
        const w = await open()

        await key(w, 1, ' ')
        await key(w, 1, 'ArrowDown')
        await flushPromises()
        await control(w, 2, 'handle').trigger('keydown', { key: 'Tab', shiftKey: true })
        await flushPromises()

        expect(document.activeElement).toBe(
            control(w, 0, 'handle').element.parentElement?.querySelector('[data-action="delete"]'),
        )
        w.unmount()
    })

    it('AC7: a successful save after a failed one dismisses the error toast', async () => {
        let first = true
        serve([THREE], (sent) => {
            if (first) {
                first = false
                return fail(500, 'internal_error')
            }
            return echo(sent)
        })
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()
        expect(useToast().message.value).not.toBeNull()
        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(useToast().message.value).toBeNull()
        w.unmount()
    })

    it('AC7: after a 401 the status line no longer says Saving order', async () => {
        serve([THREE], () => fail(401, 'unauthenticated'))
        const w = await open()

        await control(w, 2, 'up').trigger('click')
        await flushPromises()

        expect(status(w)).toBe('')
        w.unmount()
    })

    it('AC7: an unavailable handle has the unavailable look (disabled edge and text)', () => {
        const source = readFileSync('src/views/PageListView.vue', 'utf8')
        const rule = /\.hs-handle\[aria-disabled='true'\]\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''
        expect(rule).toContain('border-color: var(--hs-color-disabled-border)')
        expect(rule).toContain('color: var(--hs-color-disabled-text)')
    })

    it('AC7: a glide cancels a running glide before reading where the row is', () => {
        const order: string[] = []
        const el = document.createElement('div')
        el.getAnimations = (() => [
            { cancel: () => order.push('cancel') },
        ]) as unknown as HTMLElement['getAnimations']
        el.getBoundingClientRect = () => {
            order.push('read')
            return { top: 0 } as DOMRect
        }
        glide(el, 40)
        expect(order).toEqual(['cancel', 'read'])
    })
})

describe('menu reorder: motion tokens', () => {
    it('AC7: tokens.css gives motion.duration_base 300 ms and reduced motion maps it to 0 ms', () => {
        const tokens = readFileSync('src/styles/tokens.css', 'utf8')
        const base = readFileSync('src/styles/base.css', 'utf8')
        expect(tokens).toMatch(/--hs-motion-duration-base:\s*300ms;/)
        expect(tokens).toMatch(/--hs-motion-reduced-duration:\s*0ms;/)
        const reduced =
            /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(
                base,
            )?.[1] ?? ''
        expect(reduced).toContain('--hs-motion-duration-base: var(--hs-motion-reduced-duration)')
    })
})
