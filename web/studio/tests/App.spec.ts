import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { createStudioRouter } from '../src/router'

describe('studio app', () => {
    it('mounts and the router renders the home route', async () => {
        const router = createStudioRouter(createMemoryHistory())
        await router.push('/')
        await router.isReady()

        const wrapper = mount(App, { global: { plugins: [router] } })

        expect(router.currentRoute.value.name).toBe('home')
        expect(wrapper.get('h1').text()).toBe('Hivesite Studio')
    })
})
