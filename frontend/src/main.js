import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import './styles/global.scss'
import webSocketService from '@/services/websocket'
import { WS_URL } from '@/utils/constants'

Vue.use(ElementUI)

// 将WebSocket服务注入到Vue原型中，使所有组件都能通过this.$websocket访问
Vue.prototype.$websocket = webSocketService

Vue.config.productionTip = false

/**
 * 初始化应用并检查自动登录
 * 只负责验证token有效性，不进行WebSocket连接
 */
async function initApp() {
  // 检查本地是否有token缓存
  const token = localStorage.getItem('gowebsocket_token')
  
  if (token) {
    try {
      console.log('检测到本地token，设置到store中')
      
      // 设置store中的token状态
      store.commit('auth/SET_TOKEN', token)
      
      console.log('token已设置到store，WebSocket连接将由具体页面组件负责')
      
    } catch (error) {
      console.error('初始化token失败:', error)
      // 如果token处理失败，清理无效的token
      console.log('清理无效的token缓存')
      localStorage.removeItem('gowebsocket_token')
      localStorage.removeItem('userInfo')
      store.dispatch('auth/logout')
    }
  } else {
    console.log('未检测到本地token，需要用户手动登录')
  }
}

new Vue({
  router,
  store,
  render: h => h(App),
  async created() {
    // 应用创建时只初始化登录状态，不连接WebSocket
    await initApp()
  }
}).$mount('#app')