import webSocketService from '@/services/websocket'

const connection = {
  namespaced: true,
  state: {
    status: 'disconnected', // disconnected, connecting, connected, reconnecting
    ws: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: null,
    lastHeartbeat: null
  },
  mutations: {
    SET_CONNECTION_STATUS(state, status) {
      state.status = status
    },
    SET_WEBSOCKET(state, ws) {
      state.ws = ws
    },
    SET_RECONNECT_ATTEMPTS(state, attempts) {
      state.reconnectAttempts = attempts
    },
    INCREMENT_RECONNECT_ATTEMPTS(state) {
      state.reconnectAttempts++
    },
    RESET_RECONNECT_ATTEMPTS(state) {
      state.reconnectAttempts = 0
    },
    SET_HEARTBEAT_INTERVAL(state, interval) {
      state.heartbeatInterval = interval
    },
    SET_LAST_HEARTBEAT(state, time) {
      state.lastHeartbeat = time
    },
    CLEAR_CONNECTION(state) {
      state.status = 'disconnected'
      state.ws = null
      state.reconnectAttempts = 0
      if (state.heartbeatInterval) {
        clearInterval(state.heartbeatInterval)
        state.heartbeatInterval = null
      }
      state.lastHeartbeat = null
    }
  },
  actions: {
    connect({ commit, dispatch }, { url, token }) {
      return webSocketService.connect(url, token)
    },

    disconnect({ commit }) {
      webSocketService.disconnect()
    },

    sendMessage({ state }, data) {
      return webSocketService.send(data)
    },

  },
  getters: {
    isConnected: state => state.status === 'connected',
    isConnecting: state => state.status === 'connecting',
    isReconnecting: state => state.status === 'reconnecting',
    connectionStatus: state => state.status
  }
}

export default connection