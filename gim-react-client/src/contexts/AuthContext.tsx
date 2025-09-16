// 认证上下文
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginRequest, LoginResponse } from '../types';
import { createApiClient, createDeviceInfo } from '../api/client';
import { LocalStorageManager } from '../utils/storage';

// 认证状态接口
export interface AuthState {
  user: User | null;
  deviceId: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// 认证操作类型
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user?: User; deviceId: string; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: User };

// 认证上下文类型
interface AuthContextType {
  state: AuthState;
  login: (phoneNumber: string, code: string) => Promise<LoginResponse>;
  logout: () => void;
  registerDevice: () => Promise<string>;
  updateUser: (user: Partial<User>) => Promise<void>;
  clearError: () => void;
}

// 初始状态
const initialState: AuthState = {
  user: null,
  deviceId: null,
  token: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
};

// 状态reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        error: null,
        user: action.payload.user || null,
        deviceId: action.payload.deviceId,
        token: action.payload.token,
        isAuthenticated: true,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        isAuthenticated: false,
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialState,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };

    default:
      return state;
  }
};

// 创建上下文
const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider组件属性
interface AuthProviderProps {
  children: ReactNode;
  apiBaseUrl: string;
}

// AuthProvider组件
export const AuthProvider: React.FC<AuthProviderProps> = ({ children, apiBaseUrl }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const storageManager = new LocalStorageManager();
  const apiClient = createApiClient({ baseUrl: apiBaseUrl });

  // 组件挂载时检查本地存储的认证信息
  useEffect(() => {
    const checkAuth = async () => {
      const authInfo = storageManager.getAuthInfo();
      if (authInfo) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: authInfo.user,
            deviceId: authInfo.userId.toString(), // 临时使用userId作为deviceId
            token: authInfo.token,
          },
        });
      }
    };

    checkAuth();
  }, []);

  // 设备注册
  const registerDevice = async (): Promise<string> => {
    try {
      dispatch({ type: 'AUTH_START' });

      // 检查本地是否已有设备ID
      let deviceId = storageManager.getDeviceId();
      if (deviceId) {
        return deviceId;
      }

      // 创建设备信息
      const deviceInfo = createDeviceInfo();
      
      // 调用API注册设备
      const response = await apiClient.registerDevice(deviceInfo);
      deviceId = response.deviceId.toString();

      // 保存设备信息
      storageManager.saveDeviceId(deviceId);
      storageManager.saveDeviceInfo({
        id: response.deviceId,
        ...deviceInfo,
      });

      return deviceId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '设备注册失败';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 用户登录
  const login = async (phoneNumber: string, code: string): Promise<LoginResponse> => {
    try {
      dispatch({ type: 'AUTH_START' });

      // 确保设备已注册
      await registerDevice();
      const deviceInfo = storageManager.getDeviceInfo();
      
      if (!deviceInfo) {
        throw new Error('设备信息不存在');
      }

      // 构建登录请求
      const loginRequest: LoginRequest = {
        phone_number: phoneNumber,
        code,
        device: deviceInfo,
      };

      // 调用登录API
      const response = await apiClient.signIn(loginRequest);
      
      // 添加调试日志，检查响应数据
      console.log('Login API response:', response);
      
      // 验证响应数据格式
      if (!response || typeof response.user_id !== 'number' || !response.token) {
        console.error('Invalid login response format:', response);
        throw new Error('登录响应数据格式错误');
      }

      // 保存认证信息
      storageManager.saveAuthInfo(response.user_id, response.token);

      // 如果是新用户，获取用户信息
      let user: User | undefined;
      if (!response.is_new) {
        try {
          user = await apiClient.getUser(response.user_id, response.device_id, response.token);
          storageManager.saveAuthInfo(response.user_id, response.token, user);
        } catch (error) {
          console.warn('获取用户信息失败:', error);
        }
      }

      // 更新状态
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user,
          deviceId: response.device_id.toString(),
          token: response.token,
        },
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 用户登出
  const logout = (): void => {
    storageManager.clearAuthInfo();
    dispatch({ type: 'AUTH_LOGOUT' });
  };

  // 更新用户信息
  const updateUser = async (userUpdate: Partial<User>): Promise<void> => {
    if (!state.token || !state.deviceId || !state.user) {
      throw new Error('未登录');
    }

    try {
      dispatch({ type: 'AUTH_START' });

      await apiClient.updateUser(userUpdate, state.user.user_id, parseInt(state.deviceId), state.token);

      // 重新获取用户信息
      const updatedUser = await apiClient.getUser(state.user.user_id, parseInt(state.deviceId), state.token);
      storageManager.saveAuthInfo(state.user.user_id, state.token, updatedUser);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新用户信息失败';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 清除错误
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: AuthContextType = {
    state,
    login,
    logout,
    registerDevice,
    updateUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 高阶组件：需要认证的组件包装器
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { state } = useAuth();

    if (!state.isAuthenticated) {
      return <div>请先登录</div>;
    }

    return <Component {...props} />;
  };
};

// 认证守卫组件
interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback = <div>请先登录</div> 
}) => {
  const { state } = useAuth();
  
  return state.isAuthenticated ? <>{children}</> : <>{fallback}</>;
};