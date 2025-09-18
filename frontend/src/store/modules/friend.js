import { friendAPI } from '@/services/api'

const friend = {
  namespaced: true,
  state: {
    friendList: [],
    onlineUsers: [],
    selectedFriend: null,
    loadingFriends: false
  },
  mutations: {
    SET_FRIEND_LIST(state, friends) {
      state.friendList = friends
    },
    SET_ONLINE_USERS(state, users) {
      state.onlineUsers = users
    },
    SET_SELECTED_FRIEND(state, friend) {
      state.selectedFriend = friend
    },
    SET_LOADING_FRIENDS(state, loading) {
      state.loadingFriends = loading
    },
    ADD_FRIEND(state, friend) {
      if (!state.friendList.find(f => f.userID === friend.userID)) {
        state.friendList.push(friend)
      }
    },
    REMOVE_FRIEND(state, userID) {
      state.friendList = state.friendList.filter(f => f.userID !== userID)
    },
    UPDATE_FRIEND_STATUS(state, { userID, isOnline }) {
      const friend = state.friendList.find(f => f.userID === userID)
      if (friend) {
        friend.isOnline = isOnline
      }
    },
    UPDATE_FRIEND_UNREAD(state, { userID, unreadCount }) {
      const friend = state.friendList.find(f => f.userID === userID)
      if (friend) {
        friend.unreadCount = unreadCount
      }
    },
    CLEAR_FRIENDS(state) {
      state.friendList = []
      state.onlineUsers = []
      state.selectedFriend = null
    }
  },
  actions: {
    async fetchFriendList({ commit }) {
      commit('SET_LOADING_FRIENDS', true)
      try {
        const response = await friendAPI.getFriendList()
        if (response.data.code === 200) {
          commit('SET_FRIEND_LIST', response.data.data.friends)
          return { success: true, friends: response.data.data.friends }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('获取好友列表失败:', error)
        return { success: false, error: error.message || '获取好友列表失败' }
      } finally {
        commit('SET_LOADING_FRIENDS', false)
      }
    },
    async addFriend({ commit }, friendID) {
      try {
        const response = await friendAPI.addFriend(friendID)
        if (response.data.code === 200) {
          commit('ADD_FRIEND', response.data.data.friend)
          return { success: true, friend: response.data.data.friend }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('添加好友失败:', error)
        return { success: false, error: error.message || '添加好友失败' }
      }
    },
    async deleteFriend({ commit }, friendID) {
      try {
        const response = await friendAPI.deleteFriend(friendID)
        if (response.data.code === 200) {
          commit('REMOVE_FRIEND', friendID)
          return { success: true }
        } else {
          return { success: false, error: response.data.message }
        }
      } catch (error) {
        console.error('删除好友失败:', error)
        return { success: false, error: error.message || '删除好友失败' }
      }
    },
    selectFriend({ commit }, friend) {
      commit('SET_SELECTED_FRIEND', friend)
    },
    updateFriendOnlineStatus({ commit }, { userID, isOnline }) {
      commit('UPDATE_FRIEND_STATUS', { userID, isOnline })
    },
    updateFriendUnreadCount({ commit }, { userID, unreadCount }) {
      commit('UPDATE_FRIEND_UNREAD', { userID, unreadCount })
    }
  },
  getters: {
    onlineFriends: state => state.friendList.filter(f => f.isOnline),
    offlineFriends: state => state.friendList.filter(f => !f.isOnline),
    totalUnreadCount: state => state.friendList.reduce((total, friend) => total + (friend.unreadCount || 0), 0),
    getFriendByID: state => userID => state.friendList.find(f => f.userID === userID)
  }
}

export default friend