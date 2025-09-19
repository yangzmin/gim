# WebSocket 聊天功能使用说明

## 概述

本系统已完善WebSocket聊天功能，支持文字和音频消息的发送与接收。音频格式支持PCM 16k流式传输。

## 消息类型

### 1. 文字消息
- 消息类型：`text`
- 内容格式：字符串

### 2. 音频消息
- 消息类型：`audio`
- 音频格式：`pcm_16k`（PCM 16kHz采样率）
- 内容格式：Base64编码的音频数据

## WebSocket 连接

连接地址：`ws://localhost:8089/acc`

## 消息协议

所有WebSocket消息都使用以下JSON格式：

```json
{
  "seq": "消息唯一ID",
  "cmd": "命令类型",
  "data": "具体数据"
}
```

## 支持的命令

### 1. 用户登录 (login)

```json
{
  "seq": "login_001",
  "cmd": "login",
  "data": {
    "serviceToken": "JWT_TOKEN_HERE"
  }
}
```

### 2. 心跳 (heartbeat)

```json
{
  "seq": "heartbeat_001",
  "cmd": "heartbeat",
  "data": {
    "userID": "user123"
  }
}
```

### 3. 发送聊天消息 (sendMessage)

#### 发送文字消息

```json
{
  "seq": "msg_001",
  "cmd": "sendMessage",
  "data": {
    "toUserID": "target_user_id",
    "messageType": "text",
    "content": "Hello, this is a text message!",
    "timestamp": 1640995200
  }
}
```

#### 发送音频消息

```json
{
  "seq": "msg_002",
  "cmd": "sendMessage",
  "data": {
    "toUserID": "target_user_id",
    "messageType": "audio",
    "content": "BASE64_ENCODED_AUDIO_DATA",
    "audioFormat": "pcm_16k",
    "timestamp": 1640995200
  }
}
```

### 4. 发送音频消息 (sendAudioMessage)

专门用于音频消息的发送：

```json
{
  "seq": "audio_001",
  "cmd": "sendAudioMessage",
  "data": {
    "toUserID": "target_user_id",
    "audioData": "BASE64_ENCODED_AUDIO_DATA",
    "audioFormat": "pcm_16k",
    "duration": 5000,
    "timestamp": 1640995200
  }
}
```

## 响应格式

服务器响应格式：

```json
{
  "seq": "对应请求的seq",
  "cmd": "对应请求的cmd",
  "code": 200,
  "msg": "Success",
  "data": {
    "messageID": "msg_001",
    "toUserID": "target_user_id",
    "messageType": "text",
    "timestamp": 1640995200,
    "status": "sent"
  }
}
```

## 错误码

- `200`: 成功
- `1000`: 未登录
- `1001`: 参数不合法
- `1003`: 未授权
- `1004`: 系统错误
- `1011`: 用户不在线

## 使用流程

1. **建立WebSocket连接**
   ```javascript
   const ws = new WebSocket('ws://localhost:8089/acc');
   ```

2. **用户登录**
   发送login命令进行身份验证

3. **发送消息**
   使用sendMessage或sendAudioMessage命令发送消息

4. **接收消息**
   监听WebSocket消息事件接收其他用户发送的消息

## 示例代码

### JavaScript 客户端示例

```javascript
// 建立连接
const ws = new WebSocket('ws://localhost:8089/acc');

// 连接成功
ws.onopen = function() {
    console.log('WebSocket连接已建立');
    
    // 登录
    ws.send(JSON.stringify({
        seq: 'login_' + Date.now(),
        cmd: 'login',
        data: {
            serviceToken: 'YOUR_JWT_TOKEN'
        }
    }));
};

// 接收消息
ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log('收到消息:', message);
};

// 发送文字消息
function sendTextMessage(toUserID, content) {
    ws.send(JSON.stringify({
        seq: 'msg_' + Date.now(),
        cmd: 'sendMessage',
        data: {
            toUserID: toUserID,
            messageType: 'text',
            content: content,
            timestamp: Math.floor(Date.now() / 1000)
        }
    }));
}

// 发送音频消息
function sendAudioMessage(toUserID, audioData) {
    ws.send(JSON.stringify({
        seq: 'audio_' + Date.now(),
        cmd: 'sendAudioMessage',
        data: {
            toUserID: toUserID,
            audioData: audioData, // Base64编码的PCM数据
            audioFormat: 'pcm_16k',
            duration: 3000, // 音频时长（毫秒）
            timestamp: Math.floor(Date.now() / 1000)
        }
    }));
}
```

## 注意事项

1. **音频格式**：目前仅支持PCM 16kHz采样率格式
2. **用户认证**：发送消息前必须先完成登录认证
3. **目标用户**：只能向在线用户发送消息
4. **消息大小**：建议单条消息不超过1MB
5. **连接保持**：建议定期发送心跳消息保持连接活跃

## 测试建议

1. 使用WebSocket测试工具（如Postman、wscat）进行基础功能测试
2. 创建多个客户端连接测试消息收发
3. 测试音频数据的编码解码功能
4. 验证错误处理和异常情况