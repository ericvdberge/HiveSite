import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ImageForm from '../src/blocks/forms/ImageForm.vue'
import { documentToSend, type BlockNode, type WorkingBlock } from '../src/blocks/model'
import { registry, type BlockEntry } from '../src/blocks/registry'

const imageEntry = registry['image'] as BlockEntry

function imageBlock(node = imageEntry.newBlock()): WorkingBlock {
    return reactive({ key: 'b1', readOnly: false, kept: {}, node }) as unknown as WorkingBlock
}

function open(block = imageBlock(), errors: Record<string, string> = {}) {
    const wrapper = mount(ImageForm, {
        props: { block, blockId: 'b1', errors, readonly: false },
        attachTo: document.body,
    })
    return { wrapper, block }
}

const sent = (block: WorkingBlock) =>
    documentToSend({ blocks: [block] }).content[0]?.attrs as Record<string, unknown>

describe('image form', () => {
    it('(AC1) shows Image address, Alt text, Caption and Width directly, with hints and counters', () => {
        const { wrapper } = open()
        expect(wrapper.findAll('label').map((l) => l.text().split(' (')[0])).toEqual([
            'Image address',
            'Alt text',
            'Caption',
            'Text width',
            'Wide',
            'Full width',
        ])
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
        const url = wrapper.get('#b1-image-url')
        expect(url.attributes('type')).toBe('url')
        expect(wrapper.get('#b1-image-url-count').text()).toBe('0 of 2048')
        expect(wrapper.get('#b1-image-url-hint').text()).toBe('Starts with https://.')
        expect(wrapper.get('#b1-image-alt').element.tagName).toBe('TEXTAREA')
        expect(wrapper.get('#b1-image-alt-count').text()).toBe('0 of 200')
        expect(wrapper.get('#b1-image-alt-hint').text()).toBe(
            "Describe the image for people who can't see it. Leave empty if it is only decoration.",
        )
        expect(wrapper.get('#b1-caption').element.tagName).toBe('TEXTAREA')
        expect(wrapper.get('#b1-caption-count').text()).toBe('0 of 200')
        expect(wrapper.findAll('fieldset legend').map((l) => l.text())).toEqual(['Width'])
    })

    it('(AC2) the fields set image.url, image.alt, caption and width; Text width is the default', async () => {
        const { wrapper, block } = open()
        expect(sent(block)).toEqual({
            image: { url: '', alt: '' },
            caption: '',
            width: 'content',
        })
        expect((wrapper.get('input[value="content"]').element as HTMLInputElement).checked).toBe(
            true,
        )
        await wrapper.get('#b1-image-url').setValue(' https://a.test/i.jpg ')
        await wrapper.get('#b1-caption').setValue('A bowl')
        await wrapper.get('input[value="full"]').setValue(true)
        expect(sent(block)).toEqual({
            image: { url: 'https://a.test/i.jpg', alt: '' },
            caption: 'A bowl',
            width: 'full',
        })
    })

    it('(AC2) alt is sent as "" when empty, and the new block is invalid until the address is filled', async () => {
        const { wrapper, block } = open()

        expect(
            imageEntry.check(documentToSend({ blocks: [block] }).content[0] as BlockNode),
        ).toEqual({
            'image.url': 'Use an address that starts with https://, with no spaces.',
        })
        await wrapper.get('#b1-image-url').setValue('https://a.test/i.jpg')
        await wrapper.get('#b1-image-alt').setValue('   ')
        const node = documentToSend({ blocks: [block] }).content[0] as BlockNode
        expect((node.attrs?.['image'] as Record<string, unknown>)['alt']).toBe('')
        expect(imageEntry.check(node)).toEqual({})
    })

    it('(AC5) an over-long caption or alt text says "Use 200 characters or fewer."', () => {
        const block = imageBlock({
            type: 'image',
            attrs: {
                image: { url: 'https://a.test/i.jpg', alt: 'x'.repeat(201) },
                caption: 'x'.repeat(201),
                width: 'wide',
            },
        })
        expect(imageEntry.check(block.node)).toEqual({
            'image.alt': 'Use 200 characters or fewer.',
            caption: 'Use 200 characters or fewer.',
        })
    })

    it('(AC5) errors shown come with the field', () => {
        const { wrapper } = open(imageBlock(), { 'image.url': 'Use an address.' })
        expect(wrapper.get('#b1-image-url-error').text()).toBe('Error: Use an address.')
        expect(wrapper.get('#b1-image-url').attributes('aria-invalid')).toBe('true')
    })

    it('(AC6) the first field of a new image block is Image address, the id the screen focuses', () => {
        const { wrapper } = open()
        const first = wrapper.find('input, textarea')
        expect(first.attributes('id')).toBe('b1-image-url')
    })
})
