import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import NotFoundView from '../views/NotFoundView.vue'
import PageListView from '../views/PageListView.vue'
import SiteFormView from '../views/SiteFormView.vue'
import SiteListView from '../views/SiteListView.vue'

export const routes = [
    // The site list is the first screen. "/" is an alias, not a redirect, so the shell's
    // links to "/" (wordmark, "Sites") stay the current page while the list is open.
    { path: '/sites', alias: '/', name: 'sites', component: SiteListView },
    // One form for create (#61) and edit (#62); the edit route carries the site id.
    { path: '/sites/new', name: 'site-new', component: SiteFormView },
    { path: '/sites/:id/edit', name: 'site-edit', component: SiteFormView },
    { path: '/sites/:id/pages', name: 'site-pages', component: PageListView },
    // Catch-all: any address the studio does not know shows the not-found screen.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

export function createStudioRouter(history: RouterHistory = createWebHistory()) {
    return createRouter({ history, routes })
}
