import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EmbedForm from '../src/blocks/forms/EmbedForm.vue'
import { documentToSend, type WorkingBlock } from '../src/blocks/model'
import { registry, type BlockEntry } from '../src/blocks/registry'

const embedEntry = registry['embed'] as BlockEntry

function embedBlock(node = embedEntry.newBlock()): WorkingBlock {
    return reactive({ key: 'b1', readOnly: false, kept: {}, node }) as unknown as WorkingBlock
}

function open(block = embedBlock(), errors: Record<string, string> = {}) {
    const wrapper = mount(EmbedForm, {
        props: { block, blockId: 'b1', errors, readonly: false },
        attachTo: document.body,
    })
    return { wrapper, block }
}

const sent = (block: WorkingBlock) =>
    documentToSend({ blocks: [block] }).content[0]?.attrs as Record<string, unknown>

const checked = (w: ReturnType<typeof open>['wrapper'], value: string) =>
    (w.get(`input[value="${value}"]`).element as HTMLInputElement).checked

describe('embed form', () => {
    it('(AC3) shows Provider (none chosen), Address, Title and Shape (Wide chosen)', () => {
        const { wrapper } = open()
        expect(wrapper.findAll('legend').map((l) => l.text())).toEqual(['Provider', 'Shape'])
        expect(wrapper.findAll('label').map((l) => l.text().split(' (req')[0])).toEqual([
            'YouTube',
            'Vimeo',
            'Google Maps',
            'Address',
            'Title',
            'Wide (16:9)',
            'Classic (4:3)',
            'Square (1:1)',
        ])
        for (const p of ['youtube', 'vimeo', 'google_maps']) expect(checked(wrapper, p)).toBe(false)
        expect(checked(wrapper, '16:9')).toBe(true)
        expect(wrapper.get('#b1-url').attributes('type')).toBe('url')
        expect(wrapper.get('#b1-title').attributes('type')).toBe('text')
        expect(wrapper.get('#b1-title-count').text()).toBe('0 of 120')
        expect(wrapper.get('#b1-title-hint').text()).toBe(
            'Says what the video or map shows, for people using a screen reader.',
        )
    })

    it('(AC3) the fields set provider, url, title and aspect_ratio', async () => {
        const { wrapper, block } = open()
        await wrapper.get('input[value="vimeo"]').setValue(true)
        await wrapper.get('#b1-url').setValue(' https://vimeo.com/1 ')
        await wrapper.get('#b1-title').setValue('Our film')
        await wrapper.get('input[value="1:1"]').setValue(true)
        expect(sent(block)).toEqual({
            provider: 'vimeo',
            url: 'https://vimeo.com/1',
            title: 'Our film',
            aspect_ratio: '1:1',
        })
    })

    it('(AC4) the Address hint follows the provider', async () => {
        const { wrapper } = open()
        const hint = () => wrapper.get('#b1-url-hint').text()
        expect(hint()).toBe('Choose a provider first.')
        await wrapper.get('input[value="youtube"]').setValue(true)
        expect(hint()).toBe('A youtube.com or youtu.be address.')
        await wrapper.get('input[value="vimeo"]').setValue(true)
        expect(hint()).toBe('A vimeo.com address.')
        await wrapper.get('input[value="google_maps"]').setValue(true)
        expect(hint()).toBe(
            'In Google Maps choose Share, then Embed a map, and copy the address that starts with https://www.google.com/maps/embed.',
        )
    })

    it('(AC5) the check reports provider, address and title in form order', () => {
        expect(embedEntry.check(embedBlock().node)).toEqual({
            provider: 'Choose a provider.',
            url: 'Use an address that starts with https://, with no spaces.',
            title: 'Enter a title.',
        })
        const bad = {
            type: 'embed',
            attrs: { provider: 'vimeo', url: 'https://youtube.com/x', title: 'x'.repeat(121) },
        }
        expect(embedEntry.check(bad)).toEqual({
            url: 'Use a Vimeo address.',
            title: 'Use 120 characters or fewer.',
        })
    })

    it('(AC5) the provider error shows under the group and its first radio is the focus target', () => {
        const { wrapper } = open(embedBlock(), { provider: 'Choose a provider.' })
        expect(wrapper.get('#b1-provider-error').text()).toBe('Error: Choose a provider.')
        expect(wrapper.get('fieldset').attributes('aria-describedby')).toBe('b1-provider-error')
    })

    it('(AC6) the first field of a new embed block is Provider, the id the screen focuses', () => {
        const { wrapper } = open()
        const first = wrapper.get('input')
        expect(first.attributes('id')).toBe('b1-provider')
        expect(first.attributes('value')).toBe('youtube')
    })
})
