<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppShell from './components/AppShell.vue'
</script>

<template>
    <AppShell>
        <RouterView v-slot="{ Component, route }">
            <!-- Keyed by path: a new screen fades in as one shape; the top bar and nav never move. -->
            <div :key="route.path" class="hs-screen">
                <component :is="Component" />
            </div>
        </RouterView>
    </AppShell>
</template>

<style>
.hs-screen {
    animation: hs-screen-in var(--hs-motion-duration-base) var(--hs-motion-easing-enter) both;
}

@keyframes hs-screen-in {
    from {
        opacity: 0;
        transform: translateY(var(--hs-motion-rise-distance));
    }
}
</style>
