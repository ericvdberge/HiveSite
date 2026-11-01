import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import NewSiteView from '../views/NewSiteView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import PageFormView from '../views/PageFormView.vue'
import SiteListView from '../views/SiteListView.vue'

export const routes = [
    // The site list is the first screen. "/" is an alias, not a redirect, so the shell's
    // links to "/" (wordmark, "Sites") stay the current page while the list is open.
    { path: '/sites', alias: '/', name: 'sites', component: SiteListView },
    // Placeholder until the create form (#61).
    { path: '/sites/new', name: 'site-new', component: NewSiteView },
    { path: '/sites/:id/pages/new', name: 'page-new', component: PageFormView },
    { path: '/pages/:id/edit', name: 'page-edit', component: PageFormView },
    // Catch-all: any address the studio does not know shows the not-found screen.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

export function createStudioRouter(history: RouterHistory = createWebHistory()) {
    return createRouter({ history, routes })
}
