import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import SubmitView from '../views/SubmitView.vue';
import BrowseView from '../views/BrowseView.vue';
import SubmissionDetailView from '../views/SubmissionDetailView.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
    meta: { title: 'Home | Improvement Map' }
  },
  {
    path: '/submit',
    name: 'Submit',
    component: SubmitView,
    meta: { title: 'Submit Suggestion | Improvement Map' }
  },
  {
    path: '/browse',
    name: 'Browse',
    component: BrowseView,
    meta: { title: 'Browse Suggestions | Improvement Map' }
  },
  {
    path: '/suggestion/:id',
    name: 'SubmissionDetail',
    component: SubmissionDetailView,
    meta: { title: 'View Suggestion | Improvement Map' }
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
