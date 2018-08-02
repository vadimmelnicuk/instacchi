// Lazy loading of the components to speed of the overall load time

export default [
  {
    path: '/',
    name: 'home',
    component: () => import('/imports/components/Home.vue')
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
    path: '/profile/:id',
    name: 'profile',
    component: () => import('/imports/components/accounts/Profile.vue')
  },
  {
    path: '/posts',
    name: 'posts',
    component: () => import('/imports/components/posts/Posts.vue')
  },
  {
    path: '/post/add',
    name: 'post-add',
    component: () => import('/imports/components/posts/PostAdd.vue')
  },
  {
    path: '/post/:id',
    name: 'post',
    component: () => import('/imports/components/posts/Post.vue')
  },
  {
    path: '*',
    component: () => import('/imports/components/NotFound.vue'),
  }
]