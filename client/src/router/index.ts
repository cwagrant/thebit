import { createRouter, createWebHistory } from 'vue-router';
import ControllerView from '@/views/ControllerView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: ControllerView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/listeners',
      name: 'ListenerIndex',
      component: () => import('../views/ListenersIndex.vue'),
    },
    {
      path: '/listeners/new',
      name: 'ListenerNew',
      component: () => import('../views/NewListenerView.vue'),
    },
    {
      path: '/listeners/:id',
      name: 'ListenerView',
      component: () => import('../views/ListenerView.vue'),
    }
  ],
});

export default router;
