<script setup lang="ts">
import { RouterLink } from 'vue-router'

export interface SiteNavLink {
    label: string
    to: string
    /** Marks the item as the current page when the route is below it, not at it. */
    current?: boolean
}

// On a site screen the nav adds the site name (a group label, not a link) and its links.
defineProps<{ siteName?: string; siteLinks?: SiteNavLink[] }>()
</script>

<template>
    <nav class="hs-nav" aria-label="Studio">
        <ul>
            <li><RouterLink to="/">Sites</RouterLink></li>
            <template v-if="siteName">
                <li class="hs-nav__site hs-label">{{ siteName }}</li>
                <li v-for="link in siteLinks ?? []" :key="link.to">
                    <RouterLink :to="link.to" :aria-current="link.current ? 'page' : undefined">{{
                        link.label
                    }}</RouterLink>
                </li>
            </template>
        </ul>
    </nav>
</template>

<style scoped>
.hs-nav {
    border-block-end: var(--hs-border-width-hairline) solid var(--hs-color-border);
    padding-inline: var(--hs-layout-gutter);
}

ul {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
}

a {
    display: flex;
    align-items: center;
    min-block-size: var(--hs-control-min-height);
    padding-inline: var(--hs-space-3);
    color: var(--hs-color-text-muted);
    font-size: var(--hs-font-size-body-s);
    text-decoration: none;
    border-block-end: var(--hs-border-width-focus) solid transparent;
    transition:
        color var(--hs-motion-duration-base) var(--hs-motion-easing-standard),
        border-color var(--hs-motion-duration-base) var(--hs-motion-easing-standard);
}

a:hover {
    color: var(--hs-color-text);
}

/* The weight change means the current item is not marked by color alone. */
a[aria-current='page'] {
    color: var(--hs-color-text);
    font-weight: var(--hs-font-weight-text-strong);
    border-block-end-color: var(--hs-color-accent);
}

.hs-nav__site {
    padding-inline: var(--hs-space-3);
    color: var(--hs-color-text-muted);
    overflow-wrap: anywhere;
}

@media (width >= breakpoint(md)) {
    .hs-nav {
        margin-block-start: var(--hs-space-7);
        padding-inline: var(--hs-layout-gutter) 0;
        border-block-end: 0;
    }

    ul {
        flex-direction: column;
        align-items: stretch;
    }

    a {
        border-block-end: 0;
        border-inline-start: var(--hs-border-width-focus) solid transparent;
    }

    a[aria-current='page'] {
        border-inline-start-color: var(--hs-color-accent);
    }

    .hs-nav__site {
        margin-block-start: var(--hs-space-5);
    }
}
</style>
