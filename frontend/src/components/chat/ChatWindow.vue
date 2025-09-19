<template>
  <div class="chat-window">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <div class="friend-info">
        <div class="avatar">
          <img v-if="friend.avatar" :src="friend.avatar" :alt="friend.nickname" />
          <span v-else>{{ friend.nickname?.charAt(0) || 'U' }}</span>
        </div>
        <div class="friend-details">
          <div class="friend-name">{{ friend.nickname }}</div>
          <div class="friend-status" :class="{ 'online': friend.isOnline }">
            <i class="status-dot"></i>
            {{ friend.isOnline ? '在线' : '离线' }}
          </div>
        </div>
      </div>
      <div class="chat-actions">
        <el-button size="mini" icon="el-icon-more" circle @click="showChatMenu"></el-button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="message-list" ref="messageList" @scroll="handleScroll">
      <!-- 加载更多提示 -->
      <div v-if="loading" class="loading-more">
        <i class="el-icon-loading"></i>
        <span>加载中...</span>
      </div>

      <!-- 消息项 -->
      <div
        v-for="message in messages"
        :key="message.messageID"
        class="message-item"
        :class="{ 'own': isOwnMessage(message) }"
      >
        <div class="message-avatar">
          <div class="avatar">
            <img v-if="getMessageAvatar(message)" :src="getMessageAvatar(message)" />
            <span v-else>{{ getMessageNickname(message)?.charAt(0) || 'U' }}</span>
          </div>
        </div>
        <div class="message-content">
          <div class="message-info">
            <span class="sender-name">{{ getMessageNickname(message) }}</span>
            <span class="send-time">{{ formatMessageTime(message.timestamp) }}</span>
          </div>
          <div class="message-bubble" :class="{ 'own': isOwnMessage(message) }">
            <!-- 文字消息 -->
            <div v-if="isTextMessage(message)" class="bubble-content">
              {{ message.content }}
            </div>
            <!-- 音频消息 -->
            <div v-else-if="isAudioMessage(message)" class="audio-message">
              <div class="audio-player">
                <el-button
                  :icon="getAudioPlayIcon(message.messageID)"
                  size="mini"
                  circle
                  @click="toggleAudioPlay(message)"
                  :loading="audioLoading[message.messageID]"
                />
                <div class="audio-info">
                  <div class="audio-duration">{{ formatAudioDuration(message.duration) }}</div>
                  <div class="audio-format">{{ message.audioFormat || 'PCM' }}</div>
                </div>
                <div class="audio-waveform">
                  <div class="waveform-bars">
                    <span v-for="i in 8" :key="i" class="bar"></span>
                  </div>
                </div>
              </div>
            </div>
            <!-- 其他类型消息 -->
            <div v-else class="bubble-content">
              <i class="el-icon-warning"></i>
              不支持的消息类型
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="messages.length === 0 && !loading" class="empty-messages">
        <i class="el-icon-chat-dot-round"></i>
        <p>暂无聊天记录，发送第一条消息开始聊天吧！</p>
      </div>
    </div>

    <!-- 消息输入区 -->
    <div class="message-input">
      <div class="input-toolbar">
        <el-button size="mini" icon="el-icon-picture" circle title="发送图片"></el-button>
        <el-button size="mini" icon="el-icon-paperclip" circle title="发送文件"></el-button>
        <el-button 
          size="mini" 
          :icon="recordingAudio ? 'el-icon-video-pause' : 'el-icon-microphone'" 
          circle 
          :type="recordingAudio ? 'danger' : 'default'"
          :title="recordingAudio ? '停止录音' : '录制音频'"
          @click="toggleAudioRecording"
        ></el-button>
        <el-button size="mini" icon="el-icon-chat-dot-square" circle title="表情"></el-button>
      </div>
      <div class="input-area">
        <el-input
          ref="messageInput"
          v-model="messageContent"
          type="textarea"
          :rows="3"
          placeholder="输入消息内容，按 Ctrl+Enter 发送"
          resize="none"
          :disabled="sending"
          @keydown.native="handleKeyDown"
        />
        <div class="input-actions">
          <el-button
            type="primary"
            size="small"
            :loading="sending"
            :disabled="!messageContent.trim()"
            @click="sendTextMessage"
          >
            {{ sending ? '发送中...' : '发送' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 录音状态提示 -->
    <div v-if="recordingAudio" class="recording-indicator">
      <div class="recording-content">
        <i class="el-icon-microphone recording-icon"></i>
        <span>正在录音... {{ recordingDuration }}s</span>
        <el-button size="mini" @click="stopAudioRecording">完成</el-button>
        <el-button size="mini" type="danger" @click="cancelAudioRecording">取消</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { formatMessageTime, scrollToBottom, isScrolledToBottom } from '@/utils/helpers'
import { MESSAGE_TYPES, AUDIO_FORMATS } from '@/utils/constants'

export default {
  name: 'ChatWindow',
  props: {
    friend: {
      type: Object,
      required: true
    },
    messages: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    sending: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      messageContent: '',
      autoScroll: true,
      lastMessageCount: 0,
      // 音频相关状态
      recordingAudio: false,
      recordingDuration: 0,
      recordingTimer: null,
      mediaRecorder: null,
      audioChunks: [],
      audioPlaying: {}, // 记录正在播放的音频
      audioLoading: {}, // 记录音频加载状态
      currentAudio: null // 当前播放的音频对象
    }
  },
  computed: {
    ...mapGetters('auth', ['currentUser'])
  },
  watch: {
    messages: {
      handler(newMessages) {
        this.$nextTick(() => {
          // 如果消息数量增加，并且用户在底部，自动滚动到底部
          if (newMessages.length > this.lastMessageCount && this.autoScroll) {
            this.scrollToBottom()
          }
          this.lastMessageCount = newMessages.length
        })
      },
      immediate: true
    },
    friend: {
      handler() {
        // 切换好友时清空输入框并滚动到底部
        this.messageContent = ''
        this.stopAllAudio()
        this.$nextTick(() => {
          this.scrollToBottom()
          this.focusInput()
        })
      },
      immediate: true
    }
  },
  mounted() {
    this.focusInput()
    this.scrollToBottom()
  },
  beforeDestroy() {
    this.stopAllAudio()
    this.cancelAudioRecording()
  },
  methods: {
    /**
     * 判断是否为自己发送的消息
     */
    isOwnMessage(message) {
      return message.fromUserID === this.currentUser?.userID
    },

    /**
     * 获取消息发送者昵称
     */
    getMessageNickname(message) {
      if (this.isOwnMessage(message)) {
        return this.currentUser?.nickname || '我'
      }
      return this.friend?.nickname || `用户${message.fromUserID}`
    },

    /**
     * 获取消息发送者头像
     */
    getMessageAvatar(message) {
      if (this.isOwnMessage(message)) {
        return this.currentUser?.avatar
      }
      return this.friend?.avatar
    },

    /**
     * 判断是否为文字消息
     */
    isTextMessage(message) {
      return !message.messageType || message.messageType === MESSAGE_TYPES.TEXT
    },

    /**
     * 判断是否为音频消息
     */
    isAudioMessage(message) {
      return message.messageType === MESSAGE_TYPES.AUDIO
    },

    /**
     * 格式化消息时间
     */
    formatMessageTime(timestamp) {
      return formatMessageTime(timestamp)
    },

    /**
     * 格式化音频时长
     */
    formatAudioDuration(duration) {
      if (!duration) return '0"'
      const seconds = Math.floor(duration / 1000)
      return `${seconds}"`
    },

    /**
     * 获取音频播放按钮图标
     */
    getAudioPlayIcon(messageID) {
      return this.audioPlaying[messageID] ? 'el-icon-video-pause' : 'el-icon-video-play'
    },

    /**
     * 切换音频播放状态
     */
    async toggleAudioPlay(message) {
      const messageID = message.messageID
      
      if (this.audioPlaying[messageID]) {
        this.stopAudio(messageID)
      } else {
        await this.playAudio(message)
      }
    },

    /**
     * 播放音频消息
     */
    async playAudio(message) {
      const messageID = message.messageID
      
      try {
        // 停止其他正在播放的音频
        this.stopAllAudio()
        
        this.$set(this.audioLoading, messageID, true)
        
        // 将Base64音频数据转换为Blob
        const audioData = message.audioData || message.content
        const byteCharacters = atob(audioData)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'audio/wav' })
        
        // 创建音频对象
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        
        this.currentAudio = audio
        
        // 设置音频事件监听
        audio.onloadeddata = () => {
          this.$set(this.audioLoading, messageID, false)
          this.$set(this.audioPlaying, messageID, true)
        }
        
        audio.onended = () => {
          this.stopAudio(messageID)
          URL.revokeObjectURL(audioUrl)
        }
        
        audio.onerror = () => {
          this.$set(this.audioLoading, messageID, false)
          this.$message.error('音频播放失败')
          URL.revokeObjectURL(audioUrl)
        }
        
        // 开始播放
        await audio.play()
        
      } catch (error) {
        console.error('播放音频失败:', error)
        this.$set(this.audioLoading, messageID, false)
        this.$message.error('音频播放失败')
      }
    },

    /**
     * 停止指定音频播放
     */
    stopAudio(messageID) {
      this.$set(this.audioPlaying, messageID, false)
      if (this.currentAudio) {
        this.currentAudio.pause()
        this.currentAudio.currentTime = 0
        this.currentAudio = null
      }
    },

    /**
     * 停止所有音频播放
     */
    stopAllAudio() {
      Object.keys(this.audioPlaying).forEach(messageID => {
        this.$set(this.audioPlaying, messageID, false)
      })
      if (this.currentAudio) {
        this.currentAudio.pause()
        this.currentAudio.currentTime = 0
        this.currentAudio = null
      }
    },

    /**
     * 切换音频录制状态
     */
    async toggleAudioRecording() {
      if (this.recordingAudio) {
        this.stopAudioRecording()
      } else {
        await this.startAudioRecording()
      }
    },

    /**
     * 开始录制音频
     */
    async startAudioRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        
        this.mediaRecorder = new MediaRecorder(stream)
        this.audioChunks = []
        this.recordingDuration = 0
        
        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data)
        }
        
        this.mediaRecorder.onstop = () => {
          this.processRecordedAudio()
          stream.getTracks().forEach(track => track.stop())
        }
        
        this.mediaRecorder.start()
        this.recordingAudio = true
        
        // 开始计时
        this.recordingTimer = setInterval(() => {
          this.recordingDuration++
        }, 1000)
        
      } catch (error) {
        console.error('开始录音失败:', error)
        this.$message.error('无法访问麦克风，请检查权限设置')
      }
    },

    /**
     * 停止录制音频
     */
    stopAudioRecording() {
      if (this.mediaRecorder && this.recordingAudio) {
        this.mediaRecorder.stop()
        this.recordingAudio = false
        
        if (this.recordingTimer) {
          clearInterval(this.recordingTimer)
          this.recordingTimer = null
        }
      }
    },

    /**
     * 取消录制音频
     */
    cancelAudioRecording() {
      if (this.mediaRecorder && this.recordingAudio) {
        this.mediaRecorder.stop()
        this.recordingAudio = false
        this.audioChunks = []
        
        if (this.recordingTimer) {
          clearInterval(this.recordingTimer)
          this.recordingTimer = null
        }
      }
    },

    /**
     * 处理录制完成的音频
     */
    async processRecordedAudio() {
      if (this.audioChunks.length === 0) return
      
      try {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
        
        // 将音频转换为Base64
        const reader = new FileReader()
        reader.onload = () => {
          const base64Audio = reader.result.split(',')[1]
          const duration = this.recordingDuration * 1000 // 转换为毫秒
          
          // 发送音频消息
          this.$emit('send-audio-message', {
            audioData: base64Audio,
            audioFormat: AUDIO_FORMATS.PCM_16K,
            duration: duration
          })
        }
        reader.readAsDataURL(audioBlob)
        
      } catch (error) {
        console.error('处理录音失败:', error)
        this.$message.error('录音处理失败')
      }
    },

    /**
     * 处理键盘事件
     */
    handleKeyDown(event) {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        this.sendTextMessage()
      }
    },

    /**
     * 发送文字消息
     */
    sendTextMessage() {
      const content = this.messageContent.trim()
      if (!content || this.sending) return

      this.$emit('send-message', content)
      this.messageContent = ''
      
      // 发送后滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom()
        this.focusInput()
      })
    },

    /**
     * 聚焦输入框
     */
    focusInput() {
      this.$refs.messageInput?.$refs?.textarea?.focus()
    },

    /**
     * 滚动到底部
     */
    scrollToBottom() {
      const messageList = this.$refs.messageList
      if (messageList) {
        scrollToBottom(messageList)
      }
    },

    /**
     * 处理滚动事件
     */
    handleScroll() {
      const messageList = this.$refs.messageList
      if (!messageList) return

      // 检查是否滚动到底部
      this.autoScroll = isScrolledToBottom(messageList)

      // 检查是否滚动到顶部，加载更多消息
      if (messageList.scrollTop === 0 && this.messages.length > 0 && !this.loading) {
        this.$emit('load-more')
      }
    },

    /**
     * 显示聊天菜单
     */
    showChatMenu() {
      this.$message.info('聊天菜单功能开发中...')
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  z-index: 10;
}

.friend-info {
  display: flex;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  margin-right: 12px;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
}

.friend-details {
  .friend-name {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
    margin-bottom: 4px;
  }

  .friend-status {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: #909399;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #c0c4cc;
      margin-right: 4px;
    }

    &.online .status-dot {
      background: #67c23a;
    }
  }
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8f9fa;
  scroll-behavior: smooth;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: #909399;
  font-size: 14px;

  i {
    margin-right: 8px;
  }
}

.message-item {
  display: flex;
  margin-bottom: 20px;
  
  &.own {
    flex-direction: row-reverse;
    
    .message-content {
      align-items: flex-end;
      
      .message-info {
        text-align: right;
      }
      
      .message-bubble {
        background: #409eff;
        color: white;
        
        &::before {
          display: none;
        }
        
        &::after {
          content: '';
          position: absolute;
          top: 10px;
          right: -8px;
          width: 0;
          height: 0;
          border-left: 8px solid #409eff;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
        }
      }
    }
    
    .message-avatar {
      margin-left: 12px;
      margin-right: 0;
    }
  }
}

.message-avatar {
  margin-right: 12px;
  flex-shrink: 0;
  
  .avatar {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.message-info {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  
  .sender-name {
    font-size: 12px;
    color: #606266;
    font-weight: 500;
    margin-right: 8px;
  }
  
  .send-time {
    font-size: 11px;
    color: #c0c4cc;
  }
}

.message-bubble {
  position: relative;
  max-width: 70%;
  background: white;
  border-radius: 16px;
  padding: 10px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    top: 10px;
    left: -8px;
    width: 0;
    height: 0;
    border-right: 8px solid white;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
  }
  
  .bubble-content {
    word-wrap: break-word;
    word-break: break-word;
    line-height: 1.4;
    font-size: 14px;
  }
}

.empty-messages {
  text-align: center;
  color: #c0c4cc;
  padding: 60px 20px;
  
  i {
    font-size: 48px;
    margin-bottom: 16px;
    display: block;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
}

.message-input {
  border-top: 1px solid #e4e7ed;
  background: white;
}

.input-toolbar {
  padding: 12px 20px 8px;
  border-bottom: 1px solid #f2f6fc;
  
  .el-button {
    margin-right: 8px;
    
    &:last-child {
      margin-right: 0;
    }
  }
}

.input-area {
  padding: 0 20px 16px;
  position: relative;
  
  .el-textarea {
    :deep(.el-textarea__inner) {
      border: none;
      padding: 8px 0;
      resize: none;
      box-shadow: none;
      background: transparent;
      
      &:focus {
        border: none;
        box-shadow: none;
      }
    }
  }
  
  .input-actions {
    text-align: right;
    margin-top: 8px;
  }
}

// 滚动条样式
.message-list::-webkit-scrollbar {
  width: 6px;
}

.message-list::-webkit-scrollbar-track {
  background: transparent;
}

.message-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.message-list::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

// 响应式设计
@media (max-width: 768px) {
  .chat-header {
    padding: 12px 16px;
  }
  
  .message-list {
    padding: 16px;
  }
  
  .input-toolbar,
  .input-area {
    padding-left: 16px;
    padding-right: 16px;
  }
  
  .message-bubble {
    max-width: 85%;
  }
}
</style>