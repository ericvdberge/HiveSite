/** Typed Tiptap block nodes of API-003. Only the block types that have a component are listed. */
export interface ImageAttr {
    url: string
    alt: string
}
export interface ActionAttr {
    label: string
    href: string
}
export interface HeroNode {
    type: 'hero'
    attrs: {
        title: string
        subtitle: string
        image: ImageAttr | null
        cta: ActionAttr | null
    }
}
export type BlockNode = HeroNode
