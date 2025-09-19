// Package websocket WebSocket控制器
package websocket

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/lib/cache"
	"github.com/link1st/gowebsocket/v2/lib/jwtlib"
	"github.com/link1st/gowebsocket/v2/models"
)

// PingController ping
func PingController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK
	fmt.Println("webSocket_request ping接口", client.Addr, seq, message)
	data = "pong"
	return
}

// LoginController 用户登录
func LoginController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK
	currentTime := uint64(time.Now().Unix())
	request := &models.Login{}
	if err := json.Unmarshal(message, request); err != nil {
		code = common.ParameterIllegal
		fmt.Println("用户登录 解析数据失败", seq, err)
		return
	}
	fmt.Println("webSocket_request 用户登录", seq, "ServiceToken", request.ServiceToken)

	// 验证JWT token
	if request.ServiceToken == "" {
		code = common.Unauthorized
		fmt.Println("用户登录 缺少token", seq)
		return
	}

	// 验证token有效性并解析用户信息
	claims, err := jwtlib.ValidateToken(request.ServiceToken)
	fmt.Println("claims", claims)
	if err != nil {
		code = common.Unauthorized
		fmt.Println("用户登录 token验证失败", seq, err)
		return
	}

	// 从token中获取用户信息
	userID := claims.UserID
	appID := claims.AppID

	// 验证用户ID有效性
	if userID == "" {
		code = common.UnauthorizedUserID
		fmt.Println("用户登录 非法的用户ID", seq, userID)
		return
	}

	// 检查用户是否已经登录
	if client.IsLogin() {
		fmt.Println("用户登录 用户已经登录", client.AppID, client.UserID, seq)
		code = common.OperationFailure
		return
	}

	// 设置客户端登录状态
	client.Login(appID, userID, currentTime)

	// 存储用户在线数据
	userOnline := models.UserLogin(serverIp, serverPort, appID, userID, client.Addr, currentTime)
	err = cache.SetUserOnlineInfo(client.GetKey(), userOnline)
	if err != nil {
		code = common.ServerError
		fmt.Println("用户登录 SetUserOnlineInfo", seq, err)
		return
	}

	// 用户登录事件
	login := &login{
		AppID:  appID,
		UserID: userID,
		Token:  request.ServiceToken,
		Client: client,
	}
	clientManager.Login <- login
	fmt.Println("用户登录 成功", seq, client.Addr, userID, appID)

	// 返回登录成功的用户信息
	data = map[string]interface{}{
		"userID": userID,
		"appID":  appID,
	}

	return
}

// HeartbeatController 心跳
func HeartbeatController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK
	currentTime := uint64(time.Now().Unix())
	request := &models.HeartBeat{}
	fmt.Println("message", string(message))
	if err := json.Unmarshal(message, request); err != nil {
		code = common.ParameterIllegal
		fmt.Println("心跳接口 解析数据失败", seq, err)
		return
	}
	userOnline := models.UserLogin(serverIp, serverPort, client.AppID, client.UserID, client.Addr, currentTime)
	err := cache.SetUserOnlineInfo(client.GetKey(), userOnline)
	if err != nil {
		code = common.ServerError
		fmt.Println("心跳接口 SetUserOnlineInfo", seq, err)
		return
	}
	client.Heartbeat(currentTime)
	fmt.Println("webSocket_request 心跳接口", client.AppID, client.UserID, seq)
	return
}

// SendMessageController 发送聊天消息控制器
func SendMessageController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK

	// 检查用户是否已登录
	if !client.IsLogin() {
		code = common.Unauthorized
		fmt.Println("发送消息 用户未登录", seq)
		return
	}

	request := &models.ChatMessage{}
	if err := json.Unmarshal(message, request); err != nil {
		code = common.ParameterIllegal
		fmt.Println("发送消息 解析数据失败", seq, err)
		return
	}

	// 验证必要参数
	if request.ToUserID == "" {
		code = common.ParameterIllegal
		fmt.Println("发送消息 接收者用户ID不能为空", seq)
		return
	}

	if request.MessageType == "" {
		code = common.ParameterIllegal
		fmt.Println("发送消息 消息类型不能为空", seq)
		return
	}

	if request.Content == "" {
		code = common.ParameterIllegal
		fmt.Println("发送消息 消息内容不能为空", seq)
		return
	}

	// 验证消息类型
	if request.MessageType != models.MessageTypeText && request.MessageType != models.MessageTypeAudio {
		code = common.ParameterIllegal
		fmt.Println("发送消息 不支持的消息类型", seq, request.MessageType)
		return
	}

	// 如果是音频消息，验证音频格式
	if request.MessageType == models.MessageTypeAudio {
		if request.AudioFormat == "" {
			request.AudioFormat = "pcm_16k" // 默认格式
		}
		if request.AudioFormat != "pcm_16k" {
			code = common.ParameterIllegal
			fmt.Println("发送消息 不支持的音频格式", seq, request.AudioFormat)
			return
		}
	}

	// 设置时间戳
	if request.Timestamp == 0 {
		request.Timestamp = time.Now().Unix()
	}

	// 查找目标用户的连接
	targetClient := GetUserClient("", request.ToUserID)
	if targetClient == nil {
		code = common.NotOnline
		fmt.Println("发送消息 目标用户不在线", seq, request.ToUserID)
		return
	}

	// 构造转发消息
	var forwardMessage string
	if request.MessageType == models.MessageTypeText {
		forwardMessage = models.GetTextMsgData(client.UserID, seq, request.Content)
	} else if request.MessageType == models.MessageTypeAudio {
		forwardMessage = models.GetAudioMsgData(client.UserID, seq, request.Content)
	}

	// 发送消息给目标用户
	targetClient.SendMsg([]byte(forwardMessage))

	fmt.Println("发送消息 成功", seq, "from:", client.UserID, "to:", request.ToUserID, "type:", request.MessageType)

	// 返回发送成功信息
	data = map[string]interface{}{
		"messageID":   seq,
		"toUserID":    request.ToUserID,
		"messageType": request.MessageType,
		"timestamp":   request.Timestamp,
		"status":      "sent",
	}

	return
}

// SendAudioMessageController 发送音频消息控制器
func SendAudioMessageController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK

	// 检查用户是否已登录
	if !client.IsLogin() {
		code = common.Unauthorized
		fmt.Println("发送音频消息 用户未登录", seq)
		return
	}

	request := &models.AudioMessage{}
	if err := json.Unmarshal(message, request); err != nil {
		code = common.ParameterIllegal
		fmt.Println("发送音频消息 解析数据失败", seq, err)
		return
	}

	// 验证必要参数
	if request.ToUserID == "" {
		code = common.ParameterIllegal
		fmt.Println("发送音频消息 接收者用户ID不能为空", seq)
		return
	}

	if request.AudioData == "" {
		code = common.ParameterIllegal
		fmt.Println("发送音频消息 音频数据不能为空", seq)
		return
	}

	// 验证音频格式
	if request.AudioFormat == "" {
		request.AudioFormat = "pcm_16k" // 默认格式
	}
	if request.AudioFormat != "pcm_16k" {
		code = common.ParameterIllegal
		fmt.Println("发送音频消息 不支持的音频格式", seq, request.AudioFormat)
		return
	}

	// 设置时间戳
	if request.Timestamp == 0 {
		request.Timestamp = time.Now().Unix()
	}

	// 查找目标用户的连接
	targetClient := GetUserClient("", request.ToUserID)
	if targetClient == nil {
		code = common.NotOnline
		fmt.Println("发送音频消息 目标用户不在线", seq, request.ToUserID)
		return
	}

	// 构造音频消息
	forwardMessage := models.GetAudioMsgData(client.UserID, seq, request.AudioData)

	// 发送消息给目标用户
	targetClient.SendMsg([]byte(forwardMessage))

	fmt.Println("发送音频消息 成功", seq, "from:", client.UserID, "to:", request.ToUserID, "duration:", request.Duration, "ms")

	// 返回发送成功信息
	data = map[string]interface{}{
		"messageID":   seq,
		"toUserID":    request.ToUserID,
		"messageType": "audio",
		"audioFormat": request.AudioFormat,
		"duration":    request.Duration,
		"timestamp":   request.Timestamp,
		"status":      "sent",
	}

	return
}
