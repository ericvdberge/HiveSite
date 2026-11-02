<script setup lang="ts">
import type { HeroNode } from '../types.ts'
import ActionLink from './ActionLink.vue'

defineProps<{ node: HeroNode; index: number }>()
</script>

<template>
    <section class="hs-hero" :id="`hs-b${index}`" :data-variant="node.attrs.image ? 'image' : 'text'">
        <img
            v-if="node.attrs.image"
            class="hs-hero__image"
            :src="node.attrs.image.url"
            :alt="node.attrs.image.alt"
            loading="eager"
            decoding="async"
        />
        <div class="hs-hero__body">
            <h1 v-if="index === 0" class="hs-hero__title">{{ node.attrs.title }}</h1>
            <h2 v-else class="hs-hero__title">{{ node.attrs.title }}</h2>
            <p v-if="node.attrs.subtitle !== ''" class="hs-hero__subtitle">{{ node.attrs.subtitle }}</p>
            <ActionLink v-if="node.attrs.cta" :action="node.attrs.cta" />
        </div>
    </section>
</template>
