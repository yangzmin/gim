import { authAPI } from '@/services/api'
import { setToken, removeToken } from '@/utils/storage'

const auth = {
  namespaced: true,
  state: {
    token: localStorage.getItem('gowebsocket_token') || null,
    isAuthenticated: !!localStorage.getItem('gowebsocket_token'),
    loginLoading: false,
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null')
  },
  mutations: {
    SET_TOKEN(state, token) {
      state.token = token
      state.isAuthenticated = !!token
      if (token) {
        setToken(token)
      } else {
        removeToken()
      }
    },
    SET_LOGIN_LOADING(state, loading) {
      state.loginLoading = loading
    },
    SET_USER_INFO(state, userInfo) {
      state.userInfo = userInfo
      if (userInfo) {
        localStorage.setItem('userInfo', JSON.stringify(userInfo))
      } else {
        localStorage.removeItem('userInfo')
      }
    },
    CLEAR_AUTH(state) {
      state.token = null
      state.isAuthenticated = false
      state.userInfo = null
      removeToken()
      localStorage.removeItem('userInfo')
    }
  },
  actions: {
    async login({ commit }, { userID, appID = 'app_default_001' }) {
      commit('SET_LOGIN_LOADING', true)
      try {
        const response = await authAPI.login({ userID, appID })
        if (response.data.code === 200) {
          const { token, user } = response.data.data
          commit('SET_TOKEN', token)
          commit('SET_USER_INFO', user)
          return { success: true, user, isNewUser: user.isNewUser }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('登录失败:', error)
        return { success: false, error: error.message || '登录失败' }
      } finally {
        commit('SET_LOGIN_LOADING', false)
      }
    },
    async logout({ commit }) {
      try {
        await authAPI.logout()
      } catch (error) {
        console.error('登出失败:', error)
      } finally {
        commit('CLEAR_AUTH')
        // 清理其他模块状态
        commit('user/CLEAR_USER_INFO', null, { root: true })
        commit('friend/CLEAR_FRIENDS', null, { root: true })
        commit('chat/CLEAR_CONVERSATIONS', null, { root: true })
        commit('connection/SET_CONNECTION_STATUS', 'disconnected', { root: true })
      }
    },
    async getCurrentUser({ commit, state }) {
      if (!state.token) {
        return { success: false, error: '未登录' }
      }
      try {
        const response = await authAPI.getCurrentUser()
        if (response.data.code === 200) {
          commit('SET_USER_INFO', response.data.data.user)
          return { success: true, user: response.data.data.user }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
        return { success: false, error: error.message || '获取用户信息失败' }
      }
    }
  },
  getters: {
    isLoggedIn: state => state.isAuthenticated && state.token,
    currentUser: state => state.userInfo
  }
}

export default auth