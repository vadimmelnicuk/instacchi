// Lazy loading of the components to speed of the overall load time

export default [
  {
    path: '/',
    name: 'home',
    component: () => import('/imports/components/Home.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('/imports/components/Dashboard.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('/imports/components/About.vue')
  },
  {
    path: '/profile/:id',
    name: 'profile',
    component: () => import('/imports/components/accounts/Profile.vue')
  },
  {
    path: '/admin-panel',
    name: 'admin-panel',
    component: () => import('/imports/components/AdminPanel.vue')
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('/imports/components/accounts/SignUp.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('/imports/components/accounts/Login.vue')
  },
  {
    path: '*',
    name: 'not-found',
    component: () => import('/imports/components/NotFound.vue'),
  }
]