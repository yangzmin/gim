// Protocol Buffers 消息编解码工具 - 使用 protobufjs
import { Root, Type, Enum, Field } from 'protobufjs';
import type { 
  ProtocolMessage, 
  SignInRequest as WSSignInRequest, 
  SubscribeRoomRequest, 
  Reply,
  Command
} from '../types';

export interface ConnectProto {
  Message: Type;
  Reply: Type;
  SignInRequest: Type;
  SubscribeRoomRequest: Type;
  Command: Enum;
}

export class ProtocolBufferHandler {
  private static instance: ProtocolBufferHandler;
  private proto: ConnectProto | null = null;
  private isInitialized = false;

  static getInstance(): ProtocolBufferHandler {
    if (!ProtocolBufferHandler.instance) {
      ProtocolBufferHandler.instance = new ProtocolBufferHandler();
    }
    return ProtocolBufferHandler.instance;
  }

  // 初始化protobuf定义
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 在浏览器环境中，我们需要从字符串或对象加载proto定义
      // 由于无法直接加载.proto文件，我们手动定义消息类型
      const root = new Root();
      
      // 定义Command枚举
      const commandEnum = new Enum('Command', {
        'UNKNOWN': 0,
        'SIGN_IN': 1, 
        'HEARTBEAT': 2,
        'SUBSCRIBE_ROOM': 3,
        'USER_MESSAGE': 100,
        'GROUP_MESSAGE': 101
      });
      root.add(commandEnum);

      // 定义Message类型
      const messageType = new Type('Message');
      messageType.add(new Field('requestId', 1, 'string'));
      messageType.add(new Field('command', 2, 'Command'));
      messageType.add(new Field('content', 3, 'bytes'));
      messageType.add(new Field('seq', 4, 'uint64'));
      messageType.add(new Field('createdAt', 5, 'int64'));
      messageType.add(new Field('roomId', 6, 'uint64'));
      root.add(messageType);

      // 定义Reply类型
      const replyType = new Type('Reply');
      replyType.add(new Field('code', 1, 'int32'));
      replyType.add(new Field('message', 2, 'string'));
      replyType.add(new Field('data', 3, 'bytes'));
      root.add(replyType);

      // 定义SignInRequest类型
      const signInRequestType = new Type('SignInRequest');
      signInRequestType.add(new Field('userId', 1, 'uint64'));
      signInRequestType.add(new Field('deviceId', 2, 'uint64'));
      signInRequestType.add(new Field('token', 3, 'string'));
      root.add(signInRequestType);

      // 定义SubscribeRoomRequest类型
      const subscribeRoomRequestType = new Type('SubscribeRoomRequest');
      subscribeRoomRequestType.add(new Field('roomId', 1, 'uint64'));
      root.add(subscribeRoomRequestType);

      // 解析根对象
      root.resolveAll();

      this.proto = {
        Message: messageType,
        Reply: replyType,
        SignInRequest: signInRequestType,
        SubscribeRoomRequest: subscribeRoomRequestType,
        Command: commandEnum
      };

      this.isInitialized = true;
      console.log('Protocol Buffers definitions loaded successfully');
    } catch (error) {
      console.error('Failed to load protocol definitions:', error);
      throw error;
    }
  }

  // 确保已初始化
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.proto) {
      throw new Error('ProtocolBufferHandler not initialized. Call init() first.');
    }
  }

  // 生成请求ID
  generateRequestId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // 编码登录消息
  encodeSignInMessage(userId: number, deviceId: number, token: string): ArrayBuffer {
    this.ensureInitialized();

    const signInRequest = this.proto!.SignInRequest.create({
      userId: userId.toString(), // 使用字符串避免精度丢失
      deviceId: deviceId.toString(),
      token
    });
    const signInContent = this.proto!.SignInRequest.encode(signInRequest).finish();

    const message = this.proto!.Message.create({
      requestId: this.generateRequestId(),
      command: 1, // SIGN_IN
      content: signInContent,
      seq: 0,
      createdAt: Date.now(),
      roomId: 0
    });

    const encoded = this.proto!.Message.encode(message).finish();
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  }

  // 编码心跳消息
  encodeHeartbeatMessage(): ArrayBuffer {
    this.ensureInitialized();

    const message = this.proto!.Message.create({
      requestId: this.generateRequestId(),
      command: 2, // HEARTBEAT
      content: new Uint8Array(),
      seq: 0,
      createdAt: Date.now(),
      roomId: 0
    });

    const encoded = this.proto!.Message.encode(message).finish();
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  }

  // 编码订阅房间消息
  encodeSubscribeRoomMessage(roomId: number): ArrayBuffer {
    this.ensureInitialized();

    const subscribeRequest = this.proto!.SubscribeRoomRequest.create({
      roomId: roomId.toString() // 使用字符串避免精度丢失
    });
    const subscribeContent = this.proto!.SubscribeRoomRequest.encode(subscribeRequest).finish();

    const message = this.proto!.Message.create({
      requestId: this.generateRequestId(),
      command: 3, // SUBSCRIBE_ROOM
      content: subscribeContent,
      seq: 0,
      createdAt: Date.now(),
      roomId: roomId.toString()
    });

    const encoded = this.proto!.Message.encode(message).finish();
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  }

  // 解码消息
  decodeMessage(buffer: ArrayBuffer): ProtocolMessage {
    this.ensureInitialized();

    try {
      const message = this.proto!.Message.decode(new Uint8Array(buffer));
      
      return {
        requestId: (message as any).requestId as string,
        command: (message as any).command as Command,
        content: new Uint8Array((message as any).content as Uint8Array),
        seq: this.parseBigInt((message as any).seq),
        createdAt: this.parseBigInt((message as any).createdAt),
        roomId: this.parseBigInt((message as any).roomId)
      };
    } catch (error) {
      console.error('Failed to decode message:', error);
      throw error;
    }
  }

  // 解码回复消息
  decodeReply(content: Uint8Array): Reply {
    this.ensureInitialized();

    try {
      const reply = this.proto!.Reply.decode(content);
      
      return {
        code: (reply as any).code as number,
        message: (reply as any).message as string,
        data: new Uint8Array((reply as any).data as Uint8Array)
      };
    } catch (error) {
      console.error('Failed to decode reply:', error);
      throw error;
    }
  }

  // 解码登录请求内容
  decodeSignInRequest(content: Uint8Array): WSSignInRequest {
    this.ensureInitialized();

    try {
      const signInRequest = this.proto!.SignInRequest.decode(content);
      
      return {
        userId: this.parseBigInt((signInRequest as any).userId),
        deviceId: this.parseBigInt((signInRequest as any).deviceId),
        token: (signInRequest as any).token as string
      };
    } catch (error) {
      console.error('Failed to decode SignInRequest:', error);
      throw error;
    }
  }

  // 解码订阅房间请求内容
  decodeSubscribeRoomRequest(content: Uint8Array): SubscribeRoomRequest {
    this.ensureInitialized();

    try {
      const subscribeRequest = this.proto!.SubscribeRoomRequest.decode(content);
      
      return {
        roomId: this.parseBigInt((subscribeRequest as any).roomId)
      };
    } catch (error) {
      console.error('Failed to decode SubscribeRoomRequest:', error);
      throw error;
    }
  }

  // 辅助方法：安全解析BigInt/Long类型为number
  private parseBigInt(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    if (value && typeof value.toNumber === 'function') {
      return value.toNumber();
    }
    if (value && typeof value.toString === 'function') {
      return parseInt(value.toString(), 10);
    }
    return 0;
  }

  // 检查是否已初始化
  isReady(): boolean {
    return this.isInitialized && this.proto !== null;
  }
}