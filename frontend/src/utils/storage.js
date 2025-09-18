// 本地存储工具

const TOKEN_KEY = 'gowebsocket_token'
const USER_INFO_KEY = 'gowebsocket_userInfo'

// Token相关
export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY)
}

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
}

// 用户信息相关
export const setUserInfo = (userInfo) => {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))
}

export const getUserInfo = () => {
  const userInfo = localStorage.getItem(USER_INFO_KEY)
  return userInfo ? JSON.parse(userInfo) : null
}

export const removeUserInfo = () => {
  localStorage.removeItem(USER_INFO_KEY)
}

// 清除所有存储
export const clearAll = () => {
  removeToken()
  removeUserInfo()
}