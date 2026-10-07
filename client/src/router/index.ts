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
      path: '/listeners',
      name: 'ListenerIndex',
      component: () => import('../views/ListenersIndex.vue'),
    },
    {
      path: '/listeners/new',
      name: 'ListenerNew',
      component: () => import('../views/NewSettingsView.vue'),
      props: { resource: 'listeners' },
    },
    {
      path: '/listeners/:id',
      name: 'ListenerView',
      component: () => import('../views/ListenerView.vue'),
    },
    {
      path: '/controllers/new',
      name: 'ControllerNew',
      component: () => import('../views/NewSettingsView.vue'),
      props: { resource: 'controllers' },
    },
    {
      path: '/controllers/:id',
      name: 'ControllerSettingsView',
      component: () => import('../views/ControllerSettingsView.vue'),
    },
    {
      path: '/connect',
      name: 'ConnectView',
      component: () => import('../views/ConnectView.vue'),
      meta: { public: true },
    },
    {
      path: '/remote/:id',
      name: 'RemoteControlView',
      component: () => import('../views/RemoteControlView.vue'),
    }
  ],
});

export default router;
