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
  AUDIO: 'audio',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system'
}

// 音频格式类型
export const AUDIO_FORMATS = {
  PCM_16K: 'pcm_16k',
  MP3: 'mp3',
  WAV: 'wav'
}

// WebSocket命令类型
export const WS_COMMANDS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  HEARTBEAT: 'heartbeat',
  MESSAGE: 'msg',
  SEND_MESSAGE: 'sendMessage',
  SEND_AUDIO_MESSAGE: 'sendAudioMessage',
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
  SERVER_ERROR: 1004,
  NOT_DATA: 1005,
  MODEL_ADD_ERROR: 1006,
  MODEL_DELETE_ERROR: 1007,
  MODEL_STORE_ERROR: 1008,
  OPERATION_FAILURE: 1009,
  ROUTING_NOT_EXIST: 1010,
  NOT_ONLINE: 1011
}