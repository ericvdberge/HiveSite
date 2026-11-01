import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import NotFoundScreen from '../src/components/NotFoundScreen.vue'
import { createStudioRouter } from '../src/router'

function mountScreen(props: { code: 'site_not_found' | 'page_not_found'; pagesTo?: string }) {
    return mount(NotFoundScreen, {
        props,
        global: { plugins: [createStudioRouter(createMemoryHistory())] },
    })
}

describe('not-found screen', () => {
    it('Not found: site_not_found says we cannot find that site and goes back to the sites', () => {
        const w = mountScreen({ code: 'site_not_found' })
        expect(w.get('.hs-eyebrow').text()).toBe('Not found')
        expect(w.get('h1').text()).toBe("We can't find that site")
        expect(w.text()).toContain('It may have been removed, or the link may be wrong.')
        const action = w.get('a.hs-button')
        expect(action.text()).toBe('Back to your sites')
        expect(action.attributes('href')).toBe('/')
    })

    it('Not found: page_not_found says we cannot find that page', () => {
        const w = mountScreen({ code: 'page_not_found' })
        expect(w.get('h1').text()).toBe("We can't find that page")
        expect(w.text()).toContain('It may have been deleted, or the link may be wrong.')
    })

    it('Not found: page_not_found goes back to pages when the site is known', () => {
        const w = mountScreen({ code: 'page_not_found', pagesTo: '/sites/1/pages' })
        const action = w.get('a.hs-button')
        expect(action.text()).toBe('Back to pages')
        expect(action.attributes('href')).toBe('/sites/1/pages')
    })

    it('Not found: page_not_found goes back to your sites when the site is unknown', () => {
        const w = mountScreen({ code: 'page_not_found' })
        expect(w.get('a.hs-button').text()).toBe('Back to your sites')
    })

    it('Not found: the status number is never shown', () => {
        expect(mountScreen({ code: 'site_not_found' }).text()).not.toMatch(/404/)
    })

    it('Not found: has exactly one h1 that can take focus', () => {
        const w = mountScreen({ code: 'site_not_found' })
        expect(w.findAll('h1')).toHaveLength(1)
        expect(w.get('h1').attributes('tabindex')).toBe('-1')
    })
})
