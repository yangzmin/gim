// Package routers 路由
package routers

import (
	"github.com/gin-gonic/gin"

	"github.com/link1st/gowebsocket/v2/controllers/auth"
	"github.com/link1st/gowebsocket/v2/controllers/friend"
	"github.com/link1st/gowebsocket/v2/controllers/systems"
	"github.com/link1st/gowebsocket/v2/controllers/user"
	"github.com/link1st/gowebsocket/v2/middleware"
)

// Init http 接口路由
func Init(router *gin.Engine) {
	router.LoadHTMLGlob("views/**/*")

	// API路由组
	apiRouter := router.Group("/api")
	{
		// 认证接口
		authRouter := apiRouter.Group("/auth")
		{
			authRouter.POST("/login", auth.Login)
			authRouter.POST("/logout", middleware.JWTAuthMiddleware(), auth.Logout)
			authRouter.GET("/me", middleware.JWTAuthMiddleware(), auth.GetCurrentUser)
		}

		// 好友管理接口 (需要认证)
		friendRouter := apiRouter.Group("/friend")
		friendRouter.Use(middleware.JWTAuthMiddleware())
		{
			friendRouter.GET("/list", friend.GetFriendList)
			friendRouter.POST("/add", friend.AddFriend)
			friendRouter.DELETE("/:friendID", friend.DeleteFriend)
		}

		// 消息接口
		// messageRouter := apiRouter.Group("/message")
		// {
		// 	messageRouter.GET("/history", message.GetChatHistory)
		// 	messageRouter.POST("/send", message.SendMessage)
		// 	messageRouter.PUT("/read", message.MarkAsRead)
		// 	messageRouter.GET("/unread", message.GetUnreadCount)
		// }
	}

	// 用户组 (保留原有接口兼容性)
	userRouter := router.Group("/user")
	{
		userRouter.GET("/list", user.List)
		userRouter.GET("/online", user.Online)
		userRouter.POST("/sendMessage", user.SendMessage)
		userRouter.POST("/sendMessageAll", user.SendMessageAll)
	}

	// 系统
	systemRouter := router.Group("/system")
	{
		systemRouter.GET("/state", systems.Status)
	}

	// home
	// homeRouter := router.Group("/home")
	// {
	// 	homeRouter.GET("/index", home.Index)
	// }
}
