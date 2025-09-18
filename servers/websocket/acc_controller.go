// Package websocket 处理
package websocket

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/lib/cache"
	"github.com/link1st/gowebsocket/v2/lib/jwtlib"
	"github.com/link1st/gowebsocket/v2/models"

	"github.com/redis/go-redis/v9"
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
	fmt.Println("message", string(message))
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

// HeartbeatController 心跳接口
func HeartbeatController(client *Client, seq string, message []byte) (code uint32, msg string, data interface{}) {
	code = common.OK
	currentTime := uint64(time.Now().Unix())
	request := &models.HeartBeat{}
	if err := json.Unmarshal(message, request); err != nil {
		code = common.ParameterIllegal
		fmt.Println("心跳接口 解析数据失败", seq, err)
		return
	}
	fmt.Println("webSocket_request 心跳接口", client.AppID, client.UserID)
	if !client.IsLogin() {
		fmt.Println("心跳接口 用户未登录", client.AppID, client.UserID, seq)
		code = common.NotLoggedIn
		return
	}
	userOnline, err := cache.GetUserOnlineInfo(client.GetKey())
	if err != nil {
		if errors.Is(err, redis.Nil) {
			code = common.NotLoggedIn
			fmt.Println("心跳接口 用户未登录", seq, client.AppID, client.UserID)
			return
		} else {
			code = common.ServerError
			fmt.Println("心跳接口 GetUserOnlineInfo", seq, client.AppID, client.UserID, err)
			return
		}
	}
	client.Heartbeat(currentTime)
	userOnline.Heartbeat(currentTime)
	err = cache.SetUserOnlineInfo(client.GetKey(), userOnline)
	if err != nil {
		code = common.ServerError
		fmt.Println("心跳接口 SetUserOnlineInfo", seq, client.AppID, client.UserID, err)
		return
	}
	return
}
