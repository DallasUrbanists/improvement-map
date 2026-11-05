import { createRouter, createWebHistory } from 'vue-router';
import SubmitView from '../views/SubmitView.vue';
import BrowseView from '../views/BrowseView.vue';
import SubmissionDetailView from '../views/SubmissionDetailView.vue';

const routes = [
  { path: '/bookmarks', name: 'Bookmarks', component: () => import('../views/BookmarksView.vue'), meta: { title: 'Saved ideas | Improvement Map' } },
  { path: '/my-actions', name: 'MyActions', component: () => import('../views/MyActionsView.vue'), meta: { title: 'Saved actions | Improvement Map' } },
  {
    path: '/',
    alias: ['/browse'],
    name: 'Browse',
    component: BrowseView,
    meta: { title: 'Browse ideas | Improvement Map' }
  },
  {
    path: '/submit',
    name: 'Submit',
    component: SubmitView,
    meta: { title: 'Submit idea | Improvement Map' }
  },
  {
    path: '/suggestion/:id',
    name: 'SubmissionDetail',
    component: SubmissionDetailView,
    meta: { title: 'View idea | Improvement Map' }
  },
  {
    path: '/test',
    name: 'TestDiagram',
    component: () => import('../views/TestDiagramView.vue'),
    meta: { title: 'Location Diagram Test | Improvement Map' }
  },
  {
    path: '/tv',
    name: 'PresentationTV',
    component: () => import('../views/PresentationTVView.vue'),
    meta: { title: 'TV presentation | Improvement Map', shell: 'presentation' },
  },
  {
    path: '/remote',
    component: () => import('../views/PresentationRemoteShell.vue'),
    meta: { title: 'Presenter remote | Improvement Map', shell: 'presentation' },
    children: [
      { path: '', name: 'RemoteController', component: () => import('../views/PresentationRemoteController.vue'), meta: { title: 'Presenter remote | Improvement Map' } },
      { path: 'ideas', name: 'RemoteIdeas', component: () => import('../views/PresentationRemoteIdeas.vue'), meta: { title: 'Find ideas | Presenter remote' } },
      { path: 'styles', name: 'RemoteStyles', component: () => import('../views/PresentationRemoteStyles.vue'), meta: { title: 'Style settings | Presenter remote' } },
      { path: 'audience', name: 'RemoteAudience', component: () => import('../views/PresentationRemoteAudience.vue'), meta: { title: 'Audience | Presenter remote' } },
    ],
  },
  {
    path: '/audience',
    name: 'PresentationAudience',
    component: () => import('../views/PresentationAudienceView.vue'),
    meta: { title: 'Audience presentation | Improvement Map', shell: 'presentation' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title;
  }
});

export default router;
