package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/link1st/gowebsocket/v2/common"
	"github.com/link1st/gowebsocket/v2/controllers"
	"github.com/link1st/gowebsocket/v2/lib/jwtlib"
)

/**
 * JWT认证中间件
 * 验证请求头中的Authorization token
 */
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			controllers.Response(c, common.Unauthorized, "缺少Authorization头", nil)
			c.Abort()
			return
		}

		// 检查Bearer前缀
		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authHeader, bearerPrefix) {
			controllers.Response(c, common.Unauthorized, "Authorization格式错误", nil)
			c.Abort()
			return
		}

		// 提取token
		tokenString := authHeader[len(bearerPrefix):]
		if tokenString == "" {
			controllers.Response(c, common.Unauthorized, "token不能为空", nil)
			c.Abort()
			return
		}

		// 验证token
		claims, err := jwtlib.ValidateToken(tokenString)
		if err != nil {
			controllers.Response(c, common.Unauthorized, "无效的token: "+err.Error(), nil)
			c.Abort()
			return
		}

		// 将用户信息存储到上下文中
		c.Set("userID", claims.UserID)
		c.Set("appID", claims.AppID)
		c.Set("token", tokenString)

		c.Next()
	}
}

/**
 * 可选的JWT认证中间件
 * 如果有token则验证，没有token则跳过
 */
func OptionalJWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// 检查Bearer前缀
		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authHeader, bearerPrefix) {
			c.Next()
			return
		}

		// 提取token
		tokenString := authHeader[len(bearerPrefix):]
		if tokenString == "" {
			c.Next()
			return
		}

		// 验证token
		claims, err := jwtlib.ValidateToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		// 将用户信息存储到上下文中
		c.Set("userID", claims.UserID)
		c.Set("appID", claims.AppID)
		c.Set("token", tokenString)

		c.Next()
	}
}

/**
 * 从Gin上下文中获取当前用户ID
 */
func GetCurrentUserID(c *gin.Context) string {
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(string); ok {
			return uid
		}
	}
	return ""
}

/**
 * 从Gin上下文中获取当前应用ID
 */
func GetCurrentAppID(c *gin.Context) string {
	if appID, exists := c.Get("appID"); exists {
		if aid, ok := appID.(string); ok {
			return aid
		}
	}
	return ""
}

/**
 * 从Gin上下文中获取当前token
 */
func GetCurrentToken(c *gin.Context) string {
	if token, exists := c.Get("token"); exists {
		if t, ok := token.(string); ok {
			return t
		}
	}
	return ""
}