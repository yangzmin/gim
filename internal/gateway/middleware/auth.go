package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"gim/internal/gateway/client"
	businesspb "gim/pkg/protocol/pb/businesspb"
)

// AuthRequired JWT认证中间件
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取token
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.GetHeader("Token")
		}
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "Missing authorization token",
			})
			c.Abort()
			return
		}

		// 去掉Bearer前缀
		if strings.HasPrefix(token, "Bearer ") {
			token = token[7:]
		}

		// 从请求头获取用户ID和设备ID
		userIDStr := c.GetHeader("X-User-Id")
		deviceIDStr := c.GetHeader("X-Device-Id")

		if userIDStr == "" || deviceIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "Missing user ID or device ID",
			})
			c.Abort()
			return
		}

		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "Invalid user ID",
			})
			c.Abort()
			return
		}

		deviceID, err := strconv.ParseUint(deviceIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "Invalid device ID",
			})
			c.Abort()
			return
		}

		// 调用business服务进行token验证
		businessClient := client.NewBusinessClient()
		_, err = businessClient.UserIntService.Auth(context.Background(), &businesspb.AuthRequest{
			UserId:   userID,
			DeviceId: deviceID,
			Token:    token,
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "Invalid token",
				"error":   err.Error(),
			})
			c.Abort()
			return
		}

		// 将用户信息存储到上下文中
		c.Set("userID", userID)
		c.Set("deviceID", deviceID)
		c.Set("token", token)

		c.Next()
	}
}