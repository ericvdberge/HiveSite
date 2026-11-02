<script setup lang="ts">
import { Hero, type BlockNode } from '@hivesite/blocks'
import type { SnapshotPage } from '../request.ts'

const props = defineProps<{ page: SnapshotPage }>()

const components = { hero: Hero }
const nodes = (props.page.blocks.content ?? []) as unknown as BlockNode[]
for (const node of nodes) {
    if (!(node.type in components)) throw new Error(`Unknown block type "${node.type}" on page "${props.page.slug}"`)
}
</script>

<template>
    <h1 v-if="nodes[0]?.type !== 'hero'" class="hs-page-title">{{ page.title }}</h1>
    <component :is="components[node.type]" v-for="(node, i) in nodes" :key="i" :node="node" :index="i" />
</template>
