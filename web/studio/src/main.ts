import { createApp } from 'vue'
// Self-hosted typefaces (@fontsource), only the weights the tokens use.
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/hanken-grotesk/latin-400.css'
import '@fontsource/hanken-grotesk/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.vue'
import { createStudioRouter } from './router'

const app = createApp(App)
app.use(createStudioRouter())
app.mount('#app')
