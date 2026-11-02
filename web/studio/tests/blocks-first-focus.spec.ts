import { describe, expect, it } from 'vitest'
import { firstFocusId } from '../src/blocks/registry'

describe('first focus after add', () => {
    it('(AC4) a type with a form focuses its first field', () => {
        expect(firstFocusId('n1', 'hero')).toBe('n1-title')
    })

    it('(AC4) a type without a form falls back to the panel heading', () => {
        expect(firstFocusId('n1', 'gallery')).toBe('n1-name')
        expect(firstFocusId('n1', 'image')).toBe('n1-name')
    })
})
