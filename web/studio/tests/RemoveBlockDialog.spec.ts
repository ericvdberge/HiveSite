import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RemoveBlockDialog from '../src/components/RemoveBlockDialog.vue'

function open() {
    return mount(RemoveBlockDialog, {
        props: { position: 2, name: 'Rich text' },
        attachTo: document.body,
    })
}

describe('RemoveBlockDialog', () => {
    it('(AC6) names the block in the title and holds the body and the secondary line', () => {
        const w = open()
        expect(w.get('h2').text()).toBe('Remove block 2, "Rich text"?')
        expect(w.get('dialog').attributes('aria-describedby')).toBe('remove-body')
        expect(w.get('#remove-body').text()).toContain(
            'This removes the block and everything in it from the page. It is gone for good when you save.',
        )
        expect(w.get('.hs-dialog__aside').text()).toBe(
            'Releases you have already published keep their copy.',
        )
    })

    it('(AC6) has Cancel, focused on open, and a danger "Remove block"', () => {
        const w = open()
        const [cancel, remove] = w.findAll('.hs-dialog__actions button')
        expect(cancel?.text()).toBe('Cancel')
        expect(document.activeElement).toBe(cancel?.element)
        expect(remove?.text()).toBe('Remove block')
        expect(remove?.classes()).toContain('hs-button--danger')
    })

    it('(AC6) Escape and Cancel cancel; "Remove block" confirms', async () => {
        const w = open()
        await w.get('dialog').trigger('keydown', { key: 'Escape' })
        await w.findAll('.hs-dialog__actions button')[0]?.trigger('click')
        expect(w.emitted('cancel')).toHaveLength(2)
        await w.findAll('.hs-dialog__actions button')[1]?.trigger('click')
        expect(w.emitted('confirm')).toHaveLength(1)
    })
})
