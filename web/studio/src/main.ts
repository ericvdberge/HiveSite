import { createApp } from 'vue'
import App from './App.vue'
import { createStudioRouter } from './router'

const app = createApp(App)
app.use(createStudioRouter())
app.mount('#app')
