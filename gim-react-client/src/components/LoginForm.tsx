// 登录表单组件
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginForm.css';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { state, login, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim() || !code.trim()) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const response = await login(phoneNumber.trim(), code.trim());
      console.log('登录成功:', response);
      onLoginSuccess?.();
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 只允许数字
    if (value.length <= 11) {
      setPhoneNumber(value);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 只允许数字
    if (value.length <= 6) {
      setCode(value);
    }
  };

  const isFormValid = phoneNumber.length === 11 && code.length >= 4;

  return (
    <div className="login-form-container">
      <div className="login-form">
        <h2 className="login-title">登录 GIM</h2>
        <p className="login-subtitle">使用手机号和验证码登录</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="phoneNumber" className="form-label">
              手机号
            </label>
            <input
              id="phoneNumber"
              type="tel"
              className="form-input"
              placeholder="请输入手机号"
              value={phoneNumber}
              onChange={handlePhoneChange}
              disabled={isSubmitting || state.isLoading}
              maxLength={11}
            />
          </div>

          <div className="form-group">
            <label htmlFor="code" className="form-label">
              验证码
            </label>
            <div className="code-input-group">
              <input
                id="code"
                type="text"
                className="form-input"
                placeholder="请输入验证码"
                value={code}
                onChange={handleCodeChange}
                disabled={isSubmitting || state.isLoading}
                maxLength={6}
              />
              <button
                type="button"
                className="get-code-btn"
                disabled={phoneNumber.length !== 11 || isSubmitting}
                onClick={() => {
                  // TODO: 实现获取验证码功能
                  console.log('获取验证码:', phoneNumber);
                }}
              >
                获取验证码
              </button>
            </div>
          </div>

          {state.error && (
            <div className="error-message">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={!isFormValid || isSubmitting || state.isLoading}
          >
            {isSubmitting || state.isLoading ? (
              <span className="loading-spinner">登录中...</span>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="login-tips">
          <p>提示：当前为演示版本，可使用任意手机号和验证码登录</p>
        </div>
      </div>
    </div>
  );
};