import { setup } from '@storybook/vue3-vite';
import { createRouter, createMemoryHistory } from 'vue-router';
import { kProvider } from 'konsta/vue';
import { watchEffect } from 'vue';
import '../src/tailwind.css';
import '../src/style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import './preview.css';
import { resetBookmarks } from '../stories/support/bookmarks.js';
import { resetStorage } from '../stories/support/storage.js';
import { DocsThemeContainer } from './DocsThemeContainer.js';

setup(app => app.use(createRouter({ history: createMemoryHistory(), routes: [
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
] })));

export default {
  tags: ['autodocs', 'draft'],
  initialGlobals: { theme: 'light' },
  globalTypes: {
    theme: { description: 'Application color mode', toolbar: { icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true } },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true, exclude: ['theme'] },
    a11y: { test: 'error' },
    options: { storySort: { order: ['Colors', 'MENUS', 'BUTTONS', 'BARS', 'CONTAINERS', 'FORM', 'EMBEDDABLES'] } },
    docs: { codePanel: true, container: DocsThemeContainer },
  },
  beforeEach() { resetBookmarks(); resetStorage(); document.documentElement.removeAttribute('data-storybook-ready'); },
  afterEach(context) { document.documentElement.setAttribute('data-storybook-ready', context.id); },
  decorators: [(story, context) => ({
    // Supply application context without adding a DOM element around the story.
    components: { story, kProvider },
    setup() {
      const dark = context.globals.theme === 'dark';
      watchEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.classList.toggle('light', !dark);
        document.body.classList.add('sb-preview', 'map-ui');
        document.documentElement.setAttribute('data-storybook-preview', 'ready');
      });
      return { dark };
    },
    template: '<k-provider theme="material" :dark="dark" :auto-theme-detection="false" :material-touch-ripple="false"><story /></k-provider>',
  })],
};
