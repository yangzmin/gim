import store from '@/store'
import { WS_URL, WS_COMMANDS, CONNECTION_STATUS, MESSAGE_TYPES, AUDIO_FORMATS } from '@/utils/constants'
import { generateId } from '@/utils/helpers'

class WebSocketService {
  constructor() {
    this.ws = null
    this.heartbeatTimer = null
    this.reconnectTimer = null
    this.maxReconnectAttempts = 5
    this.reconnectAttempts = 0
    this.reconnectDelay = 1000
    this.heartbeatInterval = 30000 // 30秒
    this.isConnecting = false
    this.isDestroyed = false
    this.url = ''
    this.userID = '' // 从登录响应中获取
    
    // 消息队列，用于连接恢复后重发
    this.messageQueue = []
    
    // 绑定this上下文
    this.onOpen = this.onOpen.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this.onClose = this.onClose.bind(this)
    this.onError = this.onError.bind(this)
  }

  /**
   * 连接WebSocket
   * @param {string} url - WebSocket服务器地址
   * @param {string} token - 用户认证token
   */
  connect(url, token) {
    return new Promise((resolve, reject) => {
      // 如果服务已销毁，重新初始化服务状态
      if (this.isDestroyed) {
        console.log('WebSocket服务已销毁，重新初始化...')
        this.isDestroyed = false
        this.ws = null
        this.heartbeatTimer = null
        this.reconnectTimer = null
        this.reconnectAttempts = 0
        this.isConnecting = false
        this.messageQueue = []
      }

      if (this.isConnecting) {
        reject(new Error('正在连接中'))
        return
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(this.ws)
        return
      }

      // 验证必要参数
      if (!token) {
        reject(new Error('token不能为空'))
        return
      }

      this.url = url
      this.token = token // 保存token以便在onOpen时使用
      this.isConnecting = true

      try {
        console.log(`开始连接WebSocket: ${url}`)
        console.log(`连接信息: hasToken=${!!token}`)
        store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.CONNECTING)

        this.ws = new WebSocket(url)
        this.ws.onopen = () => {
          this.onOpen()
          resolve(this.ws)
        }
        this.ws.onmessage = this.onMessage
        this.ws.onclose = this.onClose
        this.ws.onerror = (error) => {
          this.onError(error)
          reject(error)
        }

        // 连接超时处理
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false
            reject(new Error('连接超时'))
          }
        }, 10000)

      } catch (error) {
        this.isConnecting = false
        store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.DISCONNECTED)
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.isDestroyed = true
    this.stopHeartbeat()
    this.stopReconnect()
    
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
      }
      this.ws = null
    }
    
    store.commit('connection/CLEAR_CONNECTION')
    console.log('WebSocket连接已断开')
  }

  /**
   * 发送消息
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未连接，消息将加入队列')
      this.messageQueue.push(data)
      return false
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      this.ws.send(message)
      console.log('发送WebSocket消息:', data)
      return true
    } catch (error) {
      console.error('发送消息失败:', error)
      return false
    }
  }

  /**
   * 发送文字消息
   * @param {string} toUserID - 目标用户ID
   * @param {string} content - 消息内容
   * @returns {boolean} 发送是否成功
   */
  sendTextMessage(toUserID, content) {
    if (!toUserID || !content) {
      console.error('发送文字消息参数不完整')
      return false
    }

    const messageData = {
      seq: generateId(),
      cmd: WS_COMMANDS.SEND_MESSAGE,
      data: {
        toUserID: toUserID,
        messageType: MESSAGE_TYPES.TEXT,
        content: content.trim(),
        timestamp: Math.floor(Date.now() / 1000)
      }
    }

    return this.send(messageData)
  }

  /**
   * 发送音频消息
   * @param {string} toUserID - 目标用户ID
   * @param {string} audioData - Base64编码的音频数据
   * @param {string} audioFormat - 音频格式，默认为pcm_16k
   * @param {number} duration - 音频时长（毫秒）
   * @returns {boolean} 发送是否成功
   */
  sendAudioMessage(toUserID, audioData, audioFormat = AUDIO_FORMATS.PCM_16K, duration = 0) {
    if (!toUserID || !audioData) {
      console.error('发送音频消息参数不完整')
      return false
    }

    const messageData = {
      seq: generateId(),
      cmd: WS_COMMANDS.SEND_AUDIO_MESSAGE,
      data: {
        toUserID: toUserID,
        audioData: audioData,
        audioFormat: audioFormat,
        duration: duration,
        timestamp: Math.floor(Date.now() / 1000)
      }
    }

    return this.send(messageData)
  }

  /**
   * 发送登录消息
   * @param {string} token - JWT token
   */
  sendLogin(token) {
    // 验证token参数
    if (!token) {
      console.error('WebSocket登录缺少token参数');
      return;
    }

    console.log('发送WebSocket登录消息:', { token: token.substring(0, 20) + '...' });
    
    const loginMessage = {
      seq: generateId(),
      cmd: WS_COMMANDS.LOGIN,
      data: {
        serviceToken: token // 只发送token参数
      }
    };
    
    this.send(loginMessage);
  }

  /**
   * 发送心跳
   */
  sendHeartbeat() {
    const heartbeatData = {
      seq: generateId(),
      cmd: WS_COMMANDS.HEARTBEAT,
      data: {
        userID: this.userID || store.state.auth.user?.userID
      }
    }
    return this.send(heartbeatData)
  }

  /**
   * 连接打开事件
   */
  onOpen() {
    console.log('WebSocket连接已建立')
    this.isConnecting = false
    this.reconnectAttempts = 0
    
    store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.CONNECTED)
    store.commit('connection/SET_WEBSOCKET', this.ws)
    store.commit('connection/RESET_RECONNECT_ATTEMPTS')

    // 发送登录消息 - 使用连接时保存的token
    const token = this.token || store.state.auth.token
    if (token) {
      console.log('WebSocket登录参数验证:', {
        hasToken: !!token
      })
      this.sendLogin(token)
    } else {
      console.error('WebSocket登录失败: 缺少token', {
        savedToken: !!this.token,
        storeToken: !!store.state.auth.token
      })
    }

    // 启动心跳
    this.startHeartbeat()

    // 发送队列中的消息
    this.processMessageQueue()
  }

  /**
   * 消息接收事件
   */
  onMessage(event) {
    try {
      const message = JSON.parse(event.data)
      console.log('收到WebSocket消息:', message)
      
      this.handleMessage(message)
    } catch (error) {
      console.error('解析WebSocket消息失败:', error)
    }
  }

  /**
   * 连接关闭事件
   */
  onClose(event) {
    console.log('WebSocket连接已关闭', event.code, event.reason)
    this.isConnecting = false
    
    store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.DISCONNECTED)
    this.stopHeartbeat()

    // 如果不是主动断开，尝试重连
    if (!this.isDestroyed && event.code !== 1000) {
      this.attemptReconnect()
    }
  }

  /**
   * 连接错误事件
   */
  onError(error) {
    console.error('WebSocket连接错误:', error)
    this.isConnecting = false
    store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.DISCONNECTED)
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(message) {
    const { cmd, response } = message

    switch (cmd) {
      case WS_COMMANDS.MESSAGE:
        this.handleChatMessage(response)
        break
      case WS_COMMANDS.ENTER:
        this.handleUserEnter(response)
        break
      case WS_COMMANDS.EXIT:
        this.handleUserExit(response)
        break
      case WS_COMMANDS.HEARTBEAT:
        this.handleHeartbeat(response)
        break
      case WS_COMMANDS.LOGIN:
        this.handleLoginResponse(response)
        break
      default:
        console.log('未处理的消息类型:', cmd)
    }
  }

  /**
   * 处理聊天消息
   */
  handleChatMessage(response) {
    if (!response || !response.data) return

    const { from, to, msg, messageType = 'text' } = response.data
    
    // 根据消息类型处理内容
    let content = msg
    let parsedContent = null
    
    if (messageType === MESSAGE_TYPES.AUDIO) {
      try {
        parsedContent = JSON.parse(msg)
        content = parsedContent
      } catch (error) {
        console.error('解析音频消息内容失败:', error)
        return
      }
    }
    
    const messageObj = {
      messageID: `ws_${Date.now()}_${from}`,
      fromUserID: from,
      toUserID: to || this.userID,
      content: content,
      messageType: messageType,
      timestamp: new Date().toISOString(),
      isRead: false
    }

    // 添加到聊天记录
    store.dispatch('chat/receiveMessage', {
      fromUserID: from,
      message: messageObj
    })
  }

  /**
   * 处理用户进入
   */
  handleUserEnter(response) {
    if (!response || !response.data) return

    const { from } = response.data
    console.log(`用户 ${from} 加入了聊天室`)

    // 更新好友在线状态
    store.dispatch('friend/updateFriendOnlineStatus', {
      userID: from,
      isOnline: true
    })
  }

  /**
   * 处理用户离开
   */
  handleUserExit(response) {
    if (!response || !response.data) return

    const { from } = response.data
    console.log(`用户 ${from} 离开了聊天室`)

    // 更新好友在线状态
    store.dispatch('friend/updateFriendOnlineStatus', {
      userID: from,
      isOnline: false
    })
  }

  /**
   * 处理心跳响应
   */
  handleHeartbeat(response) {
    store.commit('connection/SET_LAST_HEARTBEAT', Date.now())
    console.log('收到心跳响应')
  }

  /**
   * 处理登录响应
   */
  handleLoginResponse(response) {
    console.log('登录响应:', response)
    
    // 从登录响应中获取userID
    if (response && response.data && response.data.userID) {
      this.userID = response.data.userID
      console.log('WebSocket登录成功，userID:', this.userID)
      
      // 更新store中的连接状态
      store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.AUTHENTICATED)
    } else {
      console.error('登录响应中缺少userID信息:', response)
    }
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      if (!this.sendHeartbeat()) {
        console.log('心跳发送失败，连接可能已断开')
        this.stopHeartbeat()
      }
    }, this.heartbeatInterval)

    store.commit('connection/SET_HEARTBEAT_INTERVAL', this.heartbeatTimer)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    store.commit('connection/SET_HEARTBEAT_INTERVAL', null)
  }

  /**
   * 尝试重连
   */
  attemptReconnect() {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('达到最大重连次数或服务已销毁，停止重连')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连...`)
    store.commit('connection/SET_CONNECTION_STATUS', CONNECTION_STATUS.RECONNECTING)
    store.commit('connection/INCREMENT_RECONNECT_ATTEMPTS')

    this.reconnectTimer = setTimeout(() => {
      if (this.isDestroyed) return

      this.connect(this.url, this.token)
        .then(() => {
          console.log('重连成功')
        })
        .catch(error => {
          console.error('重连失败:', error)
          this.attemptReconnect()
        })
    }, delay)
  }

  /**
   * 停止重连
   */
  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 处理消息队列
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  /**
   * 检查连接状态
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    if (!this.ws) return CONNECTION_STATUS.DISCONNECTED
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return CONNECTION_STATUS.CONNECTING
      case WebSocket.OPEN:
        return CONNECTION_STATUS.CONNECTED
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
      default:
        return CONNECTION_STATUS.DISCONNECTED
    }
  }
}

// 创建单例实例
const webSocketService = new WebSocketService()

export default webSocketService