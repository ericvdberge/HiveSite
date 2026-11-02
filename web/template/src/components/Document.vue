<script setup lang="ts">
import { computed, provide } from 'vue'
import { blockContextKey } from '@hivesite/blocks'
import { shellKey, type ShellContext } from '../context.ts'
import BlockList from './BlockList.vue'
import NotFound from './NotFound.vue'
import SiteFooter from './SiteFooter.vue'
import SiteHeader from './SiteHeader.vue'

const props = defineProps<{ shell: ShellContext }>()
provide(blockContextKey, props.shell)
provide(shellKey, props.shell)

const { site, current, strings, notFound } = props.shell
const title = computed(() => {
    const head = notFound ? strings.notFoundTitle : current && current !== props.shell.pages[0] ? current.title : null
    return head === null ? site.name : `${head} · ${site.name}`
})
</script>

<template>
    <html :lang="site.settings.language" :data-theme="site.settings.theme">
        <head>
            <meta charset="utf-8" />
            <base v-if="notFound" :href="`/s/${site.slug}/`" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta v-if="shell.mode === 'preview'" name="robots" content="noindex" />
            <meta name="generator" content="Hivesite" />
            <meta name="color-scheme" :content="shell.colorScheme" />
            <title>{{ title }}</title>
            <meta v-if="site.settings.description !== ''" name="description" :content="site.settings.description" />
            <link rel="stylesheet" :href="shell.stylesheet" />
        </head>
        <body>
            <a class="hs-skip" href="#hs-main">{{ strings.skipLink }}</a>
            <p v-if="shell.mode === 'preview'" class="hs-preview-label">{{ strings.previewLabel }}</p>
            <SiteHeader />
            <main class="hs-main" id="hs-main">
                <NotFound v-if="notFound" />
                <BlockList v-else-if="current" :page="current" />
            </main>
            <SiteFooter />
        </body>
    </html>
</template>
