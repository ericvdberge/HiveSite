<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ErrorToast from './ErrorToast.vue'
import StudioNav from './StudioNav.vue'
import { useToast } from '../composables/useToast'

const { message, dismissToast } = useToast()
</script>

<template>
    <a class="hs-skip" href="#main">Skip to content</a>
    <header class="hs-topbar">
        <RouterLink class="hs-topbar__mark" to="/">
            Hivesite <span class="hs-topbar__studio hs-label">Studio</span>
        </RouterLink>
        <div class="hs-topbar__account"><slot name="account" /></div>
    </header>
    <div class="hs-frame">
        <slot name="nav"><StudioNav /></slot>
        <main id="main" class="hs-content" tabindex="-1">
            <slot />
        </main>
    </div>
    <ErrorToast :message="message" @dismiss="dismissToast" />
</template>

<style scoped>
.hs-skip {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    padding: var(--hs-space-3);
    background: var(--hs-color-surface);
    color: var(--hs-color-text);
    transform: translateY(-100%);
}

.hs-skip:focus {
    transform: none;
}

.hs-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: var(--hs-space-3);
    padding-inline: var(--hs-layout-gutter);
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
}

.hs-topbar__mark {
    display: inline-flex;
    align-items: center;
    gap: var(--hs-space-2);
    min-block-size: var(--hs-control-min-height);
    color: var(--hs-color-text);
    font-family: var(--hs-font-display);
    font-size: var(--hs-font-size-display-m);
    font-weight: var(--hs-font-weight-display);
    text-decoration: none;
}

.hs-topbar__studio {
    color: var(--hs-color-accent-text);
}

.hs-frame {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
}

.hs-content {
    min-inline-size: 0;
    max-inline-size: var(--hs-layout-wide-width);
    padding-inline: var(--hs-layout-gutter);
    padding-block: var(--hs-space-6);
}

@media (width >= breakpoint(sm)) {
    .hs-content {
        padding-block: var(--hs-space-7);
    }
}

@media (width >= breakpoint(md)) {
    .hs-frame {
        grid-template-columns: var(--hs-layout-nav-width) minmax(0, 1fr);
        column-gap: var(--hs-space-7);
    }
}
</style>
