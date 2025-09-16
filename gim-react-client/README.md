# GIM React 客户端

基于React和TypeScript开发的即时通讯客户端，用于连接gim即时通讯服务器。

## 🚀 功能特性

- **设备注册与管理** - 自动注册Web设备，支持多设备同时在线
- **用户认证** - 手机号验证码登录，安全可靠
- **实时通讯** - WebSocket长连接，支持单聊、群聊和房间聊天
- **离线消息同步** - 自动同步离线消息，确保不丢失任何信息
- **消息持久化** - 本地存储聊天记录，支持离线浏览
- **响应式设计** - 适配桌面和移动端设备

## 📋 系统要求

- Node.js 18.20+ (推荐20+)
- npm 8.0+
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+)

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: React Context + useReducer
- **HTTP客户端**: Fetch API
- **WebSocket**: 原生WebSocket API
- **消息编解码**: Protocol Buffers
- **样式**: CSS3 + CSS Modules
- **测试**: Vitest + React Testing Library

## 📦 快速开始

### 1. 安装依赖

```bash
cd gim-react-client
npm install
```

### 2. 配置服务器地址

编辑 `src/App.tsx` 文件，修改服务器地址：

```typescript
const API_BASE_URL = 'http://localhost:8080'; // gim HTTP API地址
const WEBSOCKET_URL = 'ws://localhost:8002/ws'; // gim WebSocket地址
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:5173 启动。

### 4. 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist` 目录。

## 🏗️ 项目结构

```
src/
├── api/                    # API客户端
│   └── client.ts          # HTTP API封装
├── components/            # React组件
│   ├── LoginForm.tsx      # 登录表单
│   ├── ChatRoom.tsx       # 聊天室
│   ├── ConversationListComponent.tsx  # 对话列表
│   └── *.css             # 组件样式
├── contexts/              # React上下文
│   ├── AuthContext.tsx    # 认证上下文
│   └── IMContext.tsx      # IM通讯上下文
├── types/                 # TypeScript类型定义
│   └── index.ts          # 所有类型定义
├── utils/                 # 工具函数
│   ├── protocol.ts       # 协议编解码
│   ├── storage.ts        # 本地存储管理
│   └── websocket.ts      # WebSocket管理
├── tests/                 # 测试文件
│   └── App.test.tsx      # 集成测试
├── App.tsx               # 主应用组件
└── main.tsx              # 应用入口
```

## 🔧 核心功能说明

### 认证流程

1. **设备注册**: 首次使用时自动注册Web设备，获取设备ID
2. **用户登录**: 使用手机号和验证码登录
3. **Token管理**: 自动管理用户Token，支持自动续期
4. **状态持久化**: 登录状态本地存储，刷新页面保持登录

### 通讯机制

1. **WebSocket连接**: 自动建立和维护WebSocket长连接
2. **心跳保持**: 定时发送心跳包，确保连接活跃
3. **断线重连**: 网络断开时自动重连，支持指数退避
4. **消息队列**: 离线时缓存消息，连接恢复后自动发送

### 消息处理

1. **消息编解码**: 使用Protocol Buffers进行消息编解码
2. **消息类型**: 支持文本、图片、语音等多种消息类型
3. **离线同步**: 自动同步离线期间的消息
4. **已读状态**: 支持消息已读状态管理

## 📱 使用说明

### 登录

1. 打开应用，输入11位手机号
2. 点击"获取验证码"（当前为演示版本，可使用任意验证码）
3. 输入验证码，点击"登录"

### 聊天

1. 登录成功后进入聊天界面
2. 左侧显示对话列表，右侧为聊天区域
3. 点击对话开始聊天，输入消息后按回车或点击发送
4. 支持表情符号和多行文本

### 功能按钮

- **退出登录**: 点击右上角用户名旁的"退出登录"按钮
- **新建对话**: 点击对话列表右上角的"✏️"按钮
- **清除缓存**: 开发模式下可使用右下角的开发工具

## 🧪 测试

### 运行单元测试

```bash
npm run test
```

### 运行集成测试

```bash
npm run test:integration
```

### 测试覆盖率

```bash
npm run test:coverage
```

## 🔌 API接口

### 用户认证

- `POST /api/user/sign_in` - 用户登录
- `GET /api/user/:id` - 获取用户信息
- `PUT /api/user/update` - 更新用户信息

### 设备管理

- `POST /api/device/save` - 注册设备

### WebSocket协议

- `ws://server/ws` - WebSocket连接地址
- 支持SIGN_IN、HEARTBEAT、SUBSCRIBE_ROOM等命令

## 🐛 已知问题

1. **消息重复**: 网络不稳定时可能出现消息重复发送
2. **离线消息**: 大量离线消息同步时可能影响性能
3. **文件上传**: 当前版本暂不支持文件上传功能

## 🤝 开发贡献

### 开发环境搭建

1. Fork项目到你的GitHub账号
2. 克隆代码到本地
3. 安装依赖: `npm install`
4. 启动开发服务器: `npm run dev`
5. 开始开发并提交Pull Request

### 代码规范

- 使用TypeScript严格模式
- 遵循React Hooks最佳实践
- 组件使用函数式组件 + Hooks
- CSS使用BEM命名规范
- 提交信息使用conventional commits格式

### 调试技巧

1. **开发工具**: 开发模式下右下角有调试面板
2. **浏览器控制台**: 查看WebSocket连接和消息日志
3. **本地存储**: 使用浏览器开发者工具查看localStorage
4. **网络面板**: 监控API请求和WebSocket通信

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙋‍♂️ 常见问题

### Q: 登录失败怎么办？
A: 检查服务器地址配置，确保gim服务器正常运行。开发模式下可使用任意手机号和验证码。

### Q: WebSocket连接失败？
A: 检查WebSocket地址配置，确保gim connect服务正常运行在8002端口。

### Q: 消息发送失败？
A: 确保WebSocket连接正常，检查网络连接和服务器状态。

### Q: 如何清除所有数据？
A: 可以使用开发工具的"清除缓存"功能，或手动清除浏览器localStorage。

## 📞 技术支持

如有问题请提交Issue或联系开发团队。

---

*本项目基于gim即时通讯服务器开发，为Web端提供完整的即时通讯解决方案。*