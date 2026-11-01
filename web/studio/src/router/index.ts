import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NotFoundView from '../views/NotFoundView.vue'

export const routes = [
    { path: '/', name: 'home', component: HomeView },
    // Catch-all: any address the studio does not know shows the not-found screen.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

export function createStudioRouter(history: RouterHistory = createWebHistory()) {
    return createRouter({ history, routes })
}
