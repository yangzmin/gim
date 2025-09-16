// Protocol Buffers 枚举和接口定义 - 与服务端保持一致

// API统一响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

// WebSocket命令枚举 - 与connect.ext.proto一致
export const Command = {
  UNKNOWN: 0,        // 未知
  SIGN_IN: 1,        // 设备登录请求
  HEARTBEAT: 2,      // 心跳
  SUBSCRIBE_ROOM: 3, // 订阅房间
  USER_MESSAGE: 100, // 用户消息
  GROUP_MESSAGE: 101 // 群组消息
} as const;

export type Command = typeof Command[keyof typeof Command];

// 设备类型枚举 - 与logic/device.int.proto一致
export const DeviceType = {
  DT_DEFAULT: 0,  // 默认
  DT_ANDROID: 1,  // Android
  DT_IOS: 2,      // iOS
  DT_WINDOWS: 3,  // Windows
  DT_MACOS: 4,    // macOS
  DT_WEB: 5       // Web浏览器
} as const;

export type DeviceType = typeof DeviceType[keyof typeof DeviceType];

// WebSocket协议消息结构 - 与connect.ext.proto一致
export interface ProtocolMessage {
  requestId: string;  // request_id - 请求ID
  command: Command;   // command - 指令类型
  content: Uint8Array; // content - 数据内容
  seq: number;        // seq - 消息序列号 (uint64)
  createdAt: number;  // created_at - 消息时间戳 (int64)
  roomId: number;     // room_id - 房间ID (uint64)
}

// WebSocket登录请求 - 与connect.ext.proto一致
export interface SignInRequest {
  user_id: number;     // user_id - 用户ID (uint64)
  device_id: number;   // device_id - 设备ID (uint64)
  token: string;      // token - 认证令牌
}

// WebSocket订阅房间请求 - 与connect.ext.proto一致
export interface SubscribeRoomRequest {
  room_id: number;     // room_id - 房间ID (uint64)
}

// WebSocket响应消息 - 与connect.ext.proto一致
export interface Reply {
  code: number;       // code - 错误码 (int32)
  message: string;    // message - 错误信息
  data: Uint8Array;   // data - 数据
}

// 设备信息结构 - 与logic/device.int.proto一致
export interface Device {
  id: number;             // id - 设备ID (uint64)
  type: DeviceType;       // type - 设备类型
  brand: string;          // brand - 手机厂商
  model: string;          // model - 机型
  systemVersion: string;  // system_version - 系统版本
  sdkVersion: string;     // sdk_version - SDK版本
  branchPushId: string;   // branch_push_id - 推送ID
}

// 用户信息结构 - 与business/user.ext.proto一致
export interface User {
  user_id: number;       // user_id - 用户ID (uint64)
  nickname: string;     // nickname - 昵称
  sex: number;          // sex - 性别 (int32)
  avatar_url: string;    // avatar_url - 头像地址
  extra: string;        // extra - 附加字段
  create_time: number;   // create_time - 创建时间 (int64)
  update_time: number;   // update_time - 更新时间 (int64)
}

// HTTP API请求响应结构 - 与business/user.ext.proto一致

// 用户登录请求
export interface LoginRequest {
  phone_number: string;  // phone_number - 手机号
  code: string;         // code - 验证码
  device: Device;       // device - 设备信息
}

// 用户登录响应
export interface LoginResponse {
  is_new: boolean;     // is_new - 是否是新用户
  user_id: number;     // user_id - 用户ID (uint64)
  device_id: number;   // device_id - 设备ID (uint64)
  token: string;       // token - 认证令牌
}

// 设备注册请求 - 与logic/device.int.proto一致
export interface DeviceSaveRequest {
  device: Device;     // device - 设备信息
}

// 设备注册响应
export interface DeviceSaveResponse {
  device_id: number;   // device_id - 设备ID (uint64)
}

// 前端状态定义
export interface AuthState {
  user: User | null;
  deviceId: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface IMState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastHeartbeat: number;
  serverTime: number;
}

export interface Message {
  id: string;
  fromUserId: number;
  toUserId?: number;
  groupId?: number;
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video';
  timestamp: number;
  seq: number;
}

export interface Conversation {
  id: string;
  type: 'user' | 'group' | 'room';
  targetId: number;
  name: string;
  avatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: number;
}

export interface MessagesState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: { [conversationId: string]: Message[] };
  unreadCount: number;
  syncSeq: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type MessageCallback = (message: Message) => void;