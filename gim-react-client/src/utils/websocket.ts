// WebSocket 管理器
import type { ProtocolMessage, ConnectionStatus } from '../types';
import { ProtocolHandler } from '../utils/protocol';
import { ProtocolBufferHandler } from '../utils/protobuf';
import { Command } from '../types';

export interface WebSocketConfig {
  url: string;
  heartbeatInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type MessageHandler = (message: ProtocolMessage) => void;
export type ConnectionHandler = (status: ConnectionStatus) => void;
export type ErrorHandler = (error: Error) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private protocolHandler: ProtocolHandler;
  private protobufHandler: ProtocolBufferHandler;
  
  // 状态管理
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private isManualClose = false;
  
  // 定时器
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // 事件处理器
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  
  // 消息队列（未连接时缓存）
  private messageQueue: ArrayBuffer[] = [];
  private isSignedIn = false;
  
  // Protocol Buffers支持
  private useProtobuf = true;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      heartbeatInterval: config.heartbeatInterval || 5 * 60 * 1000, // 5分钟
      reconnectInterval: config.reconnectInterval || 3000, // 3秒
      maxReconnectAttempts: config.maxReconnectAttempts || 5
    };
    
    this.protocolHandler = ProtocolHandler.getInstance();
    this.protobufHandler = ProtocolBufferHandler.getInstance();
  }

  // 连接WebSocket
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isManualClose = false;
    this.setConnectionStatus('connecting');
    
    // 初始化Protocol Buffers处理器
    if (this.useProtobuf && !this.protobufHandler.isReady()) {
      try {
        await this.protobufHandler.init();
        console.log('Protocol Buffers handler initialized');
      } catch (error) {
        console.error('Failed to initialize Protocol Buffers handler:', error);
        // 回退到自定义协议处理器
        this.useProtobuf = false;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        this.ws.binaryType = 'arraybuffer';
        
        this.ws.onopen = () => {
          console.log('WebSocket连接已建立');
          this.setConnectionStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data as ArrayBuffer);
        };

        this.ws.onclose = (event: CloseEvent) => {
          console.log('WebSocket连接已关闭', event.code, event.reason);
          this.stopHeartbeat();
          this.setConnectionStatus('disconnected');
          
          if (!this.isManualClose) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event: Event) => {
          console.error('WebSocket连接错误:', event);
          const error = new Error('WebSocket connection error');
          this.handleError(error);
          reject(error);
        };

        // 连接超时处理
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleError(err);
        reject(err);
      }
    });
  }

  // 手动断开连接
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.setConnectionStatus('disconnected');
    this.isSignedIn = false;
  }

  // 发送登录消息
  async signIn(userId: number, deviceId: number, token: string): Promise<void> {
    const message = this.useProtobuf 
      ? this.protobufHandler.encodeSignInMessage(userId, deviceId, token)
      : this.protocolHandler.encodeSignInMessage(userId, deviceId, token);
    await this.sendMessage(message);
    this.isSignedIn = true;
  }

  // 发送心跳
  sendHeartbeat(): void {
    const message = this.useProtobuf 
      ? this.protobufHandler.encodeHeartbeatMessage()
      : this.protocolHandler.encodeHeartbeatMessage();
    this.sendMessage(message);
  }

  // 订阅房间
  subscribeRoom(roomId: number): void {
    const message = this.useProtobuf 
      ? this.protobufHandler.encodeSubscribeRoomMessage(roomId)
      : this.protocolHandler.encodeSubscribeRoomMessage(roomId);
    this.sendMessage(message);
  }

  // 发送消息
  async sendMessage(message: ArrayBuffer): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      // 如果未连接，将消息加入队列
      this.messageQueue.push(message);
      
      // 尝试重连
      if (this.connectionStatus === 'disconnected') {
        await this.connect();
      }
    }
  }

  // 获取连接状态
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // 是否已连接
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  // 是否已登录
  isAuthenticated(): boolean {
    return this.isSignedIn && this.isConnected();
  }

  // 事件监听器
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  // 内部方法

  private handleMessage(buffer: ArrayBuffer): void {
    try {
      const message = this.useProtobuf 
        ? this.protobufHandler.decodeMessage(buffer)
        : this.protocolHandler.decodeMessage(buffer);
      
      console.log('收到消息:', message);
      
      // 处理Reply消息
      if (message.content && message.content.length > 0) {
        try {
          const reply = this.useProtobuf 
            ? this.protobufHandler.decodeReply(message.content)
            : this.protocolHandler.decodeReply(message.content);
          
          if (reply.code !== 0) {
            console.error('服务器返回错误:', reply.code, reply.message);
            this.handleError(new Error(`Server error: ${reply.message}`));
            return;
          }
        } catch (error) {
          // 如果不是Reply消息，忽略解码错误
          console.debug('非标准Reply消息，继续处理');
        }
      }
      
      // 处理不同类型的消息
      switch (message.command) {
        case Command.SIGN_IN:
          this.handleSignInReply(message);
          break;
        case Command.HEARTBEAT:
          this.handleHeartbeatReply(message);
          break;
        case Command.SUBSCRIBE_ROOM:
          this.handleSubscribeRoomReply(message);
          break;
        case Command.USER_MESSAGE:
        case Command.GROUP_MESSAGE:
          this.handleIncomingMessage(message);
          break;
        default:
          console.warn('未知消息类型:', message.command);
      }
      
      // 通知消息处理器
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('消息处理器错误:', error);
        }
      });
    } catch (error) {
      console.error('消息解码失败:', error);
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // 处理登录响应
  private handleSignInReply(message: ProtocolMessage): void {
    console.log('登录响应:', message);
    // 可以在这里处理特定的登录逻辑
  }

  // 处理心跳响应
  private handleHeartbeatReply(message: ProtocolMessage): void {
    console.log('心跳响应:', message);
    // 更新最后心跳时间
  }

  // 处理订阅房间响应
  private handleSubscribeRoomReply(message: ProtocolMessage): void {
    console.log('订阅房间响应:', message);
  }

  // 处理入站消息
  private handleIncomingMessage(message: ProtocolMessage): void {
    console.log('收到入站消息:', message);
    // 可以在这里解析具体的消息内容
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.connectionHandlers.forEach(handler => {
        try {
          handler(status);
        } catch (error) {
          console.error('连接状态处理器错误:', error);
        }
      });
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket错误:', error);
    this.setConnectionStatus('error');
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('错误处理器错误:', err);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && this.isSignedIn) {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连');
      this.setConnectionStatus('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`${this.config.reconnectInterval}ms后进行第${this.reconnectAttempts}次重连`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('重连失败:', error);
      });
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws!.send(message);
      }
    }
  }

  // 设置是否使用Protocol Buffers
  setUseProtobuf(useProtobuf: boolean): void {
    this.useProtobuf = useProtobuf;
  }

  // 获取当前协议处理器类型
  getProtocolType(): string {
    return this.useProtobuf ? 'protobuf' : 'custom';
  }

  // 销毁实例
  destroy(): void {
    this.disconnect();
    this.messageHandlers.length = 0;
    this.connectionHandlers.length = 0;
    this.errorHandlers.length = 0;
    this.messageQueue.length = 0;
  }
}