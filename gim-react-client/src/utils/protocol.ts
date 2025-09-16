// Protocol Buffers 消息编解码工具
import type { 
  ProtocolMessage, 
  SignInRequest, 
  SubscribeRoomRequest, 
  Reply
} from '../types';
import { Command } from '../types';

export class ProtocolHandler {
  private static instance: ProtocolHandler;

  static getInstance(): ProtocolHandler {
    if (!ProtocolHandler.instance) {
      ProtocolHandler.instance = new ProtocolHandler();
    }
    return ProtocolHandler.instance;
  }

  // 生成请求ID
  generateRequestId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // 编码登录消息
  encodeSignInMessage(userId: number, deviceId: number, token: string): ArrayBuffer {
    const signInRequest: SignInRequest = {
      userId,
      deviceId,
      token
    };

    const message: ProtocolMessage = {
      requestId: this.generateRequestId(),
      command: Command.SIGN_IN,
      content: this.encodeSignInRequest(signInRequest),
      seq: 0,
      createdAt: Date.now(),
      roomId: 0
    };

    return this.encodeMessage(message);
  }

  // 编码心跳消息
  encodeHeartbeatMessage(): ArrayBuffer {
    const message: ProtocolMessage = {
      requestId: this.generateRequestId(),
      command: Command.HEARTBEAT,
      content: new Uint8Array(),
      seq: 0,
      createdAt: Date.now(),
      roomId: 0
    };

    return this.encodeMessage(message);
  }

  // 编码订阅房间消息
  encodeSubscribeRoomMessage(roomId: number): ArrayBuffer {
    const subscribeRequest: SubscribeRoomRequest = {
      roomId
    };

    const message: ProtocolMessage = {
      requestId: this.generateRequestId(),
      command: Command.SUBSCRIBE_ROOM,
      content: this.encodeSubscribeRoomRequest(subscribeRequest),
      seq: 0,
      createdAt: Date.now(),
      roomId
    };

    return this.encodeMessage(message);
  }

  // 解码消息
  decodeMessage(buffer: ArrayBuffer): ProtocolMessage {
    const view = new DataView(buffer);
    let offset = 0;

    // 读取请求ID长度和内容
    const requestIdLength = view.getUint32(offset, true);
    offset += 4;
    const requestIdBytes = new Uint8Array(buffer, offset, requestIdLength);
    const requestId = new TextDecoder().decode(requestIdBytes);
    offset += requestIdLength;

    // 读取命令
    const command = view.getUint32(offset, true) as Command;
    offset += 4;

    // 读取内容长度和内容
    const contentLength = view.getUint32(offset, true);
    offset += 4;
    const content = new Uint8Array(buffer, offset, contentLength);
    offset += contentLength;

    // 读取序列号
    const seq = this.readUint64(view, offset);
    offset += 8;

    // 读取创建时间
    const createdAt = this.readUint64(view, offset);
    offset += 8;

    // 读取房间ID
    const roomId = this.readUint64(view, offset);

    return {
      requestId,
      command,
      content,
      seq,
      createdAt,
      roomId
    };
  }

  // 解码回复消息
  decodeReply(content: Uint8Array): Reply {
    const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
    let offset = 0;

    // 读取错误码
    const code = view.getInt32(offset, true);
    offset += 4;

    // 读取消息长度和内容
    const messageLength = view.getUint32(offset, true);
    offset += 4;
    const messageBytes = new Uint8Array(content.buffer, content.byteOffset + offset, messageLength);
    const message = new TextDecoder().decode(messageBytes);
    offset += messageLength;

    // 读取数据长度和内容
    const dataLength = view.getUint32(offset, true);
    offset += 4;
    const data = new Uint8Array(content.buffer, content.byteOffset + offset, dataLength);

    return {
      code,
      message,
      data
    };
  }

  // 编码完整消息
  private encodeMessage(message: ProtocolMessage): ArrayBuffer {
    const requestIdBytes = new TextEncoder().encode(message.requestId);
    const totalLength = 4 + requestIdBytes.length + 4 + 4 + message.content.length + 8 + 8 + 8;
    
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);
    let offset = 0;

    // 写入请求ID长度和内容
    view.setUint32(offset, requestIdBytes.length, true);
    offset += 4;
    new Uint8Array(buffer, offset, requestIdBytes.length).set(requestIdBytes);
    offset += requestIdBytes.length;

    // 写入命令
    view.setUint32(offset, message.command, true);
    offset += 4;

    // 写入内容长度和内容
    view.setUint32(offset, message.content.length, true);
    offset += 4;
    new Uint8Array(buffer, offset, message.content.length).set(message.content);
    offset += message.content.length;

    // 写入序列号
    this.writeUint64(view, offset, message.seq);
    offset += 8;

    // 写入创建时间
    this.writeUint64(view, offset, message.createdAt);
    offset += 8;

    // 写入房间ID
    this.writeUint64(view, offset, message.roomId);

    return buffer;
  }

  // 编码登录请求
  private encodeSignInRequest(request: SignInRequest): Uint8Array {
    const tokenBytes = new TextEncoder().encode(request.token);
    const length = 8 + 8 + 4 + tokenBytes.length;
    
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let offset = 0;

    // 用户ID
    this.writeUint64(view, offset, request.userId);
    offset += 8;

    // 设备ID
    this.writeUint64(view, offset, request.deviceId);
    offset += 8;

    // Token长度和内容
    view.setUint32(offset, tokenBytes.length, true);
    offset += 4;
    new Uint8Array(buffer, offset, tokenBytes.length).set(tokenBytes);

    return new Uint8Array(buffer);
  }

  // 编码订阅房间请求
  private encodeSubscribeRoomRequest(request: SubscribeRoomRequest): Uint8Array {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    this.writeUint64(view, 0, request.roomId);
    return new Uint8Array(buffer);
  }

  // 写入64位无符号整数
  private writeUint64(view: DataView, offset: number, value: number): void {
    view.setUint32(offset, value & 0xFFFFFFFF, true);
    view.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
  }

  // 读取64位无符号整数
  private readUint64(view: DataView, offset: number): number {
    const low = view.getUint32(offset, true);
    const high = view.getUint32(offset + 4, true);
    return high * 0x100000000 + low;
  }
}