// 主应用组件
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { IMProvider } from './contexts/IMContext';
import { LoginForm } from './components/LoginForm';
import { ConversationList } from './components/ConversationListComponent';
import { ChatRoom } from './components/ChatRoom';
import './App.css';

// 应用配置
const API_BASE_URL = 'http://localhost:8080'; // gim HTTP API地址
const WEBSOCKET_URL = 'ws://localhost:8002/ws'; // gim WebSocket地址

// 主聊天界面组件
const ChatApp: React.FC = () => {
  const { state: authState, logout } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');

  const handleLogout = () => {
    logout();
    setSelectedConversationId('');
  };

  if (!authState.isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <IMProvider websocketUrl={WEBSOCKET_URL}>
      <div className="chat-app">
        {/* 应用头部 */}
        <div className="app-header">
          <div className="app-title">
            <h1>GIM 即时通讯</h1>
          </div>
          <div className="app-user-info">
            <span className="user-name">
              {authState.user?.nickname || `用户${authState.user?.user_id}`}
            </span>
            <button className="logout-btn" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>

        {/* 主聊天区域 */}
        <div className="chat-container">
          {/* 左侧对话列表 */}
          <div className="sidebar">
            <ConversationList
              selectedConversationId={selectedConversationId}
              onConversationSelect={setSelectedConversationId}
            />
          </div>

          {/* 右侧聊天区域 */}
          <div className="main-content">
            <ChatRoom conversationId={selectedConversationId} />
          </div>
        </div>

        {/* 开发工具（仅开发环境显示） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="dev-tools">
            <div className="dev-panel">
              <h4>开发工具</h4>
              <div className="dev-actions">
                <button
                  onClick={() => {
                    // 模拟接收消息
                    console.log('模拟接收消息');
                  }}
                >
                  模拟消息
                </button>
                <button
                  onClick={() => {
                    // 清除本地存储
                    localStorage.clear();
                    window.location.reload();
                  }}
                >
                  清除缓存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </IMProvider>
  );
};

// 根应用组件
const App: React.FC = () => {
  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      <ChatApp />
    </AuthProvider>
  );
};

export default App;