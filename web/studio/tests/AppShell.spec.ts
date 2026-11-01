import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import AppShell from '../src/components/AppShell.vue'
import StudioNav from '../src/components/StudioNav.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast, showErrorToast } from '../src/composables/useToast'

// The site list (the "/" screen) loads on mount. The typed client captured fetch at import.
vi.hoisted(() => {
    globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch
})

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) sourceFiles(path, out)
        else if (/\.(vue|css)$/.test(name)) out.push(path)
    }
    return out
}

async function mountApp(path = '/') {
    const router = createStudioRouter(createMemoryHistory())
    await router.push(path)
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    return { router, wrapper }
}

beforeEach(() => {
    dismissToast()
    document.body.innerHTML = ''
})

describe('layout shell', () => {
    it('Layout: top bar, navigation slot and content area are landmarks, with a skip link first', async () => {
        const { wrapper } = await mountApp('/')
        expect(wrapper.find('header.hs-topbar').exists()).toBe(true)
        expect(wrapper.get('nav').attributes('aria-label')).toBe('Studio')
        expect(wrapper.get('main#main').attributes('tabindex')).toBe('-1')
        const skip = wrapper.get('a.hs-skip')
        expect(skip.attributes('href')).toBe('#main')
        expect(wrapper.element.querySelector('a')).toBe(skip.element)
        wrapper.unmount()
    })

    it('Layout: the wordmark links to the site list and keeps "Studio"', async () => {
        const { wrapper } = await mountApp('/')
        const mark = wrapper.get('.hs-topbar__mark')
        expect(mark.attributes('href')).toBe('/')
        expect(mark.text()).toBe('Hivesite Studio')
        wrapper.unmount()
    })

    it('Layout: the account slot is empty by default and takes content from #45', () => {
        const wrapper = mount(AppShell, {
            global: { plugins: [createStudioRouter(createMemoryHistory())] },
            slots: { account: '<button type="button">Account</button>', default: '<p>Hi</p>' },
        })
        expect(wrapper.get('.hs-topbar__account').text()).toBe('Account')
        expect(wrapper.get('main').text()).toBe('Hi')
    })

    it('Layout: the navigation slot can be replaced', () => {
        const wrapper = mount(AppShell, {
            global: { plugins: [createStudioRouter(createMemoryHistory())] },
            slots: { nav: '<nav aria-label="Studio" id="custom">Custom</nav>' },
        })
        expect(wrapper.find('#custom').exists()).toBe(true)
    })

    it('Layout: the nav marks the current page with aria-current, not by color alone', async () => {
        const { wrapper } = await mountApp('/')
        const sites = wrapper.get('nav a')
        expect(sites.text()).toBe('Sites')
        expect(sites.attributes('aria-current')).toBe('page')
        wrapper.unmount()
    })

    it('Layout: on a site screen the nav shows the site name as a label, not a link', () => {
        const router = createStudioRouter(createMemoryHistory())
        const wrapper = mount(StudioNav, {
            props: {
                siteName: 'Atelier Noor',
                siteLinks: [{ label: 'Pages', to: '/sites/1/pages' }],
            },
            global: { plugins: [router] },
        })
        const label = wrapper.get('.hs-nav__site')
        expect(label.text()).toBe('Atelier Noor')
        expect(label.find('a').exists()).toBe(false)
        expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Sites', 'Pages'])
    })

    it('Layout: each screen has exactly one h1 and the document title follows it', async () => {
        const { wrapper } = await mountApp('/')
        expect(wrapper.findAll('h1')).toHaveLength(1)
        expect(document.title).toBe('Your sites · Hivesite Studio')
        wrapper.unmount()
    })

    it('Layout: the first page load does not move focus to the h1', async () => {
        const { wrapper } = await mountApp('/')
        expect(document.activeElement).not.toBe(wrapper.get('h1').element)
        expect(document.activeElement).toBe(document.body)
        wrapper.unmount()
    })

    it('Layout: on a new screen focus moves to the h1 and the title follows it', async () => {
        const { wrapper, router } = await mountApp('/')
        const before = document.title
        await router.push('/no/such/place')
        await flushPromises()
        const h1 = wrapper.get('h1')
        expect(h1.text()).toBe("We can't find that site")
        expect(document.activeElement).toBe(h1.element)
        expect(document.title).not.toBe(before)
        expect(document.title).toBe("We can't find that site · Hivesite Studio")
        wrapper.unmount()
    })

    it('Layout: a catch-all route shows the not-found screen inside the shell', async () => {
        const { wrapper, router } = await mountApp('/no/such/place')
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('not-found')
        expect(wrapper.get('h1').text()).toBe("We can't find that site")
        expect(wrapper.find('header.hs-topbar').exists()).toBe(true)
        expect(wrapper.findAll('nav a').map((a) => a.text())).toEqual(['Sites'])
        wrapper.unmount()
    })
})

describe('motion and focus', () => {
    const base = readFileSync('src/styles/base.css', 'utf8')

    it('Motion: prefers-reduced-motion swaps every duration and distance for the reduced tokens', () => {
        const block =
            base.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)?.[0] ?? ''
        for (const name of ['duration-base', 'duration-slow', 'duration-slower', 'stagger']) {
            expect(block).toContain(`--hs-motion-${name}: var(--hs-motion-reduced-duration);`)
        }
        expect(block).toContain(
            '--hs-motion-rise-distance: var(--hs-motion-reduced-rise-distance);',
        )
    })

    it('Motion: every transition and animation uses a token duration of at least duration-base', () => {
        const files = sourceFiles('src').filter((f) => !f.endsWith('tokens.css'))
        const durations = new Set<string>()
        const offenders: string[] = []
        for (const file of files) {
            const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
            for (const m of text.matchAll(/(?:transition|animation)(?:-duration)?\s*:([^;]*);/g)) {
                const value = m[1] as string
                const tokens = [...value.matchAll(/var\(\s*(--hs-motion-duration-[a-z]+)\s*[,)]/g)]
                // Drop var() calls so only literal times and keywords are left.
                const rest = value.replace(/var\([^)]*\)/g, '')
                if (/\d/.test(rest) || tokens.length === 0)
                    offenders.push(`${file}: ${value.trim()}`)
                for (const d of tokens) {
                    durations.add(d[1] as string)
                    // base, slow and slower are all 300 ms or more in tokens.json.
                    if (!/duration-(base|slow|slower)$/.test(d[1] as string)) {
                        offenders.push(`${file}: ${d[1]}`)
                    }
                }
            }
        }
        expect(durations.size).toBeGreaterThan(0)
        expect(offenders).toEqual([])
    })

    it('Focus: every control has a focus ring from the focus tokens', () => {
        expect(base).toMatch(
            /:focus-visible \{\s*outline: var\(--hs-border-width-focus\) solid var\(--hs-color-focus\);\s*outline-offset: var\(--hs-border-width-focus-offset\);/,
        )
    })

    it('Targets: buttons and nav links are at least control.min_height tall', () => {
        expect(base).toMatch(/\.hs-button \{[^}]*min-block-size: var\(--hs-control-min-height\)/)
        expect(readFileSync('src/components/StudioNav.vue', 'utf8')).toMatch(
            /min-block-size: var\(--hs-control-min-height\)/,
        )
    })
})

describe('error toast in the shell', () => {
    it('Toast: an error without a field shows in the shell, outside main', async () => {
        const { wrapper } = await mountApp('/')
        showErrorToast('Something went wrong on our side. Please try again.')
        await flushPromises()
        const toast = wrapper.get('.hs-toast')
        expect(toast.text()).toContain('Something went wrong on our side. Please try again.')
        expect(wrapper.get('main').find('.hs-toast').exists()).toBe(false)
        wrapper.unmount()
    })
})
