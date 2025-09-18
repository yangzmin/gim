import axios from 'axios'
import { getToken } from '@/utils/storage'

// 创建axios实例
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '' : '/api',
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = token
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    if (error.response?.status === 401) {
      // token失效，清除本地存储并跳转到登录页
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 认证API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me')
}

// 好友API
export const friendAPI = {
  getFriendList: () => api.get('/friend/list'),
  addFriend: (friendID) => api.post('/friend/add', { friendID }),
  deleteFriend: (friendID) => api.delete(`/friend/${friendID}`)
}

// 消息API
export const messageAPI = {
  getChatHistory: (params) => api.get('/message/history', { params }),
  sendMessage: (data) => api.post('/message/send', data),
  markAsRead: (data) => api.put('/message/read', data),
  getUnreadCount: () => api.get('/message/unread')
}

// 用户API (兼容原有接口)
export const userAPI = {
  getList: (params) => api.get('/user/list', { params }),
  getOnlineStatus: (params) => api.get('/user/online', { params }),
  sendMessage: (data) => api.post('/user/sendMessage', data),
  sendMessageAll: (data) => api.post('/user/sendMessageAll', data)
}

export default api