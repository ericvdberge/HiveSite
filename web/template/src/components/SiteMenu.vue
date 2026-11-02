<script setup lang="ts">
import { inject } from 'vue'
import { shellKey } from '../context.ts'

const shell = inject(shellKey)
if (!shell) throw new Error('SiteMenu rendered without a shell')
</script>

<template>
    <nav class="hs-menu" :aria-label="shell.strings.mainMenu">
        <ul>
            <li v-for="page in shell.pages" :key="page.id">
                <a :href="shell.pageHref(page)" :aria-current="page === shell.current ? 'page' : undefined">{{ page.title }}</a>
            </li>
        </ul>
    </nav>
</template>
