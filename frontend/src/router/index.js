import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'
import LoginPage from '@/views/LoginPage.vue'
import ChatRoom from '@/views/ChatRoom.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    redirect: '/chat'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { 
      title: '登录',
      requiresAuth: false 
    }
  },
  {
    path: '/chat',
    name: 'ChatRoom',
    component: ChatRoom,
    meta: { 
      title: '聊天室',
      requiresAuth: true 
    }
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - GoWebSocket IM`
  }

  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    if (store.getters['auth/isLoggedIn']) {
      next()
    } else {
      next({
        name: 'Login',
        query: { redirect: to.fullPath }
      })
    }
  } else {
    // 如果已登录且访问登录页，重定向到聊天室
    if (to.name === 'Login' && store.getters['auth/isLoggedIn']) {
      next({ name: 'ChatRoom' })
    } else {
      next()
    }
  }
})

export default router