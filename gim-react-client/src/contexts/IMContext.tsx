// IM即时通讯上下文
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { 
  ConnectionStatus, 
  Message, 
  ProtocolMessage, 
  MessagesState,
  Conversation 
} from '../types';
import { Command } from '../types';
import type { WebSocketConfig } from '../utils/websocket';
import { WebSocketManager } from '../utils/websocket';
import { ProtocolHandler } from '../utils/protocol';
import { useAuth } from './AuthContext';

// IM状态接口
export interface IMState {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  lastHeartbeat: number;
  serverTime: number;
  messages: MessagesState;
  currentRoomId: number | null;
}

// IM操作类型
type IMAction =
  | { type: 'CONNECTION_STATUS_CHANGE'; payload: ConnectionStatus }
  | { type: 'HEARTBEAT_UPDATE'; payload: number }
  | { type: 'MESSAGE_RECEIVED'; payload: Message }
  | { type: 'MESSAGE_SENT'; payload: Message }
  | { type: 'CONVERSATION_SELECT'; payload: string }
  | { type: 'ROOM_SUBSCRIBE'; payload: number }
  | { type: 'MESSAGES_SYNC'; payload: { conversationId: string; messages: Message[] } }
  | { type: 'UNREAD_COUNT_UPDATE'; payload: { conversationId: string; count: number } }
  | { type: 'RESET' };

// IM上下文类型
interface IMContextType {
  state: IMState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (content: string, toUserId?: number, groupId?: number) => void;
  subscribeRoom: (roomId: number) => void;
  unsubscribeRoom: () => void;
  selectConversation: (conversationId: string) => void;
  syncOfflineMessages: (seq: number) => Promise<Message[]>;
  markAsRead: (conversationId: string) => void;
}

// 初始状态
const initialState: IMState = {
  isConnected: false,
  connectionStatus: 'disconnected',
  lastHeartbeat: 0,
  serverTime: 0,
  messages: {
    conversations: [],
    currentConversation: null,
    messages: {},
    unreadCount: 0,
    syncSeq: 0,
  },
  currentRoomId: null,
};

// 状态reducer
const imReducer = (state: IMState, action: IMAction): IMState => {
  switch (action.type) {
    case 'CONNECTION_STATUS_CHANGE':
      return {
        ...state,
        connectionStatus: action.payload,
        isConnected: action.payload === 'connected',
      };

    case 'HEARTBEAT_UPDATE':
      return {
        ...state,
        lastHeartbeat: action.payload,
      };

    case 'MESSAGE_RECEIVED': {
      const message = action.payload;
      const conversationId = message.groupId ? `group_${message.groupId}` : `user_${message.fromUserId}`;
      
      // 更新消息列表
      const existingMessages = state.messages.messages[conversationId] || [];
      const updatedMessages = [...existingMessages, message];
      
      // 更新对话列表
      const conversations = [...state.messages.conversations];
      let conversationIndex = conversations.findIndex(c => c.id === conversationId);
      
      if (conversationIndex === -1) {
        // 创建新对话
        const newConversation: Conversation = {
          id: conversationId,
          type: message.groupId ? 'group' : 'user',
          targetId: message.groupId || message.fromUserId,
          name: message.groupId ? `群组${message.groupId}` : `用户${message.fromUserId}`,
          lastMessage: message,
          unreadCount: state.messages.currentConversation === conversationId ? 0 : 1,
          updatedAt: message.timestamp,
        };
        conversations.push(newConversation);
      } else {
        // 更新现有对话
        const conversation = conversations[conversationIndex];
        conversations[conversationIndex] = {
          ...conversation,
          lastMessage: message,
          unreadCount: state.messages.currentConversation === conversationId 
            ? conversation.unreadCount 
            : conversation.unreadCount + 1,
          updatedAt: message.timestamp,
        };
      }

      // 按更新时间排序
      conversations.sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        ...state,
        messages: {
          ...state.messages,
          conversations,
          messages: {
            ...state.messages.messages,
            [conversationId]: updatedMessages,
          },
          syncSeq: Math.max(state.messages.syncSeq, message.seq),
          unreadCount: conversations.reduce((total, conv) => total + conv.unreadCount, 0),
        },
      };
    }

    case 'MESSAGE_SENT': {
      const message = action.payload;
      const conversationId = message.groupId ? `group_${message.groupId}` : `user_${message.toUserId}`;
      
      const existingMessages = state.messages.messages[conversationId] || [];
      const updatedMessages = [...existingMessages, message];

      return {
        ...state,
        messages: {
          ...state.messages,
          messages: {
            ...state.messages.messages,
            [conversationId]: updatedMessages,
          },
        },
      };
    }

    case 'CONVERSATION_SELECT':
      return {
        ...state,
        messages: {
          ...state.messages,
          currentConversation: action.payload,
        },
      };

    case 'ROOM_SUBSCRIBE':
      return {
        ...state,
        currentRoomId: action.payload,
      };

    case 'MESSAGES_SYNC': {
      const { conversationId, messages } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          messages: {
            ...state.messages.messages,
            [conversationId]: messages,
          },
        },
      };
    }

    case 'UNREAD_COUNT_UPDATE': {
      const { conversationId, count } = action.payload;
      const conversations = state.messages.conversations.map(conv => 
        conv.id === conversationId ? { ...conv, unreadCount: count } : conv
      );

      return {
        ...state,
        messages: {
          ...state.messages,
          conversations,
          unreadCount: conversations.reduce((total, conv) => total + conv.unreadCount, 0),
        },
      };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
};

// 创建上下文
const IMContext = createContext<IMContextType | null>(null);

// IMProvider组件属性
interface IMProviderProps {
  children: ReactNode;
  websocketUrl: string;
  config?: Partial<WebSocketConfig>;
}

// IMProvider组件
export const IMProvider: React.FC<IMProviderProps> = ({ 
  children, 
  websocketUrl, 
  config = {} 
}) => {
  const [state, dispatch] = useReducer(imReducer, initialState);
  const { state: authState } = useAuth();
  const protocolHandler = ProtocolHandler.getInstance();
  
  // WebSocket管理器实例（使用useCallback确保稳定引用）
  const wsManager = React.useMemo(() => 
    new WebSocketManager({
      url: websocketUrl,
      ...config,
    }), [websocketUrl, config]
  );

  // 消息处理器
  const handleMessage = useCallback((message: ProtocolMessage) => {
    console.log('处理收到的消息:', message);

    switch (message.command) {
      case Command.SIGN_IN:
        // 处理登录回复
        try {
          const reply = protocolHandler.decodeReply(message.content);
          if (reply.code === 0) {
            console.log('登录成功');
          } else {
            console.error('登录失败:', reply.message);
          }
        } catch (error) {
          console.error('解码登录回复失败:', error);
        }
        break;

      case Command.HEARTBEAT:
        dispatch({ type: 'HEARTBEAT_UPDATE', payload: Date.now() });
        break;

      case Command.USER_MESSAGE:
      case Command.GROUP_MESSAGE:
        // 处理接收到的消息
        try {
          // 这里需要根据实际的消息协议来解码
          const messageContent = new TextDecoder().decode(message.content);
          const receivedMessage: Message = {
            id: message.requestId,
            fromUserId: 0, // 需要从消息内容中解析
            toUserId: message.command === Command.USER_MESSAGE ? authState.user?.user_id : undefined,
            groupId: message.command === Command.GROUP_MESSAGE ? Number(message.roomId) : undefined,
            content: messageContent,
            messageType: 'text',
            timestamp: message.createdAt,
            seq: message.seq,
          };

          dispatch({ type: 'MESSAGE_RECEIVED', payload: receivedMessage });
        } catch (error) {
          console.error('解码消息失败:', error);
        }
        break;

      default:
        console.log('未处理的消息类型:', message.command);
    }
  }, [protocolHandler, authState.user?.user_id]);

  // 连接状态处理器
  const handleConnectionChange = useCallback((status: ConnectionStatus) => {
    dispatch({ type: 'CONNECTION_STATUS_CHANGE', payload: status });
  }, []);

  // 错误处理器
  const handleError = useCallback((error: Error) => {
    console.error('WebSocket错误:', error);
  }, []);

  // 设置WebSocket事件监听器
  useEffect(() => {
    const unsubscribeMessage = wsManager.onMessage(handleMessage);
    const unsubscribeConnection = wsManager.onConnectionChange(handleConnectionChange);
    const unsubscribeError = wsManager.onError(handleError);

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
      unsubscribeError();
    };
  }, [wsManager, handleMessage, handleConnectionChange, handleError]);

  // 自动连接（当用户认证后）
  useEffect(() => {
    console.log('Auth state changed:', {
      isAuthenticated: authState.isAuthenticated,
      hasUser: !!authState.user,
      hasToken: !!authState.token,
      hasDeviceId: !!authState.deviceId,
      isConnected: state.isConnected
    });
    
    if (authState.isAuthenticated && authState.user && authState.token && authState.deviceId && !state.isConnected) {
      console.log('开始连接IM服务...');
      connect().catch(error => {
        console.error('自动连接IM失败:', error);
      });
    } else if (!authState.isAuthenticated && state.isConnected) {
      console.log('用户未认证，断开IM连接');
      disconnect();
    }
  }, [authState.isAuthenticated, authState.user, authState.token, authState.deviceId, state.isConnected]);

  // 连接WebSocket
  const connect = async (): Promise<void> => {
    console.log('开始连接检查:', {
      isAuthenticated: authState.isAuthenticated,
      hasUser: !!authState.user,
      hasToken: !!authState.token,
      hasDeviceId: !!authState.deviceId,
      user: authState.user
    });
    
    if (!authState.isAuthenticated) {
      throw new Error('用户未认证：isAuthenticated 为 false');
    }
    
    if (!authState.user) {
      throw new Error('用户信息为空');
    }
    
    if (!authState.token) {
      throw new Error('认证token为空');
    }
    
    if (!authState.deviceId) {
      throw new Error('设备ID为空');
    }

    try {
      await wsManager.connect();
      
      // 发送登录消息
      console.log('发送登录消息:', {
        user_id: authState.user.user_id,
        device_id: authState.deviceId,
        token: authState.token
      });
      
      await wsManager.signIn(
        authState.user.user_id,
        parseInt(authState.deviceId),
        authState.token
      );

      console.log('IM连接建立成功');
    } catch (error) {
      console.error('IM连接失败:', error);
      throw error;
    }
  };

  // 断开连接
  const disconnect = (): void => {
    wsManager.disconnect();
    dispatch({ type: 'RESET' });
  };

  // 发送消息
  const sendMessage = (content: string, toUserId?: number, groupId?: number): void => {
    if (!state.isConnected) {
      throw new Error('未连接到服务器');
    }

    const message: Message = {
      id: Date.now().toString(),
      fromUserId: authState.user!.user_id,
      toUserId,
      groupId,
      content,
      messageType: 'text',
      timestamp: Date.now(),
      seq: 0, // 服务器会分配序列号
    };

    // 这里需要根据实际协议编码消息并发送
    // 暂时使用简单的文本消息
    // const encodedContent = new TextEncoder().encode(content);
    
    // 构建协议消息（简化版本）
    // TODO: 使用正确的消息编码发送
    // wsManager.sendMessage(encodedMessage);

    // 暂时直接更新本地状态
    dispatch({ type: 'MESSAGE_SENT', payload: message });
  };

  // 订阅房间
  const subscribeRoom = (roomId: number): void => {
    if (state.isConnected) {
      wsManager.subscribeRoom(roomId);
      dispatch({ type: 'ROOM_SUBSCRIBE', payload: roomId });
    }
  };

  // 取消订阅房间
  const unsubscribeRoom = (): void => {
    if (state.isConnected && state.currentRoomId) {
      wsManager.subscribeRoom(0); // roomId为0表示取消订阅
      dispatch({ type: 'ROOM_SUBSCRIBE', payload: 0 });
    }
  };

  // 选择对话
  const selectConversation = (conversationId: string): void => {
    dispatch({ type: 'CONVERSATION_SELECT', payload: conversationId });
    // 标记为已读
    markAsRead(conversationId);
  };

  // 同步离线消息
  const syncOfflineMessages = async (seq: number): Promise<Message[]> => {
    // TODO: 实现离线消息同步逻辑
    // 这里需要调用相应的API来获取离线消息
    console.log('同步离线消息，起始seq:', seq);
    return [];
  };

  // 标记为已读
  const markAsRead = (conversationId: string): void => {
    dispatch({ 
      type: 'UNREAD_COUNT_UPDATE', 
      payload: { conversationId, count: 0 } 
    });
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      wsManager.destroy();
    };
  }, [wsManager]);

  const contextValue: IMContextType = {
    state,
    connect,
    disconnect,
    sendMessage,
    subscribeRoom,
    unsubscribeRoom,
    selectConversation,
    syncOfflineMessages,
    markAsRead,
  };

  return (
    <IMContext.Provider value={contextValue}>
      {children}
    </IMContext.Provider>
  );
};

// useIM hook
export const useIM = (): IMContextType => {
  const context = useContext(IMContext);
  if (!context) {
    throw new Error('useIM must be used within an IMProvider');
  }
  return context;
};

// 连接状态Hook
export const useConnectionStatus = (): ConnectionStatus => {
  const { state } = useIM();
  return state.connectionStatus;
};

// 消息Hook
export const useMessages = (conversationId?: string) => {
  const { state } = useIM();
  
  if (conversationId) {
    return state.messages.messages[conversationId] || [];
  }
  
  return state.messages.conversations;
};