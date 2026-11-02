import { readonly, ref } from 'vue'
import type { SiteNavLink } from '../components/StudioNav.vue'

// The site a site screen is showing. The screen sets it after load and clears it on leave;
// App.vue feeds it to the side nav (shell.md, Navigation).
export interface SiteNav {
    id: string
    name: string
    /** The nav item to mark as current when the screen is under it but not at its address. */
    section?: 'pages'
}

const current = ref<SiteNav | null>(null)

export function setSiteNav(site: SiteNav): void {
    current.value = site
}

export function clearSiteNav(): void {
    current.value = null
}

export function siteNavLinks(id: string, section?: SiteNav['section']): SiteNavLink[] {
    return [
        {
            label: 'Pages',
            to: `/sites/${id}/pages`,
            ...(section === 'pages' ? { current: true } : {}),
        },
        { label: 'Site settings', to: `/sites/${id}/edit` },
    ]
}

export function useSiteNav() {
    return { current: readonly(current) }
}
