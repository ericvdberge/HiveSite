import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'

// The site list loads on mount. The typed client captured fetch at import, so stub it first.
vi.hoisted(() => {
    globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch
})

describe('studio app', () => {
    it('mounts and the router renders the site list on /', async () => {
        const router = createStudioRouter(createMemoryHistory())
        await router.push('/')
        await router.isReady()

        const wrapper = mount(App, { global: { plugins: [router] } })

        expect(router.currentRoute.value.name).toBe('sites')
        expect(wrapper.get('h1').text()).toBe('Your sites')
    })
})
