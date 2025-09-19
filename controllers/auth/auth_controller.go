// Package auth 用户认证接口
package auth

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/controllers"
	"github.com/link1st/gowebsocket/v2/lib/jwtlib"
	"github.com/link1st/gowebsocket/v2/lib/redislib"
)

// LoginRequest 登录请求结构体
type LoginRequest struct {
	UserID     string `json:"userID" binding:"required"`
	AppID      string `json:"appID"`
	ClientInfo string `json:"clientInfo"`
}

// Login 用户登录接口
func Login(c *gin.Context) {
	var req LoginRequest

	// 绑定JSON请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("参数绑定失败: %v\n", err)
		data := make(map[string]interface{})
		controllers.Response(c, common.ParameterIllegal, "请求参数格式错误", data)
		return
	}

	userID := req.UserID
	appID := req.AppID
	clientInfo := req.ClientInfo

	fmt.Println("API请求 用户登录", userID, appID, clientInfo)

	data := make(map[string]interface{})

	if userID == "" {
		controllers.Response(c, common.ParameterIllegal, "用户ID不能为空", data)
		return
	}

	// 检查用户是否存在，不存在则创建
	userKey := fmt.Sprintf("user:profile:%s", userID)
	userExists, err := redislib.GetClient().Exists(c.Request.Context(), userKey).Result()
	if err != nil {
		fmt.Printf("检查用户存在性失败: %v\n", err)
		controllers.Response(c, common.ServerError, "服务器错误", data)
		return
	}

	isNewUser := false
	if userExists == 0 {
		// 创建新用户
		userProfile := map[string]interface{}{
			"userID":      userID,
			"nickname":    fmt.Sprintf("用户%s", userID),
			"avatar":      "",
			"createdAt":   time.Now().Format(time.RFC3339),
			"lastLoginAt": time.Now().Format(time.RFC3339),
		}

		err = redislib.GetClient().HMSet(c.Request.Context(), userKey, userProfile).Err()
		if err != nil {
			fmt.Printf("创建用户失败: %v\n", err)
			controllers.Response(c, common.ServerError, "创建用户失败", data)
			return
		}
		isNewUser = true
		fmt.Printf("新用户注册: %s\n", userID)
	} else {
		// 更新最后登录时间
		err = redislib.GetClient().HSet(c.Request.Context(), userKey, "lastLoginAt", time.Now().Format(time.RFC3339)).Err()
		if err != nil {
			fmt.Printf("更新用户登录时间失败: %v\n", err)
		}
	}

	// 获取用户信息
	userInfo, err := redislib.GetClient().HGetAll(c.Request.Context(), userKey).Result()
	if err != nil {
		fmt.Printf("获取用户信息失败: %v\n", err)
		controllers.Response(c, common.ServerError, "获取用户信息失败", data)
		return
	}

	// 生成JWT token
	token, err := jwtlib.GenerateToken(userID, appID, 24) // 24小时过期
	if err != nil {
		fmt.Printf("生成JWT token失败: %v\n", err)
		controllers.Response(c, common.ServerError, "生成token失败", data)
		return
	}

	// 缓存token到Redis（可选，用于token黑名单等功能）
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData := map[string]interface{}{
		"userID":  userID,
		"appID":   appID,
		"loginAt": time.Now().Unix(),
	}
	err = redislib.GetClient().HMSet(c.Request.Context(), tokenKey, tokenData).Err()
	if err != nil {
		fmt.Printf("缓存token失败: %v\n", err)
	}
	// 设置token过期时间为24小时
	redislib.GetClient().Expire(c.Request.Context(), tokenKey, 24*time.Hour)

	data["token"] = token
	data["user"] = map[string]interface{}{
		"userID":    userInfo["userID"],
		"appID":     appID, // 添加appID字段
		"nickname":  userInfo["nickname"],
		"avatar":    userInfo["avatar"],
		"isNewUser": isNewUser,
	}
	data["expiresIn"] = 86400 // 24小时

	controllers.Response(c, common.OK, "登录成功", data)
}

// Logout 用户登出接口
func Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.PostForm("token")
	}

	fmt.Println("API请求 用户登出", token)

	data := make(map[string]interface{})

	if token != "" {
		// 删除token缓存
		tokenKey := fmt.Sprintf("auth:token:%s", token)
		err := redislib.GetClient().Del(c.Request.Context(), tokenKey).Err()
		if err != nil {
			fmt.Printf("删除token缓存失败: %v\n", err)
		}
	}

	controllers.Response(c, common.OK, "登出成功", data)
}

// GetCurrentUser 获取当前用户信息
func GetCurrentUser(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}

	fmt.Println("API请求 获取当前用户信息", token)

	data := make(map[string]interface{})

	if token == "" {
		controllers.Response(c, common.Unauthorized, "未授权访问", data)
		return
	}

	// 验证token
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData, err := redislib.GetClient().HGetAll(c.Request.Context(), tokenKey).Result()
	if err != nil || len(tokenData) == 0 {
		controllers.Response(c, common.Unauthorized, "token无效", data)
		return
	}

	userID := tokenData["userID"]
	userKey := fmt.Sprintf("user:profile:%s", userID)
	userInfo, err := redislib.GetClient().HGetAll(c.Request.Context(), userKey).Result()
	if err != nil {
		controllers.Response(c, common.ServerError, "获取用户信息失败", data)
		return
	}

	data["user"] = map[string]interface{}{
		"userID":   userInfo["userID"],
		"nickname": userInfo["nickname"],
		"avatar":   userInfo["avatar"],
	}

	controllers.Response(c, common.OK, "获取成功", data)
}
