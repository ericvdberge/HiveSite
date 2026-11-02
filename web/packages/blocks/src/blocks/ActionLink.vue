<script setup lang="ts">
import { computed } from 'vue'
import { useBlockContext } from '../context.ts'
import type { ActionAttr } from '../types.ts'

const props = defineProps<{ action: ActionAttr }>()
const { resolveLink } = useBlockContext()
const link = computed(() => resolveLink(props.action.href))
</script>

<template>
    <span v-if="link.missing" class="hs-link-missing">{{ action.label }}</span>
    <a v-else class="hs-button" :href="link.href">{{ action.label }}</a>
</template>
