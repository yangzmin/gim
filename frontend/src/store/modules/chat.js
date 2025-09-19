import { messageAPI } from '@/services/api'

const chat = {
  namespaced: true,
  state: {
    conversations: {}, // 按friendID组织的对话记录
    currentConversation: null,
    loadingHistory: false,
    sendingMessage: false
  },
  mutations: {
    SET_CONVERSATION(state, { friendID, messages }) {
      state.conversations[friendID] = messages
    },
    ADD_MESSAGE(state, { friendID, message }) {
      if (!state.conversations[friendID]) {
        state.conversations[friendID] = []
      }
      // 检查消息是否已存在（避免重复）
      const exists = state.conversations[friendID].find(m => m.messageID === message.messageID)
      if (!exists) {
        state.conversations[friendID].push(message)
      }
    },
    PREPEND_MESSAGES(state, { friendID, messages }) {
      if (!state.conversations[friendID]) {
        state.conversations[friendID] = []
      }
      // 将历史消息添加到对话开头
      state.conversations[friendID] = [...messages, ...state.conversations[friendID]]
    },
    SET_CURRENT_CONVERSATION(state, friendID) {
      state.currentConversation = friendID
    },
    SET_LOADING_HISTORY(state, loading) {
      state.loadingHistory = loading
    },
    SET_SENDING_MESSAGE(state, sending) {
      state.sendingMessage = sending
    },
    CLEAR_CONVERSATIONS(state) {
      state.conversations = {}
      state.currentConversation = null
    },
    CLEAR_CONVERSATION(state, friendID) {
      if (state.conversations[friendID]) {
        delete state.conversations[friendID]
      }
    }
  },
  actions: {
    async loadChatHistory({ commit, state }, { friendID, page = 1, limit = 20 }) {
      commit('SET_LOADING_HISTORY', true)
      try {
        const response = await messageAPI.getChatHistory({ friendID, page, limit })
        if (response.data.code === 200) {
          const { messages, hasMore } = response.data.data
          if (page === 1) {
            // 第一页，直接设置对话
            commit('SET_CONVERSATION', { friendID, messages })
          } else {
            // 后续页，添加到对话开头
            commit('PREPEND_MESSAGES', { friendID, messages })
          }
          return { success: true, messages, hasMore }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('加载聊天记录失败:', error)
        return { success: false, error: error.message || '加载聊天记录失败' }
      } finally {
        commit('SET_LOADING_HISTORY', false)
      }
    },
    async sendMessage({ commit, dispatch }, { friendID, content, messageType = 'text' }) {
      commit('SET_SENDING_MESSAGE', true)
      try {
        const response = await messageAPI.sendMessage({ friendID, content, messageType })
        if (response.data.code === 200) {
          const message = response.data.data.message
          commit('ADD_MESSAGE', { friendID, message })
          // 更新好友未读计数（对方的）
          dispatch('friend/updateFriendUnreadCount', { userID: friendID, unreadCount: 0 }, { root: true })
          return { success: true, message }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('发送消息失败:', error)
        return { success: false, error: error.message || '发送消息失败' }
      } finally {
        commit('SET_SENDING_MESSAGE', false)
      }
    },
    /**
     * 发送音频消息
     * @param {Object} context - Vuex context
     * @param {Object} payload - 消息数据
     * @param {string} payload.friendID - 好友ID
     * @param {string} payload.audioData - 音频数据（base64）
     * @param {number} payload.duration - 音频时长（秒）
     * @param {string} payload.format - 音频格式
     */
    async sendAudioMessage({ commit, dispatch }, { friendID, audioData, duration, format = 'webm' }) {
      commit('SET_SENDING_MESSAGE', true)
      try {
        // 构造音频消息内容
        const content = JSON.stringify({
          audioData,
          duration,
          format
        })
        
        const response = await messageAPI.sendMessage({ 
          friendID, 
          content, 
          messageType: 'audio' 
        })
        
        if (response.data.code === 200) {
          const message = response.data.data.message
          commit('ADD_MESSAGE', { friendID, message })
          // 更新好友未读计数（对方的）
          dispatch('friend/updateFriendUnreadCount', { userID: friendID, unreadCount: 0 }, { root: true })
          return { success: true, message }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('发送音频消息失败:', error)
        return { success: false, error: error.message || '发送音频消息失败' }
      } finally {
        commit('SET_SENDING_MESSAGE', false)
      }
    },
    async markAsRead({ commit }, friendID) {
      try {
        const response = await messageAPI.markAsRead({ friendID })
        if (response.data.code === 200) {
          // 清除本地未读计数
          commit('friend/UPDATE_FRIEND_UNREAD', { userID: friendID, unreadCount: 0 }, { root: true })
          return { success: true }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('标记已读失败:', error)
        return { success: false, error: error.message || '标记已读失败' }
      }
    },
    // 通过WebSocket接收到新消息时调用
    receiveMessage({ commit }, { fromUserID, message }) {
      commit('ADD_MESSAGE', { friendID: fromUserID, message })
      // 更新未读计数
      commit('friend/UPDATE_FRIEND_UNREAD', { 
        userID: fromUserID, 
        unreadCount: (this.getters['friend/getFriendByID'](fromUserID)?.unreadCount || 0) + 1 
      }, { root: true })
    },
    switchConversation({ commit, dispatch }, friendID) {
      commit('SET_CURRENT_CONVERSATION', friendID)
      // 标记消息为已读
      dispatch('markAsRead', friendID)
    }
  },
  getters: {
    getCurrentMessages: state => {
      if (!state.currentConversation) return []
      return state.conversations[state.currentConversation] || []
    },
    getMessagesByFriend: state => friendID => {
      return state.conversations[friendID] || []
    },
    hasMessages: state => friendID => {
      return !!(state.conversations[friendID] && state.conversations[friendID].length > 0)
    }
  }
}

export default chat