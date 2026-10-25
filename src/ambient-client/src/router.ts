import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/control' },
  {
    path: '/control',
    name: 'control',
    component: () => import('@/views/ControlView.vue'),
  },
  {
    path: '/display',
    name: 'display',
    component: () => import('@/views/DisplayView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
