// 对话列表组件
import React from 'react';
import { useIM } from '../contexts/IMContext';
import type { Conversation } from '../types';
import './ConversationList.css';

interface ConversationListProps {
  selectedConversationId?: string;
  onConversationSelect: (conversationId: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  selectedConversationId,
  onConversationSelect,
}) => {
  const { state } = useIM();

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24);
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
  };

  const truncateMessage = (content: string, maxLength: number = 30): string => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  };

  const getConversationIcon = (conversation: Conversation): string => {
    switch (conversation.type) {
      case 'group':
        return '👥';
      case 'room':
        return '🏠';
      case 'user':
      default:
        return '👤';
    }
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2 className="conversation-list-title">消息</h2>
        <div className="conversation-list-actions">
          <button className="new-chat-btn" title="新建对话">
            ✏️
          </button>
        </div>
      </div>

      <div className="conversation-list-content">
        {state.messages.conversations.length > 0 ? (
          <div className="conversations">
            {state.messages.conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  selectedConversationId === conversation.id ? 'active' : ''
                }`}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <div className="conversation-avatar">
                  <span className="avatar-icon">
                    {getConversationIcon(conversation)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <div className="unread-badge">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </div>
                  )}
                </div>

                <div className="conversation-content">
                  <div className="conversation-header">
                    <h3 className="conversation-name">{conversation.name}</h3>
                    <span className="conversation-time">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </div>
                  
                  <div className="conversation-preview">
                    <span className="last-message">
                      {conversation.lastMessage 
                        ? truncateMessage(conversation.lastMessage.content)
                        : '暂无消息'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-conversations">
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>暂无对话</h3>
              <p>点击右上角开始新的对话</p>
            </div>
          </div>
        )}
      </div>

      <div className="conversation-list-footer">
        <div className="connection-status">
          <span className={`status-dot ${state.isConnected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {state.isConnected ? '已连接' : '连接中...'}
          </span>
        </div>
      </div>
    </div>
  );
};