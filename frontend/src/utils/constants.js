// 应用常量定义

// WebSocket相关
export const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'ws://127.0.0.1:8089/acc' 
  : 'ws://127.0.0.1:8089/acc'

// 应用配置
export const APP_CONFIG = {
  APP_ID: 'app_default_001',
  DEFAULT_AVATAR: '/images/default-avatar.png',
  MESSAGE_PAGE_SIZE: 20,
  HEARTBEAT_INTERVAL: 30000, // 30秒
  RECONNECT_MAX_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000 // 1秒
}

// 消息类型
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system'
}

// WebSocket命令类型
export const WS_COMMANDS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  HEARTBEAT: 'heartbeat',
  MESSAGE: 'msg',
  ENTER: 'enter',
  EXIT: 'exit',
  PING: 'ping'
}

// 连接状态
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  AUTHENTICATED: 'connected' // 认证成功后也是连接状态
}

// 响应状态码
export const API_CODES = {
  SUCCESS: 200,
  NOT_LOGGED_IN: 1000,
  PARAMETER_ILLEGAL: 1001,
  UNAUTHORIZED_USER_ID: 1002,
  UNAUTHORIZED: 1003,
  SERVER_ERROR: 1004
}