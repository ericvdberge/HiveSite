<script setup lang="ts">
import { inject } from 'vue'
import { shellKey } from '../context.ts'

const shell = inject(shellKey)
if (!shell) throw new Error('SiteFooter rendered without a shell')
</script>

<template>
    <footer class="hs-footer">
        <p class="hs-footer__name">{{ shell.site.name }}</p>
    </footer>
</template>
