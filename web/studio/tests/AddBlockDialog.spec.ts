import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AddBlockDialog from '../src/components/AddBlockDialog.vue'

const TYPES = [
    { type: 'hero', name: 'Hero', description: 'An opening section.' },
    { type: 'rich_text', name: 'Rich text', description: 'Headings and paragraphs.' },
    { type: 'image', name: 'Image', description: 'One picture.' },
]

function open(props: Partial<{ blockNames: string[]; hasHero: boolean }> = {}) {
    return mount(AddBlockDialog, {
        props: { types: TYPES, blockNames: ['Hero', 'Rich text'], hasHero: true, ...props },
        attachTo: document.body,
    })
}

const checked = (w: ReturnType<typeof open>) =>
    (w.get('input[type="radio"]:checked').element as HTMLInputElement).value

describe('AddBlockDialog', () => {
    it('(AC1) is titled "Add a block" with a radio group of the offered types, each with name and description', () => {
        const w = open()
        expect(w.get('h2').text()).toBe('Add a block')
        expect(w.get('dialog').attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'))
        const rows = w.findAll('.hs-choice')
        expect(rows.map((r) => r.get('.hs-choice__name').text())).toEqual([
            'Hero',
            'Rich text',
            'Image',
        ])
        expect(rows[1]?.get('.hs-choice__desc').text()).toBe('Headings and paragraphs.')
        expect(w.get('legend').text()).toBe('Block type')
    })

    it('(AC1) checks Hero when the page has no hero, otherwise Rich text, and focuses the checked radio', () => {
        expect(checked(open({ hasHero: false }))).toBe('hero')
        const w = open({ hasHero: true })
        expect(checked(w)).toBe('rich_text')
        expect(document.activeElement).toBe(w.get('input[type="radio"]:checked').element)
    })

    it('(AC1) checks the first offered type when Rich text is not offered', () => {
        const w = open({ hasHero: true })
        expect(w.unmount()).toBeUndefined()
        const only = mount(AddBlockDialog, {
            props: {
                types: [TYPES[2] as (typeof TYPES)[number]],
                blockNames: ['Hero'],
                hasHero: true,
            },
        })
        expect((only.get('input:checked').element as HTMLInputElement).value).toBe('image')
    })

    it('(AC2) Place lists the end, the start and each block, and defaults to "At the end"', () => {
        const w = open()
        const select = w.get('select')
        expect(w.get('label[for="add-place"]').text()).toBe('Place')
        expect(select.findAll('option').map((o) => o.text())).toEqual([
            'At the end',
            'At the start',
            'After 1. Hero',
            'After 2. Rich text',
        ])
        expect((select.element as HTMLSelectElement).value).toBe('end')
    })

    it('(AC2) Place is not shown from the empty state', () => {
        const w = open({ blockNames: [], hasHero: false })
        expect(w.find('select').exists()).toBe(false)
    })

    it('(AC2) confirming sends the type and the list index of the chosen place', async () => {
        const w = open()
        await w.get('select').setValue('after:1')
        await w.get('input[value="image"]').setValue(true)
        await w.get('form').trigger('submit')
        expect(w.emitted('confirm')).toEqual([['image', 1]])

        await w.get('select').setValue('start')
        await w.get('form').trigger('submit')
        expect(w.emitted('confirm')?.[1]).toEqual(['image', 0])

        await w.get('select').setValue('end')
        await w.get('form').trigger('submit')
        expect(w.emitted('confirm')?.[2]).toEqual(['image', 2])
    })

    it('(AC3) shows the Note when Hero is chosen and the page already has a hero', async () => {
        const w = open({ hasHero: true })
        expect(w.find('.hs-note').exists()).toBe(false)
        await w.get('input[value="hero"]').setValue(true)
        expect(w.get('.hs-note').text()).toBe(
            "Note: This page already has a hero. Only the first hero's title becomes the page heading.",
        )
        // Adding is still allowed.
        await w.get('form').trigger('submit')
        expect(w.emitted('confirm')).toEqual([['hero', 2]])
    })

    it('(AC3) shows no Note when the page has no hero', () => {
        expect(open({ hasHero: false }).find('.hs-note').exists()).toBe(false)
    })

    it('(AC10) Escape and Cancel close it, with Cancel before the primary action', async () => {
        const w = open()
        const buttons = w.findAll('.hs-dialog__actions button')
        expect(buttons.map((b) => b.text())).toEqual(['Cancel', 'Add block'])
        await w.get('dialog').trigger('keydown', { key: 'Escape' })
        await buttons[0]?.trigger('click')
        expect(w.emitted('cancel')).toHaveLength(2)
    })
})
