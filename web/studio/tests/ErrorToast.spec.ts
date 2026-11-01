import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorToast from '../src/components/ErrorToast.vue'
import { dismissToast, showErrorToast, toastCopy, useToast } from '../src/composables/useToast'

describe('error toast', () => {
    it('Toast: is a manual popover with role alert and says "Error:" in words', () => {
        const w = mount(ErrorToast, { props: { message: toastCopy.server } })
        const toast = w.get('.hs-toast')
        expect(toast.attributes('role')).toBe('alert')
        expect(toast.attributes('popover')).toBe('manual')
        expect(w.get('strong').text()).toBe('Error:')
        expect(w.text()).toContain('Something went wrong on our side. Please try again.')
    })

    it('Toast: Dismiss closes it by emitting dismiss', async () => {
        const w = mount(ErrorToast, { props: { message: toastCopy.network } })
        const button = w.get('button')
        expect(button.text()).toBe('Dismiss')
        expect(button.attributes('type')).toBe('button')
        await button.trigger('click')
        expect(w.emitted('dismiss')).toHaveLength(1)
    })

    it('Toast: Escape with focus inside closes it', async () => {
        const w = mount(ErrorToast, { props: { message: toastCopy.network } })
        await w.get('button').trigger('keydown', { key: 'Escape' })
        expect(w.emitted('dismiss')).toHaveLength(1)
    })

    it('Toast: a new error replaces the text of the open toast', async () => {
        const w = mount(ErrorToast, { props: { message: toastCopy.network } })
        await w.setProps({ message: toastCopy.saveFailed('page') })
        expect(w.text()).toContain("We couldn't save the page. Your changes are still here.")
        expect(w.text()).not.toContain('reach Hivesite')
        expect(w.findAll('.hs-toast')).toHaveLength(1)
    })

    it('Toast: opens through the popover API when a message arrives and hides when cleared', async () => {
        const show = vi.fn()
        const hide = vi.fn()
        Object.assign(HTMLElement.prototype, { showPopover: show, hidePopover: hide })
        const w = mount(ErrorToast, { props: { message: null } })
        expect(show).not.toHaveBeenCalled()
        await w.setProps({ message: toastCopy.server })
        expect(show).toHaveBeenCalledTimes(1)
        expect(w.get('.hs-toast').attributes('data-open')).toBe('true')
        await w.setProps({ message: null })
        expect(hide).toHaveBeenCalledTimes(1)
        expect(w.get('.hs-toast').attributes('data-open')).toBe('false')
        Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
        Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
    })

    it('Toast: never closes on a timer', () => {
        vi.useFakeTimers()
        const { message } = useToast()
        showErrorToast(toastCopy.server)
        vi.advanceTimersByTime(10 * 60 * 1000)
        expect(message.value).toBe(toastCopy.server)
        dismissToast()
        expect(message.value).toBeNull()
        vi.useRealTimers()
    })

    it('Toast: copy matches the note', () => {
        expect(toastCopy.network).toBe(
            "We can't reach Hivesite. Check your connection and try again.",
        )
        expect(toastCopy.saveFailed('site')).toBe(
            "We couldn't save the site. Your changes are still here.",
        )
    })
})
