import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

export const routes = [{ path: '/', name: 'home', component: HomeView }]

export function createStudioRouter(history: RouterHistory = createWebHistory()) {
    return createRouter({ history, routes })
}
