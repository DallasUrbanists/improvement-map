import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';
import 'konsta/vue/theme.css';
import { initTheme } from './services/theme';

// Initialize theme immediately before mount
initTheme();

// Initialize PWA service worker registration if available
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('New content available, ready to reload.');
    },
    onOfflineReady() {
      console.log('App ready to work offline.');
    },
  });
}

const app = createApp(App);
app.use(router);
app.mount('#app');
