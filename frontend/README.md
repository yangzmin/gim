# GoWebSocket IM 前端 (Vue2重构版)

这是GoWebSocket IM系统的Vue2前端重构版本，提供现代化的用户界面和更好的用户体验。

## 项目特性

- **🎨 现代化UI**: 基于Element UI的美观界面设计
- **📱 响应式设计**: 支持桌面端和移动端
- **⚡ 实时通讯**: WebSocket长连接，消息实时同步
- **🔒 用户认证**: 完整的登录认证和权限管理
- **👥 好友管理**: 好友添加、删除、在线状态显示
- **💬 聊天功能**: 私人聊天、消息历史、未读计数
- **🔄 自动重连**: 网络断开自动重连机制
- **📦 组件化**: 模块化组件设计，易于维护

## 技术栈

- **框架**: Vue 2.6+
- **状态管理**: Vuex 3.x
- **路由**: Vue Router 3.x
- **UI组件**: Element UI 2.x
- **HTTP客户端**: Axios
- **构建工具**: Vue CLI / Webpack
- **样式**: SCSS/SASS
- **WebSocket**: 原生WebSocket API

## 项目结构

```
frontend/
├── public/                 # 静态资源
├── src/
│   ├── components/         # 组件
│   │   ├── common/        # 通用组件
│   │   ├── chat/          # 聊天相关组件
│   │   ├── friend/        # 好友相关组件
│   │   └── user/          # 用户相关组件
│   ├── views/             # 页面组件
│   ├── store/             # Vuex状态管理
│   │   └── modules/       # Store模块
│   ├── services/          # 服务层
│   ├── utils/             # 工具函数
│   ├── styles/            # 样式文件
│   └── router/            # 路由配置
├── package.json
└── vue.config.js
```

## 快速开始

### 环境要求

- Node.js 14+
- npm 6+
- 后端服务已启动 (Go WebSocket服务)

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run serve
```

应用将在 http://localhost:3000 启动

### 生产构建

```bash
npm run build
```

构建文件将输出到 `dist/` 目录

## 功能说明

### 1. 用户登录
- 输入用户ID即可登录
- 首次登录自动注册账号
- 支持快速登录按钮

### 2. 聊天功能
- 实时消息收发
- 消息历史记录
- 未读消息提醒
- 在线状态显示

### 3. 好友管理
- 添加/删除好友
- 好友列表展示
- 在线/离线状态
- 好友搜索功能

### 4. 系统特性
- 自动断线重连
- 消息队列机制
- 响应式布局
- 错误处理

## API接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 好友接口
- `GET /api/friend/list` - 获取好友列表
- `POST /api/friend/add` - 添加好友
- `DELETE /api/friend/:friendID` - 删除好友

### 消息接口
- `GET /api/message/history` - 获取聊天记录
- `POST /api/message/send` - 发送消息
- `PUT /api/message/read` - 标记已读
- `GET /api/message/unread` - 获取未读统计

## WebSocket消息格式

### 登录
```json
{
  "seq": "unique_id",
  "cmd": "login",
  "data": {
    "userID": "10001",
    "appID": 101
  }
}
```

### 发送消息
```json
{
  "seq": "unique_id", 
  "cmd": "msg",
  "data": {
    "from": "10001",
    "to": "10002", 
    "msg": "Hello"
  }
}
```

### 心跳
```json
{
  "seq": "unique_id",
  "cmd": "heartbeat",
  "data": {}
}
```

## 配置

### 开发环境配置
在 `vue.config.js` 中配置代理：

```javascript
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
}
```

### 环境变量
- `NODE_ENV` - 环境模式 (development/production)
- `BASE_URL` - 基础路径

## 开发指南

### 添加新功能
1. 在 `src/components/` 下创建组件
2. 在 `src/store/modules/` 下添加状态管理
3. 在 `src/services/` 下添加API调用
4. 更新路由配置

### 样式规范
- 使用SCSS编写样式
- 遵循BEM命名规范
- 使用CSS变量统一主题

### 代码规范
- 使用ESLint进行代码检查
- 遵循Vue官方编码规范
- 组件名使用PascalCase

## 故障排除

### 常见问题

1. **连接失败**
   - 检查后端服务是否启动
   - 确认WebSocket地址配置正确
   - 检查防火墙设置

2. **登录失败**
   - 确认后端API服务正常
   - 检查Redis连接状态
   - 查看浏览器控制台错误信息

3. **消息收发异常**
   - 检查WebSocket连接状态
   - 确认用户认证信息
   - 查看网络连接

### 调试技巧
- 使用Vue DevTools调试组件状态
- 查看浏览器控制台WebSocket连接日志
- 使用Network面板检查API请求

## 部署

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /acc {
        proxy_pass http://127.0.0.1:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 贡献

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 发起Pull Request

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-01-01)
- ✨ 完成Vue2重构
- ✨ 实现用户认证系统
- ✨ 添加好友管理功能
- ✨ 完善聊天功能
- ✨ 集成WebSocket连接管理
- ✨ 响应式界面设计