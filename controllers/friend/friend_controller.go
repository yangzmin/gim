// Package friend 好友管理接口
package friend

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/controllers"
	"github.com/link1st/gowebsocket/v2/lib/redislib"
	"github.com/link1st/gowebsocket/v2/servers/websocket"
)

// GetFriendList 获取好友列表
func GetFriendList(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}

	fmt.Println("API请求 获取好友列表", token)

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
	appID := tokenData["appID"]
	// appIDUint64, _ := strconv.ParseInt(appIDStr, 10, 32)
	// appID := uint32(appIDUint64)

	// 获取好友列表
	friendsKey := fmt.Sprintf("user:friends:%s", userID)
	friendIDs, err := redislib.GetClient().SMembers(c.Request.Context(), friendsKey).Result()
	if err != nil {
		fmt.Printf("获取好友列表失败: %v\n", err)
		controllers.Response(c, common.ServerError, "获取好友列表失败", data)
		return
	}

	var friends []map[string]interface{}

	for _, friendID := range friendIDs {
		// 获取好友基本信息
		friendKey := fmt.Sprintf("user:profile:%s", friendID)
		friendInfo, err := redislib.GetClient().HGetAll(c.Request.Context(), friendKey).Result()
		if err != nil || len(friendInfo) == 0 {
			continue
		}

		// 检查好友在线状态
		isOnline := websocket.CheckUserOnline(appID, friendID)

		// 获取未读消息数量
		unreadCount := getUnreadCount(userID, friendID)

		friendData := map[string]interface{}{
			"userID":      friendInfo["userID"],
			"nickname":    friendInfo["nickname"],
			"avatar":      friendInfo["avatar"],
			"isOnline":    isOnline,
			"lastSeen":    friendInfo["lastLoginAt"],
			"unreadCount": unreadCount,
		}

		friends = append(friends, friendData)
	}

	if friends == nil {
		friends = make([]map[string]interface{}, 0)
	}

	data["friends"] = friends
	controllers.Response(c, common.OK, "获取成功", data)
}

// AddFriend 添加好友
func AddFriend(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.PostForm("token")
	}
	friendID := c.PostForm("friendID")

	fmt.Println("API请求 添加好友", token, friendID)

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

	if userID == friendID {
		controllers.Response(c, common.ParameterIllegal, "不能添加自己为好友", data)
		return
	}

	// 检查要添加的用户是否存在
	friendKey := fmt.Sprintf("user:profile:%s", friendID)
	friendExists, err := redislib.GetClient().Exists(c.Request.Context(), friendKey).Result()
	if err != nil {
		controllers.Response(c, common.ServerError, "服务器错误", data)
		return
	}

	if friendExists == 0 {
		controllers.Response(c, common.ParameterIllegal, "用户不存在", data)
		return
	}

	// 检查是否已经是好友
	friendsKey := fmt.Sprintf("user:friends:%s", userID)
	isFriend, err := redislib.GetClient().SIsMember(c.Request.Context(), friendsKey, friendID).Result()
	if err != nil {
		controllers.Response(c, common.ServerError, "服务器错误", data)
		return
	}

	if isFriend {
		controllers.Response(c, common.ParameterIllegal, "已经是好友关系", data)
		return
	}

	// 添加好友关系 (双向)
	userFriendsKey := fmt.Sprintf("user:friends:%s", userID)
	friendFriendsKey := fmt.Sprintf("user:friends:%s", friendID)

	err = redislib.GetClient().SAdd(c.Request.Context(), userFriendsKey, friendID).Err()
	if err != nil {
		controllers.Response(c, common.ServerError, "添加好友失败", data)
		return
	}

	err = redislib.GetClient().SAdd(c.Request.Context(), friendFriendsKey, userID).Err()
	if err != nil {
		// 回滚
		redislib.GetClient().SRem(c.Request.Context(), userFriendsKey, friendID)
		controllers.Response(c, common.ServerError, "添加好友失败", data)
		return
	}

	// 获取新添加的好友信息
	friendInfo, err := redislib.GetClient().HGetAll(c.Request.Context(), friendKey).Result()
	if err != nil {
		controllers.Response(c, common.ServerError, "获取好友信息失败", data)
		return
	}

	data["friend"] = map[string]interface{}{
		"userID":      friendInfo["userID"],
		"nickname":    friendInfo["nickname"],
		"avatar":      friendInfo["avatar"],
		"isOnline":    false,
		"lastSeen":    friendInfo["lastLoginAt"],
		"unreadCount": 0,
	}

	controllers.Response(c, common.OK, "添加好友成功", data)
}

// DeleteFriend 删除好友
func DeleteFriend(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.PostForm("token")
	}
	friendID := c.Param("friendID")

	fmt.Println("API请求 删除好友", token, friendID)

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

	// 删除好友关系 (双向)
	userFriendsKey := fmt.Sprintf("user:friends:%s", userID)
	friendFriendsKey := fmt.Sprintf("user:friends:%s", friendID)

	err = redislib.GetClient().SRem(c.Request.Context(), userFriendsKey, friendID).Err()
	if err != nil {
		controllers.Response(c, common.ServerError, "删除好友失败", data)
		return
	}

	err = redislib.GetClient().SRem(c.Request.Context(), friendFriendsKey, userID).Err()
	if err != nil {
		fmt.Printf("删除对方好友关系失败: %v\n", err)
	}

	controllers.Response(c, common.OK, "删除好友成功", data)
}

// 获取未读消息数量 (简化实现)
func getUnreadCount(userID, friendID string) int {
	// 这里简化实现，实际项目中应该从消息记录中统计
	unreadKey := fmt.Sprintf("message:unread:%s:%s", userID, friendID)
	count, err := redislib.GetClient().Get(nil, unreadKey).Int()
	if err != nil {
		return 0
	}
	return count
}
