# GIM React客户端 - 使用示例

本文档提供了如何集成和使用GIM React客户端的详细示例。

## 基础集成示例

### 1. 简单集成

最简单的集成方式，直接使用提供的组件：

```jsx
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { IMProvider } from './contexts/IMContext';
import { LoginForm } from './components/LoginForm';
import { ChatRoom } from './components/ChatRoom';
import { useAuth } from './contexts/AuthContext';

const API_BASE_URL = 'http://your-gim-server:8080';
const WEBSOCKET_URL = 'ws://your-gim-server:8002/ws';

function SimpleApp() {
  const { state } = useAuth();
  
  return (
    <div>
      {state.isAuthenticated ? (
        <IMProvider websocketUrl={WEBSOCKET_URL}>
          <ChatRoom />
        </IMProvider>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      <SimpleApp />
    </AuthProvider>
  );
}
```

### 2. 自定义登录界面

如果你想自定义登录界面：

```jsx
import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';

function CustomLoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const { login, state } = useAuth();

  const handleLogin = async () => {
    try {
      await login(phone, code);
      console.log('登录成功');
    } catch (error) {
      console.error('登录失败:', error);
    }
  };

  return (
    <div className="custom-login">
      <h1>欢迎使用我的应用</h1>
      <input 
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="手机号"
      />
      <input 
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="验证码"
      />
      <button 
        onClick={handleLogin}
        disabled={state.isLoading}
      >
        {state.isLoading ? '登录中...' : '登录'}
      </button>
      {state.error && <p style={{color: 'red'}}>{state.error}</p>}
    </div>
  );
}
```

### 3. 消息监听和处理

监听新消息并进行自定义处理：

```jsx
import React, { useEffect } from 'react';
import { useIM } from './contexts/IMContext';

function MessageHandler() {
  const { state, sendMessage } = useIM();

  useEffect(() => {
    // 监听连接状态变化
    console.log('连接状态:', state.connectionStatus);
  }, [state.connectionStatus]);

  useEffect(() => {
    // 监听新消息
    const conversations = state.messages.conversations;
    if (conversations.length > 0) {
      const latestConversation = conversations[0];
      if (latestConversation.lastMessage) {
        console.log('收到新消息:', latestConversation.lastMessage);
        
        // 可以在这里添加自定义逻辑，比如:
        // - 显示桌面通知
        // - 播放提示音
        // - 更新页面标题
        showNotification(latestConversation.lastMessage);
      }
    }
  }, [state.messages.conversations]);

  const showNotification = (message) => {
    if (Notification.permission === 'granted') {
      new Notification('新消息', {
        body: message.content,
        icon: '/icon.png'
      });
    }
  };

  const handleSendMessage = () => {
    sendMessage('Hello, World!', 123); // 发送给用户ID为123的用户
  };

  return (
    <div>
      <button onClick={handleSendMessage}>发送测试消息</button>
      <p>连接状态: {state.isConnected ? '已连接' : '未连接'}</p>
      <p>未读消息数: {state.messages.unreadCount}</p>
    </div>
  );
}
```

## 高级功能示例

### 1. 房间聊天

加入和离开聊天房间：

```jsx
import React, { useState } from 'react';
import { useIM } from './contexts/IMContext';

function RoomChat() {
  const [roomId, setRoomId] = useState('');
  const { subscribeRoom, unsubscribeRoom, sendMessage, state } = useIM();

  const joinRoom = () => {
    if (roomId) {
      subscribeRoom(parseInt(roomId));
    }
  };

  const leaveRoom = () => {
    unsubscribeRoom();
  };

  const sendRoomMessage = (content) => {
    if (state.currentRoomId) {
      sendMessage(content, undefined, state.currentRoomId);
    }
  };

  return (
    <div>
      <input 
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="房间ID"
      />
      <button onClick={joinRoom}>加入房间</button>
      <button onClick={leaveRoom}>离开房间</button>
      
      <p>当前房间: {state.currentRoomId || '未加入房间'}</p>
      
      <button onClick={() => sendRoomMessage('大家好!')}>
        发送房间消息
      </button>
    </div>
  );
}
```

### 2. 离线消息同步

处理离线消息同步：

```jsx
import React, { useEffect } from 'react';
import { useIM } from './contexts/IMContext';
import { LocalStorageManager } from './utils/storage';

function OfflineMessageSync() {
  const { syncOfflineMessages, state } = useIM();
  const storage = new LocalStorageManager();

  useEffect(() => {
    const handleSync = async () => {
      if (state.isConnected) {
        const lastSeq = storage.getLastSeq();
        try {
          const offlineMessages = await syncOfflineMessages(lastSeq);
          console.log('同步到离线消息:', offlineMessages.length, '条');
          
          if (offlineMessages.length > 0) {
            // 更新最新的序列号
            const maxSeq = Math.max(...offlineMessages.map(msg => msg.seq));
            storage.saveLastSeq(maxSeq);
          }
        } catch (error) {
          console.error('离线消息同步失败:', error);
        }
      }
    };

    handleSync();
  }, [state.isConnected]);

  return null; // 这是一个功能组件，不需要渲染UI
}
```

### 3. 消息状态管理

自定义消息状态和已读管理：

```jsx
import React from 'react';
import { useIM, useMessages } from './contexts/IMContext';

function ConversationManager() {
  const { markAsRead, selectConversation } = useIM();
  const conversations = useMessages();

  const handleConversationClick = (conversationId) => {
    selectConversation(conversationId);
    markAsRead(conversationId);
  };

  return (
    <div>
      <h3>对话列表</h3>
      {conversations.map(conversation => (
        <div 
          key={conversation.id}
          onClick={() => handleConversationClick(conversation.id)}
          style={{
            padding: '10px',
            cursor: 'pointer',
            backgroundColor: conversation.unreadCount > 0 ? '#f0f0f0' : 'white'
          }}
        >
          <strong>{conversation.name}</strong>
          {conversation.unreadCount > 0 && (
            <span style={{color: 'red'}}>({conversation.unreadCount})</span>
          )}
          <br />
          <small>{conversation.lastMessage?.content}</small>
        </div>
      ))}
    </div>
  );
}
```

## 工具函数示例

### 1. 设备信息管理

```jsx
import { createDeviceInfo } from './api/client';
import { LocalStorageManager } from './utils/storage';

const storage = new LocalStorageManager();

// 获取或创建设备信息
export const getDeviceInfo = () => {
  let deviceInfo = storage.getDeviceInfo();
  if (!deviceInfo) {
    deviceInfo = {
      id: 0,
      ...createDeviceInfo()
    };
    storage.saveDeviceInfo(deviceInfo);
  }
  return deviceInfo;
};

// 检查设备是否已注册
export const isDeviceRegistered = () => {
  const deviceId = storage.getDeviceId();
  return deviceId !== null;
};
```

### 2. 协议处理工具

```jsx
import { ProtocolHandler } from './utils/protocol';

const protocolHandler = ProtocolHandler.getInstance();

// 创建自定义消息
export const createCustomMessage = (type, content) => {
  return {
    requestId: protocolHandler.generateRequestId(),
    command: type,
    content: new TextEncoder().encode(JSON.stringify(content)),
    seq: 0,
    createdAt: Date.now(),
    roomId: 0
  };
};

// 解析消息内容
export const parseMessageContent = (message) => {
  try {
    const contentStr = new TextDecoder().decode(message.content);
    return JSON.parse(contentStr);
  } catch (error) {
    return { text: contentStr };
  }
};
```

### 3. 错误处理

```jsx
import React from 'react';

class IMErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('IM组件错误:', error, errorInfo);
    
    // 可以发送错误报告到服务器
    // sendErrorReport(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>连接出现问题</h2>
          <p>请刷新页面重试</p>
          <button onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用方式
function App() {
  return (
    <IMErrorBoundary>
      <AuthProvider apiBaseUrl={API_BASE_URL}>
        <YourApp />
      </AuthProvider>
    </IMErrorBoundary>
  );
}
```

## 性能优化示例

### 1. 消息列表虚拟化

对于大量消息的性能优化：

```jsx
import React, { useMemo } from 'react';
import { useMessages } from './contexts/IMContext';

function VirtualizedMessageList({ conversationId }) {
  const messages = useMessages(conversationId);
  
  // 只渲染最近的100条消息
  const recentMessages = useMemo(() => {
    return messages.slice(-100);
  }, [messages]);

  return (
    <div className="message-list">
      {recentMessages.map(message => (
        <div key={message.id} className="message-item">
          {message.content}
        </div>
      ))}
    </div>
  );
}
```

### 2. 连接状态缓存

避免频繁的状态更新：

```jsx
import React, { useRef, useCallback } from 'react';
import { useIM } from './contexts/IMContext';

function OptimizedConnectionIndicator() {
  const { state } = useIM();
  const lastStatus = useRef(state.connectionStatus);
  
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'disconnected': return 'red';
      default: return 'gray';
    }
  }, []);

  // 只在状态真正改变时更新
  if (lastStatus.current !== state.connectionStatus) {
    lastStatus.current = state.connectionStatus;
  }

  return (
    <div style={{ color: getStatusColor(lastStatus.current) }}>
      {lastStatus.current}
    </div>
  );
}
```

这些示例展示了如何在实际项目中集成和使用GIM React客户端，可以根据具体需求进行调整和扩展。