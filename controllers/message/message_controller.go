// Package message 消息管理接口
package message

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/controllers"
	"github.com/link1st/gowebsocket/v2/lib/redislib"
	"github.com/link1st/gowebsocket/v2/servers/websocket"
)

// GetChatHistory 获取聊天记录
func GetChatHistory(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}
	friendID := c.Query("friendID")
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)

	fmt.Println("API请求 获取聊天记录", token, friendID, page, limit)

	data := make(map[string]interface{})

	if token == "" {
		controllers.Response(c, common.Unauthorized, "未授权访问", data)
		return
	}

	if friendID == "" {
		controllers.Response(c, common.ParameterIllegal, "好友ID不能为空", data)
		return
	}

	// 验证token并获取用户ID
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData, err := redislib.GetClient().HGetAll(c.Request.Context(), tokenKey).Result()
	if err != nil || len(tokenData) == 0 {
		controllers.Response(c, common.Unauthorized, "token无效", data)
		return
	}

	userID := tokenData["userID"]

	// 生成聊天记录的key (保证两个用户之间的聊天记录key一致)
	var chatKey string
	if userID < friendID {
		chatKey = fmt.Sprintf("chat:history:%s:%s", userID, friendID)
	} else {
		chatKey = fmt.Sprintf("chat:history:%s:%s", friendID, userID)
	}

	// 获取聊天记录总数
	total, err := redislib.GetClient().ZCard(c.Request.Context(), chatKey).Result()
	if err != nil {
		fmt.Printf("获取聊天记录总数失败: %v\n", err)
		total = 0
	}

	// 计算分页参数
	offset := int64((page - 1) * limit)
	stop := offset + int64(limit) - 1

	// 获取聊天记录 (按时间倒序)
	messageIDs, err := redislib.GetClient().ZRevRange(c.Request.Context(), chatKey, offset, stop).Result()
	if err != nil {
		fmt.Printf("获取聊天记录失败: %v\n", err)
		controllers.Response(c, common.ServerError, "获取聊天记录失败", data)
		return
	}

	var messages []map[string]interface{}

	for _, messageID := range messageIDs {
		messageKey := fmt.Sprintf("message:detail:%s", messageID)
		messageInfo, err := redislib.GetClient().HGetAll(c.Request.Context(), messageKey).Result()
		if err != nil || len(messageInfo) == 0 {
			continue
		}

		// 解析时间戳
		timestamp, _ := strconv.ParseInt(messageInfo["timestamp"], 10, 64)

		messageData := map[string]interface{}{
			"messageID":   messageInfo["messageID"],
			"fromUserID":  messageInfo["fromUserID"],
			"toUserID":    messageInfo["toUserID"],
			"content":     messageInfo["content"],
			"messageType": messageInfo["messageType"],
			"timestamp":   time.Unix(timestamp, 0).Format(time.RFC3339),
			"isRead":      messageInfo["isRead"] == "true",
		}

		messages = append(messages, messageData)
	}

	// 反转消息顺序，使其按时间正序显示
	for i := 0; i < len(messages)/2; i++ {
		j := len(messages) - 1 - i
		messages[i], messages[j] = messages[j], messages[i]
	}

	if messages == nil {
		messages = make([]map[string]interface{}, 0)
	}

	data["messages"] = messages
	data["hasMore"] = int64(page*limit) < total
	data["total"] = total

	controllers.Response(c, common.OK, "获取成功", data)
}

// SendMessage 发送消息
func SendMessage(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.PostForm("token")
	}
	friendID := c.PostForm("friendID")
	content := c.PostForm("content")
	messageType := c.DefaultPostForm("messageType", "text")

	fmt.Println("API请求 发送消息", token, friendID, content, messageType)

	data := make(map[string]interface{})

	if token == "" {
		controllers.Response(c, common.Unauthorized, "未授权访问", data)
		return
	}

	if friendID == "" || content == "" {
		controllers.Response(c, common.ParameterIllegal, "参数不能为空", data)
		return
	}

	// 验证token并获取用户ID
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData, err := redislib.GetClient().HGetAll(c.Request.Context(), tokenKey).Result()
	if err != nil || len(tokenData) == 0 {
		controllers.Response(c, common.Unauthorized, "token无效", data)
		return
	}

	userID := tokenData["userID"]
	appID := tokenData["appID"]
	// appIDUint64, _ := strconv.ParseInt(appIDStr, 10, 32)
	// appID := uint32(appIDUint64)

	// 生成消息ID
	messageID := fmt.Sprintf("msg_%d_%s_%s", time.Now().UnixNano(), userID, friendID)

	// 保存消息详情
	messageKey := fmt.Sprintf("message:detail:%s", messageID)
	messageInfo := map[string]interface{}{
		"messageID":   messageID,
		"fromUserID":  userID,
		"toUserID":    friendID,
		"content":     content,
		"messageType": messageType,
		"timestamp":   time.Now().Unix(),
		"isRead":      false,
	}

	err = redislib.GetClient().HMSet(c.Request.Context(), messageKey, messageInfo).Err()
	if err != nil {
		fmt.Printf("保存消息失败: %v\n", err)
		controllers.Response(c, common.ServerError, "发送消息失败", data)
		return
	}

	// 添加到聊天记录
	var chatKey string
	if userID < friendID {
		chatKey = fmt.Sprintf("chat:history:%s:%s", userID, friendID)
	} else {
		chatKey = fmt.Sprintf("chat:history:%s:%s", friendID, userID)
	}

	// 使用时间戳作为score
	err = redislib.GetClient().ZAdd(c.Request.Context(), chatKey, redis.Z{
		Score:  float64(time.Now().Unix()),
		Member: messageID,
	}).Err()
	if err != nil {
		fmt.Printf("添加到聊天记录失败: %v\n", err)
	}

	// 通过WebSocket发送实时消息
	go func() {
		_, err := websocket.SendUserMessage(appID, friendID, messageID, content)
		if err != nil {
			fmt.Printf("WebSocket发送消息失败: %v\n", err)
		}
	}()

	// 更新未读消息计数
	unreadKey := fmt.Sprintf("message:unread:%s:%s", friendID, userID)
	redislib.GetClient().Incr(c.Request.Context(), unreadKey)

	data["message"] = map[string]interface{}{
		"messageID":   messageID,
		"fromUserID":  userID,
		"toUserID":    friendID,
		"content":     content,
		"messageType": messageType,
		"timestamp":   time.Now().Format(time.RFC3339),
		"isRead":      false,
	}

	controllers.Response(c, common.OK, "发送成功", data)
}

// MarkAsRead 标记消息已读
func MarkAsRead(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.PostForm("token")
	}
	friendID := c.PostForm("friendID")

	fmt.Println("API请求 标记消息已读", token, friendID)

	data := make(map[string]interface{})

	if token == "" {
		controllers.Response(c, common.Unauthorized, "未授权访问", data)
		return
	}

	if friendID == "" {
		controllers.Response(c, common.ParameterIllegal, "好友ID不能为空", data)
		return
	}

	// 验证token并获取用户ID
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData, err := redislib.GetClient().HGetAll(c.Request.Context(), tokenKey).Result()
	if err != nil || len(tokenData) == 0 {
		controllers.Response(c, common.Unauthorized, "token无效", data)
		return
	}

	userID := tokenData["userID"]

	// 清除未读消息计数
	unreadKey := fmt.Sprintf("message:unread:%s:%s", userID, friendID)
	err = redislib.GetClient().Del(c.Request.Context(), unreadKey).Err()
	if err != nil {
		fmt.Printf("清除未读消息计数失败: %v\n", err)
	}

	controllers.Response(c, common.OK, "标记成功", data)
}

// GetUnreadCount 获取未读消息统计
func GetUnreadCount(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}

	fmt.Println("API请求 获取未读消息统计", token)

	data := make(map[string]interface{})

	if token == "" {
		controllers.Response(c, common.Unauthorized, "未授权访问", data)
		return
	}

	// 验证token并获取用户ID
	tokenKey := fmt.Sprintf("auth:token:%s", token)
	tokenData, err := redislib.GetClient().HGetAll(c.Request.Context(), tokenKey).Result()
	if err != nil || len(tokenData) == 0 {
		controllers.Response(c, common.Unauthorized, "token无效", data)
		return
	}

	userID := tokenData["userID"]

	// 获取好友列表
	friendsKey := fmt.Sprintf("user:friends:%s", userID)
	friendIDs, err := redislib.GetClient().SMembers(c.Request.Context(), friendsKey).Result()
	if err != nil {
		controllers.Response(c, common.ServerError, "获取好友列表失败", data)
		return
	}

	unreadCounts := make(map[string]int)
	totalUnread := 0

	for _, friendID := range friendIDs {
		unreadKey := fmt.Sprintf("message:unread:%s:%s", userID, friendID)
		count, err := redislib.GetClient().Get(c.Request.Context(), unreadKey).Int()
		if err != nil {
			count = 0
		}
		unreadCounts[friendID] = count
		totalUnread += count
	}

	data["unreadCounts"] = unreadCounts
	data["totalUnread"] = totalUnread

	controllers.Response(c, common.OK, "获取成功", data)
}
