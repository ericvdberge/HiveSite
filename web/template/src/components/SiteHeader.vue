<script setup lang="ts">
import { inject } from 'vue'
import { shellKey } from '../context.ts'
import SiteMenu from './SiteMenu.vue'

const shell = inject(shellKey)
if (!shell) throw new Error('SiteHeader rendered without a shell')
</script>

<template>
    <header class="hs-header">
        <a class="hs-header__name" :href="shell.homeHref">{{ shell.site.name }}</a>
        <SiteMenu />
    </header>
</template>
