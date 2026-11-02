<script setup lang="ts">
import { inject } from 'vue'
import { shellKey } from '../context.ts'

const shell = inject(shellKey)
if (!shell) throw new Error('NotFound rendered without a shell')
</script>

<template>
    <h1 class="hs-page-title">{{ shell.strings.notFoundTitle }}</h1>
    <p>{{ shell.strings.notFoundText }}</p>
    <a class="hs-back" :href="shell.homeHref">{{ shell.strings.backHome }}</a>
</template>
