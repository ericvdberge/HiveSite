import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import AppShell from '../src/components/AppShell.vue'
import StudioNav from '../src/components/StudioNav.vue'
import { createStudioRouter } from '../src/router'
import { dismissToast, showErrorToast } from '../src/composables/useToast'

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
        expect(document.title).toBe('Hivesite Studio · Hivesite Studio')
        wrapper.unmount()
    })

    it('Layout: on a new screen focus moves to the h1', async () => {
        const { wrapper } = await mountApp('/')
        expect(document.activeElement).toBe(wrapper.get('h1').element)
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
        const files = [
            'src/App.vue',
            'src/components/ErrorToast.vue',
            'src/components/StudioNav.vue',
            'src/styles/base.css',
        ]
        const durations = new Set<string>()
        for (const file of files) {
            const text = readFileSync(file, 'utf8')
            for (const m of text.matchAll(/(?:transition|animation):([^;]*);/g)) {
                for (const d of (m[1] as string).matchAll(
                    /var\((--hs-motion-duration-[a-z]+)\)/g,
                )) {
                    durations.add(d[1] as string)
                }
            }
        }
        expect(durations.size).toBeGreaterThan(0)
        // base, slow and slower are all 300 ms or more in tokens.json.
        for (const d of durations) expect(d).toMatch(/duration-(base|slow|slower)$/)
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
