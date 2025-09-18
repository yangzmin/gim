const user = {
  namespaced: true,
  state: {
    userInfo: null,
    appID: 101,
    profile: null
  },
  mutations: {
    SET_USER_INFO(state, userInfo) {
      state.userInfo = userInfo
    },
    SET_APP_ID(state, appID) {
      state.appID = appID
    },
    SET_PROFILE(state, profile) {
      state.profile = profile
    },
    CLEAR_USER_INFO(state) {
      state.userInfo = null
      state.profile = null
    }
  },
  actions: {
    async fetchProfile({ commit }, userID) {
      try {
        // 这里可以添加获取用户详细资料的API调用
        // const response = await userAPI.getProfile(userID)
        // commit('SET_PROFILE', response.data)
        // return response.data
        console.log('获取用户资料:', userID)
      } catch (error) {
        console.error('获取用户资料失败:', error)
      }
    }
  },
  getters: {
    currentUserID: state => state.userInfo?.userID,
    currentNickname: state => state.userInfo?.nickname,
    currentAvatar: state => state.userInfo?.avatar
  }
}

export default user