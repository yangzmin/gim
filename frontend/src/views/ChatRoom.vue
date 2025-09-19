<template>
  <div class="chat-room">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ 'show': showSidebar }">
      <!-- 用户信息 -->
      <div class="user-header">
        <div class="user-info">
          <div class="avatar">
            <img v-if="currentUser?.avatar" :src="currentUser.avatar" :alt="currentUser.nickname" />
            <span v-else>{{ currentUser?.nickname?.charAt(0) || 'U' }}</span>
          </div>
          <div class="user-details">
            <div class="nickname">{{ currentUser?.nickname || '未知用户' }}</div>
            <div class="status" :class="connectionStatus">
              <i class="status-dot"></i>
              {{ statusText }}
            </div>
          </div>
        </div>
        <div class="user-actions">
          <el-dropdown @command="handleUserAction">
            <span class="el-dropdown-link">
              <i class="el-icon-more"></i>
            </span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="addFriend">添加好友</el-dropdown-item>
              <el-dropdown-item command="settings">设置</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </div>

      <!-- 好友列表 -->
      <FriendList 
        :friends="friendList"
        :selected-friend="selectedFriend"
        :loading="loadingFriends"
        @select-friend="handleSelectFriend"
        @add-friend="handleAddFriend"
      />
    </div>

    <!-- 主聊天区域 -->
    <div class="main-content">
      <!-- 聊天窗口 -->
      <ChatWindow 
        v-if="selectedFriend"
        :friend="selectedFriend"
        :messages="currentMessages"
        :loading="loadingHistory"
        :sending="sendingMessage"
        @send-message="handleSendMessage"
        @send-audio-message="handleSendAudioMessage"
        @load-more="handleLoadMore"
      />
      
      <!-- 欢迎界面 -->
      <div v-else class="welcome-screen">
        <div class="welcome-content">
          <i class="el-icon-chat-line-round welcome-icon"></i>
          <h3>欢迎使用 GoWebSocket IM</h3>
          <p>选择一个好友开始聊天</p>
          <el-button type="primary" @click="handleAddFriend">
            <i class="el-icon-plus"></i>
            添加好友
          </el-button>
        </div>
      </div>
    </div>

    <!-- 移动端侧边栏遮罩 -->
    <div 
      v-if="showSidebar" 
      class="sidebar-overlay"
      @click="showSidebar = false"
    ></div>

    <!-- 添加好友对话框 -->
    <el-dialog
      title="添加好友"
      :visible.sync="addFriendDialog"
      width="400px"
      @close="resetAddFriendForm"
    >
      <el-form ref="addFriendForm" :model="addFriendForm" :rules="addFriendRules">
        <el-form-item label="用户ID" prop="friendID">
          <el-input
            v-model="addFriendForm.friendID"
            placeholder="请输入要添加的用户ID"
            @keyup.enter.native="confirmAddFriend"
          />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="addFriendDialog = false">取 消</el-button>
        <el-button type="primary" :loading="addingFriend" @click="confirmAddFriend">
          {{ addingFriend ? '添加中...' : '确 定' }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import FriendList from '@/components/friend/FriendList.vue'
import ChatWindow from '@/components/chat/ChatWindow.vue'
import { WS_URL, APP_CONFIG } from '@/utils/constants'

export default {
  name: 'ChatRoom',
  components: {
    FriendList,
    ChatWindow
  },
  data() {
    return {
      showSidebar: false,
      addFriendDialog: false,
      addingFriend: false,
      addFriendForm: {
        friendID: ''
      },
      addFriendRules: {
        friendID: [
          { required: true, message: '请输入用户ID', trigger: 'blur' },
          { min: 3, max: 20, message: '用户ID长度在 3 到 20 个字符', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    ...mapState('auth', ['userInfo']),
    ...mapState('friend', ['friendList', 'selectedFriend', 'loadingFriends']),
    ...mapState('chat', ['loadingHistory', 'sendingMessage']),
    ...mapState('connection', ['status']),
    ...mapGetters('auth', ['currentUser']),
    ...mapGetters('chat', ['getCurrentMessages']),
    ...mapGetters('connection', ['connectionStatus']),
    
    currentMessages() {
      return this.getCurrentMessages
    },
    
    statusText() {
      console.log("this.connectionStatus",this.connectionStatus)
      switch (this.connectionStatus) {
        case 'connected':
          return '在线'
        case 'connecting':
          return '连接中'
        case 'reconnecting':
          return '重连中'
        case 'disconnected':
          return '离线'
        default:
          console.warn('未知连接状态:', this.connectionStatus)
          return '离线'
      }
    }
  },
  async mounted() {
    await this.initializeApp()
  },
  beforeDestroy() {
    // 不在页面销毁时断开WebSocket连接
    // WebSocket连接应该在用户真正退出登录时才断开
    // 这样可以避免页面跳转时的连接中断问题
    console.log('ChatRoom组件即将销毁，保持WebSocket连接')
  },
  methods: {
    ...mapActions('auth', ['logout']),
    ...mapActions('friend', ['fetchFriendList', 'addFriend', 'selectFriend']),
    ...mapActions('chat', ['loadChatHistory', 'sendMessage', 'switchConversation']),
    ...mapActions('connection', ['connect', 'disconnect']),

    /**
     * 初始化应用
     */
    async initializeApp() {
      try {
        console.log('初始化应用，当前连接状态:', this.connectionStatus)
        
        // 获取好友列表
        await this.fetchFriendList()
        
        // 检查WebSocket连接状态
        const token = localStorage.getItem('gowebsocket_token')
        console.log("token",token)
        if (token) {
          // 检查WebSocket服务的实际连接状态
          const wsService = this.$websocket
          const actualStatus = wsService.getConnectionStatus()
          
          console.log('Store连接状态:', this.connectionStatus)
          console.log('WebSocket实际状态:', actualStatus)
          
          // 如果WebSocket实际已连接但store状态不对，同步状态
          if (actualStatus === 'connected' && this.connectionStatus !== 'connected') {
            this.$store.commit('connection/SET_CONNECTION_STATUS', 'connected')
            console.log('同步连接状态为已连接')
          }
          // 如果没有连接，尝试建立连接
          else if (actualStatus !== 'connected' && this.connectionStatus !== 'connecting') {
            console.log('尝试建立WebSocket连接')
            await this.connect({
              url: WS_URL,
              token: token
            })
          }
        }
      } catch (error) {
        console.error('初始化失败:', error)
        this.$message.error('初始化失败，请刷新页面重试')
      }
    },

    handleSelectFriend(friend) {
      this.selectFriend(friend)
      this.switchConversation(friend.userID)
      
      // 加载聊天记录
      this.loadChatHistory({
        friendID: friend.userID,
        page: 1,
        limit: APP_CONFIG.MESSAGE_PAGE_SIZE
      })

      // 移动端收起侧边栏
      if (window.innerWidth <= 768) {
        this.showSidebar = false
      }
    },

    /**
     * 处理发送文字消息
     */
    async handleSendMessage(content) {
      if (!this.selectedFriend || !content.trim()) {
        return
      }

      const result = await this.sendMessage({
        friendID: this.selectedFriend.userID,
        content: content.trim(),
        messageType: 'text'
      })

      if (!result.success) {
        this.$message.error(result.error || '发送消息失败')
      }
    },

    /**
     * 处理发送音频消息
     */
    async handleSendAudioMessage(audioData) {
      if (!this.selectedFriend || !audioData.audioData) {
        return
      }

      const result = await this.sendAudioMessage({
        friendID: this.selectedFriend.userID,
        audioData: audioData.audioData,
        audioFormat: audioData.audioFormat,
        duration: audioData.duration
      })

      if (!result.success) {
        this.$message.error(result.error || '发送音频消息失败')
      }
    },

    async handleLoadMore() {
      if (!this.selectedFriend) return

      // 这里可以实现加载更多历史消息的逻辑
      console.log('加载更多消息')
    },

    handleUserAction(command) {
      switch (command) {
        case 'addFriend':
          this.handleAddFriend()
          break
        case 'settings':
          this.$message.info('设置功能开发中...')
          break
        case 'logout':
          this.handleLogout()
          break
      }
    },

    handleAddFriend() {
      this.addFriendDialog = true
    },

    async confirmAddFriend() {
      try {
        await this.$refs.addFriendForm.validate()
        
        this.addingFriend = true
        const result = await this.addFriend(this.addFriendForm.friendID.trim())
        
        if (result.success) {
          this.$message.success('添加好友成功')
          this.addFriendDialog = false
          this.resetAddFriendForm()
        } else {
          this.$message.error(result.error || '添加好友失败')
        }
      } catch (error) {
        console.error('添加好友失败:', error)
      } finally {
        this.addingFriend = false
      }
    },

    resetAddFriendForm() {
      this.addFriendForm.friendID = ''
      this.$refs.addFriendForm?.resetFields()
    },

    async handleLogout() {
      try {
        await this.$confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })

        await this.logout()
        this.$router.push('/login')
      } catch (error) {
        // 用户取消
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-room {
  height: 100vh;
  display: flex;
  background: #f5f7fa;
}

.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  z-index: 100;
  position: relative;
}

.user-header {
  padding: 20px 16px;
  border-bottom: 1px solid #f2f6fc;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
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

.user-details {
  flex: 1;
  min-width: 0;
}

.nickname {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #909399;

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #909399;
    margin-right: 4px;
  }

  &.connected .status-dot {
    background: #67c23a;
  }

  &.connecting .status-dot,
  &.reconnecting .status-dot {
    background: #e6a23c;
  }
}

.user-actions {
  .el-dropdown-link {
    cursor: pointer;
    color: #606266;
    font-size: 18px;
    
    &:hover {
      color: #409eff;
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.welcome-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafbfc;
}

.welcome-content {
  text-align: center;
  color: #909399;

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 20px;
    color: #c0c4cc;
  }

  h3 {
    font-size: 20px;
    margin-bottom: 8px;
    color: #606266;
  }

  p {
    font-size: 14px;
    margin-bottom: 24px;
  }
}

.sidebar-overlay {
  display: none;
}

// 响应式设计
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 1000;

    &.show {
      transform: translateX(0);
    }
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
  }

  .main-content {
    width: 100%;
  }
}
</style>