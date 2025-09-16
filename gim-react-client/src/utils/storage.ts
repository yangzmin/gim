// 本地存储管理器
import type { Device, User, Message } from '../types';

export class LocalStorageManager {
  private static readonly KEYS = {
    DEVICE_ID: 'gim_device_id',
    USER_TOKEN: 'gim_user_token',
    USER_ID: 'gim_user_id',
    USER_INFO: 'gim_user_info',
    LAST_SEQ: 'gim_last_seq',
    MESSAGES: 'gim_messages',
    DEVICE_INFO: 'gim_device_info'
  };

  // 设备相关
  saveDeviceId(deviceId: string): void {
    localStorage.setItem(LocalStorageManager.KEYS.DEVICE_ID, deviceId);
  }

  getDeviceId(): string | null {
    return localStorage.getItem(LocalStorageManager.KEYS.DEVICE_ID);
  }

  saveDeviceInfo(device: Device): void {
    localStorage.setItem(LocalStorageManager.KEYS.DEVICE_INFO, JSON.stringify(device));
  }

  getDeviceInfo(): Device | null {
    const deviceStr = localStorage.getItem(LocalStorageManager.KEYS.DEVICE_INFO);
    return deviceStr ? JSON.parse(deviceStr) : null;
  }

  // 认证相关
  saveAuthInfo(userId: number, token: string, user?: User): void {
    // 添加参数验证，防止undefined或null值
    if (userId === undefined || userId === null || token === undefined || token === null) {
      console.error('saveAuthInfo: Invalid parameters', { userId, token });
      throw new Error('Invalid userId or token provided');
    }
    
    localStorage.setItem(LocalStorageManager.KEYS.USER_ID, userId.toString());
    localStorage.setItem(LocalStorageManager.KEYS.USER_TOKEN, token);
    if (user) {
      localStorage.setItem(LocalStorageManager.KEYS.USER_INFO, JSON.stringify(user));
    }
  }

  getAuthInfo(): { userId: number; token: string; user?: User } | null {
    const userId = localStorage.getItem(LocalStorageManager.KEYS.USER_ID);
    const token = localStorage.getItem(LocalStorageManager.KEYS.USER_TOKEN);
    const userStr = localStorage.getItem(LocalStorageManager.KEYS.USER_INFO);

    if (userId && token) {
      return {
        userId: parseInt(userId),
        token,
        user: userStr ? JSON.parse(userStr) : undefined
      };
    }
    return null;
  }

  clearAuthInfo(): void {
    localStorage.removeItem(LocalStorageManager.KEYS.USER_ID);
    localStorage.removeItem(LocalStorageManager.KEYS.USER_TOKEN);
    localStorage.removeItem(LocalStorageManager.KEYS.USER_INFO);
  }

  // 消息序列号相关
  saveLastSeq(seq: number): void {
    localStorage.setItem(LocalStorageManager.KEYS.LAST_SEQ, seq.toString());
  }

  getLastSeq(): number {
    const seq = localStorage.getItem(LocalStorageManager.KEYS.LAST_SEQ);
    return seq ? parseInt(seq) : 0;
  }

  // 消息缓存相关
  saveMessages(conversationId: string, messages: Message[]): void {
    const allMessages = this.getAllMessages();
    allMessages[conversationId] = messages;
    localStorage.setItem(LocalStorageManager.KEYS.MESSAGES, JSON.stringify(allMessages));
  }

  getMessages(conversationId: string): Message[] {
    const allMessages = this.getAllMessages();
    return allMessages[conversationId] || [];
  }

  getAllMessages(): { [conversationId: string]: Message[] } {
    const messagesStr = localStorage.getItem(LocalStorageManager.KEYS.MESSAGES);
    return messagesStr ? JSON.parse(messagesStr) : {};
  }

  addMessage(conversationId: string, message: Message): void {
    const messages = this.getMessages(conversationId);
    messages.push(message);
    this.saveMessages(conversationId, messages);
  }

  clearMessages(): void {
    localStorage.removeItem(LocalStorageManager.KEYS.MESSAGES);
  }

  // 清除所有数据
  clearAll(): void {
    Object.values(LocalStorageManager.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // 获取存储使用情况
  getStorageInfo(): { used: number; available: number } {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('gim_')) {
        used += localStorage.getItem(key)?.length || 0;
      }
    }

    // 大概估算可用空间 (5MB 限制)
    const available = 5 * 1024 * 1024 - used;
    
    return { used, available };
  }
}