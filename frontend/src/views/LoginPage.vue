<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>GoWebSocket IM</h1>
        <p>分布式即时通讯系统</p>
      </div>
      
      <el-form 
        ref="loginForm" 
        :model="loginForm" 
        :rules="loginRules" 
        class="login-form"
        @submit.native.prevent="handleLogin"
      >
        <el-form-item prop="userID">
          <el-input
            v-model="loginForm.userID"
            type="text"
            placeholder="请输入用户ID"
            prefix-icon="el-icon-user"
            size="large"
            :disabled="loading"
            @keyup.enter.native="handleLogin"
          />
        </el-form-item>
        
        <el-form-item prop="appID">
          <el-input
            v-model="loginForm.appID"
            type="text"
            placeholder="设备AppID（自动生成）"
            prefix-icon="el-icon-mobile-phone"
            size="large"
            :disabled="loading"
            readonly
          >
            <template slot="append">
              <el-button 
                @click="regenerateAppId" 
                :disabled="loading"
                icon="el-icon-refresh"
                title="重新生成AppID"
              >
                重新生成
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            :disabled="!loginForm.userID.trim()"
            class="login-button"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-tips">
        <p>提示：</p>
        <ul>
          <li>首次使用会自动注册账号</li>
          <li>输入任意用户ID即可开始聊天</li>
          <li>可以尝试输入：10001, 10002, 10003 等</li>
        </ul>
      </div>
      
      <div class="quick-login">
        <p>快速登录：</p>
        <div class="quick-buttons">
          <el-button 
            v-for="id in quickLoginIds" 
            :key="id"
            size="small" 
            @click="quickLogin(id)"
            :disabled="loading"
          >
            用户{{ id }}
          </el-button>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; 2024 GoWebSocket IM - 基于Go + Vue2的即时通讯系统</p>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import { generateUserId, generateAppId } from '@/utils/helpers'
import webSocketService from '@/services/websocket'
import { WS_URL } from '@/utils/constants'

export default {
  name: 'LoginPage',
  data() {
    return {
      loginForm: {
        userID: '',
        appID: ''
      },
      loginRules: {
        userID: [
          { required: true, message: '请输入用户ID', trigger: 'blur' },
          { min: 3, max: 20, message: '用户ID长度在 3 到 20 个字符', trigger: 'blur' }
        ],
        appID: [
          { required: true, message: 'AppID不能为空', trigger: 'blur' }
        ]
      },
      quickLoginIds: [10001, 10002, 10003, 10004, 10005]
    }
  },
  computed: {
    ...mapGetters('auth', ['loginLoading']),
    loading() {
      return this.loginLoading
    }
  },
  mounted() {
    // 如果已经登录，直接跳转
    if (this.$store.getters['auth/isLoggedIn']) {
      this.$router.push('/chat')
    }
    
    // 自动生成一个用户ID作为默认值
    this.loginForm.userID = generateUserId().toString()
    // 自动生成AppID
    this.loginForm.appID = generateAppId()
  },
  methods: {
    ...mapActions('auth', ['login']),
    
    /**
     * 处理用户登录
     */
    async handleLogin() {
      try {
        // 表单验证
        await this.$refs.loginForm.validate()
        
        // 执行登录
        const result = await this.login({
          userID: this.loginForm.userID.trim(),
          appID: this.loginForm.appID
        })
        
        if (result.success) {
          this.$message.success(
            result.isNewUser ? '注册并登录成功！' : '登录成功！'
          )
          
          // 登录成功后自动连接WebSocket
          try {
            await webSocketService.connect(
              WS_URL, 
              this.$store.state.auth.token // 只传递token
            )
            console.log('WebSocket连接成功')
          } catch (wsError) {
            console.error('WebSocket连接失败:', wsError)
            // WebSocket连接失败不影响登录流程
          }
          
          // 跳转到聊天室
          const redirect = this.$route.query.redirect || '/chat'
          this.$router.push(redirect)
        } else {
          this.$message.error(result.error || '登录失败')
        }
      } catch (error) {
        console.error('登录失败:', error)
      }
    },
    
    /**
     * 快速登录
     * @param {number} userID - 用户ID
     */
    quickLogin(userID) {
      this.loginForm.userID = userID.toString()
      this.handleLogin()
    },
    
    /**
     * 重新生成AppID
     */
    regenerateAppId() {
      this.loginForm.appID = generateAppId()
      this.$message.success('AppID已重新生成')
    }
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-header {
  margin-bottom: 30px;
  
  h1 {
    color: #303133;
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  p {
    color: #909399;
    font-size: 14px;
  }
}

.login-form {
  margin-bottom: 30px;
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  border-radius: 6px;
}

.login-tips {
  text-align: left;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
  
  p {
    font-weight: 500;
    color: #606266;
    margin-bottom: 8px;
  }
  
  ul {
    list-style: none;
    padding: 0;
    
    li {
      color: #909399;
      font-size: 13px;
      line-height: 1.6;
      position: relative;
      padding-left: 16px;
      margin-bottom: 4px;
      
      &:before {
        content: '•';
        color: #409EFF;
        position: absolute;
        left: 0;
      }
    }
  }
}

.quick-login {
  text-align: left;
  
  p {
    font-weight: 500;
    color: #606266;
    margin-bottom: 12px;
    font-size: 14px;
  }
  
  .quick-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    .el-button {
      flex: 1;
      min-width: 0;
    }
  }
}

.footer {
  margin-top: 30px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  text-align: center;
}

// 响应式设计
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
    margin: 0 10px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
}
</style>