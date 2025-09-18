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
            <div class="bubble-content">
              {{ message.content }}
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
            @click="sendMessage"
          >
            {{ sending ? '发送中...' : '发送' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { formatMessageTime, scrollToBottom, isScrolledToBottom } from '@/utils/helpers'

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
      lastMessageCount: 0
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
  methods: {
    isOwnMessage(message) {
      return message.fromUserID === this.currentUser?.userID
    },

    getMessageNickname(message) {
      if (this.isOwnMessage(message)) {
        return this.currentUser?.nickname || '我'
      }
      return this.friend?.nickname || `用户${message.fromUserID}`
    },

    getMessageAvatar(message) {
      if (this.isOwnMessage(message)) {
        return this.currentUser?.avatar
      }
      return this.friend?.avatar
    },

    formatMessageTime(timestamp) {
      return formatMessageTime(timestamp)
    },

    handleKeyDown(event) {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        this.sendMessage()
      }
    },

    sendMessage() {
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

    focusInput() {
      this.$refs.messageInput?.$refs?.textarea?.focus()
    },

    scrollToBottom() {
      const messageList = this.$refs.messageList
      if (messageList) {
        scrollToBottom(messageList)
      }
    },

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