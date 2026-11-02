import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import HeroForm from '../src/blocks/forms/HeroForm.vue'
import { documentToSend, type WorkingBlock } from '../src/blocks/model'
import RadioGroup from '../src/components/fields/RadioGroup.vue'

function heroBlock(attrs: Record<string, unknown> = {}): WorkingBlock {
    return reactive({
        key: 'b1',
        readOnly: false,
        kept: {},
        node: {
            type: 'hero',
            attrs: { title: 'Made slowly', subtitle: '', image: null, cta: null, ...attrs },
        },
    }) as unknown as WorkingBlock
}

function open(block = heroBlock(), errors: Record<string, string> = {}, readonly = false) {
    const wrapper = mount(HeroForm, {
        props: { block, blockId: 'b1', errors, readonly },
        attachTo: document.body,
    })
    return { wrapper, block }
}

const sent = (block: WorkingBlock) =>
    documentToSend({ blocks: [block] }).content[0]?.attrs as Record<string, unknown>

describe('hero form: fields', () => {
    it('(AC1) shows Title, Subtitle, "Show an image" and "Show a button", each with a visible label', () => {
        const { wrapper } = open()
        const labels = wrapper.findAll('label').map((l) => l.text())
        expect(labels).toEqual([
            'Title (required)',
            'Subtitle',
            'Show an image',
            'Image address (required)',
            'Alt text',
            'Show a button',
            'Button label (required)',
            'Link (required)',
        ])
    })

    it('(AC1) Title is a text input with its hint and counter "n of 80"', () => {
        const { wrapper } = open()
        const title = wrapper.get('#b1-title')
        expect(title.element.tagName).toBe('INPUT')
        expect(title.attributes('type')).toBe('text')
        expect(wrapper.get('#b1-title-hint').text()).toBe(
            "The page's main heading. Only the hero has one.",
        )
        expect(wrapper.get('#b1-title-count').text()).toBe('11 of 80')
    })

    it('(AC1) Subtitle is a textarea with "n of 160"; Alt text a textarea with "n of 200"', () => {
        const { wrapper } = open()
        expect(wrapper.get('#b1-subtitle').element.tagName).toBe('TEXTAREA')
        expect(wrapper.get('#b1-subtitle-count').text()).toBe('0 of 160')
        expect(wrapper.get('#b1-image-alt').element.tagName).toBe('TEXTAREA')
        expect(wrapper.get('#b1-image-alt-count').text()).toBe('0 of 200')
    })

    it('(AC1) the image URL is a url input with "n of 2048"; Button label says "n of 30"', () => {
        const { wrapper } = open()
        const url = wrapper.get('#b1-image-url')
        expect(url.attributes('type')).toBe('url')
        expect(url.attributes('inputmode')).toBe('url')
        expect(url.attributes('autocapitalize')).toBe('none')
        expect(url.attributes('spellcheck')).toBe('false')
        expect(wrapper.get('#b1-image-url-count').text()).toBe('0 of 2048')
        expect(wrapper.get('#b1-cta-label-count').text()).toBe('0 of 30')
        const href = wrapper.get('#b1-cta-href')
        expect(href.attributes('type')).toBe('text')
        expect(href.attributes('inputmode')).toBe('url')
        expect(wrapper.get('#b1-cta-href-count').text()).toBe('0 of 2048')
    })

    it('(AC1) inputs carry no maxlength', () => {
        const { wrapper } = open()
        const fields = wrapper.findAll('input[type="text"], input[type="url"], textarea')
        expect(fields).toHaveLength(6)
        expect(fields.every((f) => !f.attributes('maxlength'))).toBe(true)
    })

    it('(AC1) the image and button fields are hidden until their checkbox is checked', async () => {
        const { wrapper } = open()
        expect(wrapper.get('#b1-image-fields').attributes('hidden')).toBeDefined()
        expect(wrapper.get('#b1-cta-fields').attributes('hidden')).toBeDefined()
        await wrapper.get('input[aria-controls="b1-image-fields"]').setValue(true)
        expect(wrapper.get('#b1-image-fields').attributes('hidden')).toBeUndefined()
    })
})

describe('hero form: working copy', () => {
    it('(AC2) each control sets its path: title, subtitle, image.url/alt, cta.label/href', async () => {
        const { wrapper, block } = open()
        await wrapper.get('#b1-title').setValue('Hello')
        await wrapper.get('#b1-subtitle').setValue('World')
        await wrapper.get('input[aria-controls="b1-image-fields"]').setValue(true)
        await wrapper.get('#b1-image-url').setValue('https://a.test/i.jpg')
        await wrapper.get('#b1-image-alt').setValue('A room')
        await wrapper.get('input[aria-controls="b1-cta-fields"]').setValue(true)
        await wrapper.get('#b1-cta-label').setValue('Visit')
        await wrapper.get('#b1-cta-href').setValue('/about')

        expect(sent(block)).toEqual({
            title: 'Hello',
            subtitle: 'World',
            image: { url: 'https://a.test/i.jpg', alt: 'A room' },
            cta: { label: 'Visit', href: '/about' },
        })
    })

    it('(AC2) unchecking keeps the typed values; checking again restores them; unchecked sends null', async () => {
        const { wrapper, block } = open()
        const box = wrapper.get('input[aria-controls="b1-image-fields"]')
        await box.setValue(true)
        await wrapper.get('#b1-image-url').setValue('https://a.test/i.jpg')
        await box.setValue(false)
        expect(sent(block)['image']).toBeNull()

        await box.setValue(true)
        expect((wrapper.get('#b1-image-url').element as HTMLInputElement).value).toBe(
            'https://a.test/i.jpg',
        )
        expect(sent(block)['image']).toEqual({ url: 'https://a.test/i.jpg', alt: '' })
    })

    it('(AC3) the document to send holds text trimmed', async () => {
        const { wrapper, block } = open()
        await wrapper.get('#b1-title').setValue('  Hello  ')
        expect(sent(block)['title']).toBe('Hello')
    })

    it('(AC3) the counter counts code points after trimming', async () => {
        const { wrapper } = open()
        await wrapper.get('#b1-title').setValue(` ${'😀'.repeat(80)} `)
        expect(wrapper.get('#b1-title-count').text()).toBe('80 of 80')
        await wrapper.get('#b1-title').setValue('😀'.repeat(81))
        expect(wrapper.get('#b1-title-count').text()).toBe('81 of 80')
        expect(wrapper.get('#b1-title-count').classes()).toContain('hs-counter--over')
    })

    it('(AC9) checking an optional object and unchecking it again leaves it empty', async () => {
        const { wrapper, block } = open()
        const box = wrapper.get('input[aria-controls="b1-cta-fields"]')
        await box.setValue(true)
        await box.setValue(false)
        expect(sent(block)['cta']).toBeNull()
    })

    it('(AC2) emits edit with the path and blur with the path', async () => {
        const { wrapper } = open()
        await wrapper.get('#b1-image-alt').setValue('x')
        await wrapper.get('#b1-image-alt').trigger('blur')
        expect(wrapper.emitted('edit')).toContainEqual(['image.alt'])
        expect(wrapper.emitted('blur')).toContainEqual(['image.alt'])
    })
})

describe('hero form: accessibility', () => {
    it('(AC11) an error is tied to its input with aria-describedby and aria-invalid, and starts with "Error:"', () => {
        const { wrapper } = open(heroBlock(), { title: 'Enter a title.' })
        const title = wrapper.get('#b1-title')
        expect(title.attributes('aria-invalid')).toBe('true')
        expect(title.attributes('aria-describedby')).toBe(
            'b1-title-hint b1-title-count b1-title-error',
        )
        expect(wrapper.get('#b1-title-error').text()).toBe('Error: Enter a title.')
        expect(wrapper.get('#b1-subtitle').attributes('aria-invalid')).toBeUndefined()
    })

    it('(AC11) every field has a label for it, and the optional groups a legend', () => {
        const { wrapper } = open()
        for (const input of wrapper.findAll('input[type="text"], input[type="url"], textarea')) {
            expect(wrapper.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
        }
        expect(wrapper.findAll('fieldset > legend').map((l) => l.text())).toEqual([
            'Image',
            'Button',
        ])
    })

    it('(AC8) while sending every field is readonly', () => {
        const { wrapper } = open(heroBlock(), {}, true)
        const fields = wrapper.findAll('input[type="text"], input[type="url"], textarea')
        expect(fields.every((f) => f.attributes('readonly') !== undefined)).toBe(true)
        const boxes = wrapper.findAll('input[type="checkbox"]')
        expect(boxes.every((b) => b.attributes('aria-disabled') === 'true')).toBe(true)
    })

    it('(AC8) while sending a checkbox does not change', async () => {
        const { wrapper, block } = open(heroBlock(), {}, true)
        await wrapper.get('input[aria-controls="b1-image-fields"]').trigger('click')
        expect(sent(block)['image']).toBeNull()
    })
})

describe('radio group', () => {
    it('(AC11) is a fieldset with a legend and a word label per option', async () => {
        const wrapper = mount(RadioGroup, {
            props: {
                id: 'width',
                legend: 'Width',
                options: [
                    { value: 'content', label: 'Text width' },
                    { value: 'wide', label: 'Wide' },
                ],
                modelValue: 'content',
            },
        })
        expect(wrapper.get('fieldset > legend').text()).toBe('Width')
        expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['Text width', 'Wide'])
        await wrapper.findAll('input')[1]?.setValue(true)
        expect(wrapper.emitted('update:modelValue')).toEqual([['wide']])
    })
})
