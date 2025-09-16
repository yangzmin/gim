// HTTP API 客户端
import type { 
  LoginRequest, 
  LoginResponse, 
  Device, 
  DeviceSaveRequest,
  User,
  ApiResponse
} from '../types';
import { DeviceType } from '../types';

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.timeout = config.timeout || 10000;
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(
          `HTTP error! status: ${response.status}`,
          response.status
        );
      }

      const apiResponse: ApiResponse<T> = await response.json();
      
      // 添加调试日志
      console.log(`API ${endpoint} response:`, apiResponse);
      
      // 检查API响应状态码
      if (apiResponse.code !== 0) {
        throw new ApiError(
          apiResponse.message || 'Request failed',
          response.status,
          apiResponse.code.toString()
        );
      }
      
      return apiResponse.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout');
        }
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(error.message);
      }
      throw new ApiError('Unknown error occurred');
    }
  }

  // 设备注册
  async registerDevice(device: Omit<Device, 'id'>): Promise<{ deviceId: number }> {
    const request: DeviceSaveRequest = {
      device: {
        id: 0, // 新设备ID为0
        ...device
      }
    };

    const response = await this.request<{ device_id: number }>('/api/device/save', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    // 返回的是device_id，但函数签名要求返回deviceId，所以转换一下
    return { deviceId: response.device_id };
  }

  // 用户登录
  async signIn(loginRequest: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/user/sign_in', {
      method: 'POST',
      body: JSON.stringify(loginRequest),
    });
  }

  // 获取用户信息
  async getUser(userId: number, deviceId: number, token: string): Promise<User> {
    return this.request<User>(`/api/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId.toString(),
        'X-Device-Id': deviceId.toString()
      },
    });
  }

  // 更新用户信息
  async updateUser(user: Partial<User>, userId: number, deviceId: number, token: string): Promise<void> {
    return this.request<void>('/api/user/update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId.toString(),
        'X-Device-Id': deviceId.toString()
      },
      body: JSON.stringify(user),
    });
  }

  // 搜索用户
  async searchUser(keyword: string, userId: number, deviceId: number, token: string): Promise<User[]> {
    return this.request<User[]>(`/api/user/search?key=${encodeURIComponent(keyword)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId.toString(),
        'X-Device-Id': deviceId.toString()
      },
    });
  }
}

// 默认API客户端实例
export const createApiClient = (config: ApiConfig): ApiClient => {
  return new ApiClient(config);
};

// 获取浏览器名称
function getBrowserName(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

// 获取浏览器版本
function getBrowserVersion(userAgent: string): string {
  const patterns = [
    /Chrome\/(\d+)/,
    /Firefox\/(\d+)/,
    /Safari\/(\d+)/,
    /Edge\/(\d+)/,
    /Opera\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = userAgent.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return 'Unknown';
}

// 获取操作系统
function getOperatingSystem(platform: string, userAgent: string): string {
  if (platform.includes('Win')) return 'Windows';
  if (platform.includes('Mac')) return 'macOS';
  if (platform.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}

// 设备信息工具函数
export const createDeviceInfo = (): Omit<Device, 'id'> => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  return {
    type: DeviceType.DT_WEB,
    brand: getBrowserName(userAgent),
    model: getBrowserVersion(userAgent),
    systemVersion: getOperatingSystem(platform, userAgent),
    sdkVersion: '1.0.0',
    branchPushId: ''
  };
};

// API错误处理
export class ApiError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public details?: any;
  
  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

// 重试机制
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i === maxRetries) {
        throw lastError;
      }

      // 指数退避
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }

  throw lastError!;
};