// 聊天室组件
import React, { useState, useRef, useEffect } from 'react';
import { useIM, useMessages } from '../contexts/IMContext';
import { useAuth } from '../contexts/AuthContext';
import type { Message } from '../types';
import './ChatRoom.css';

interface ChatRoomProps {
  conversationId?: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ conversationId }) => {
  const { state: imState, sendMessage, selectConversation } = useIM();
  const { state: authState } = useAuth();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useMessages(conversationId);
  const currentConversation = imState.messages.conversations.find(
    conv => conv.id === conversationId
  );

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 选择对话时标记为已读
  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId);
    }
  }, [conversationId, selectConversation]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !imState.isConnected) {
      return;
    }

    if (!currentConversation) {
      console.error('没有选择对话');
      return;
    }

    try {
      const isGroupChat = currentConversation.type === 'group';
      sendMessage(
        inputMessage.trim(),
        isGroupChat ? undefined : currentConversation.targetId,
        isGroupChat ? currentConversation.targetId : undefined
      );
      setInputMessage('');
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const isMyMessage = (message: Message): boolean => {
    return message.fromUserId === authState.user?.userId;
  };

  if (!conversationId) {
    return (
      <div className="chat-room-empty">
        <div className="empty-state">
          <h3>选择一个对话开始聊天</h3>
          <p>从左侧选择一个联系人或群组开始对话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-room">
      {/* 聊天头部 */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h3 className="chat-title">{currentConversation?.name || '未知对话'}</h3>
          <div className="chat-status">
            <span className={`status-indicator ${imState.isConnected ? 'connected' : 'disconnected'}`} />
            {imState.isConnected ? '在线' : '离线'}
          </div>
        </div>
        <div className="chat-actions">
          <button className="action-btn" title="更多选项">
            ⋯
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="messages-container">
        <div className="messages-list">
          {Array.isArray(messages) && messages.length > 0 ? (
            (messages as Message[]).map((message: Message) => (
              <div
                key={message.id}
                className={`message ${isMyMessage(message) ? 'message-sent' : 'message-received'}`}
              >
                <div className="message-content">
                  <div className="message-bubble">
                    <div className="message-text">{message.content}</div>
                  </div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-messages">
              <p>还没有消息，开始对话吧！</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 消息输入框 */}
      <div className="message-input-container">
        <form onSubmit={handleSendMessage} className="message-input-form">
          <div className="input-wrapper">
            <input
              type="text"
              className="message-input"
              placeholder={imState.isConnected ? "输入消息..." : "未连接服务器"}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!imState.isConnected}
              maxLength={1000}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!inputMessage.trim() || !imState.isConnected}
              title="发送消息"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};