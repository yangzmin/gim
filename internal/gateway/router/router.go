package router

import (
	"github.com/gin-gonic/gin"

	"gim/internal/gateway/handler"
	"gim/internal/gateway/middleware"
)

func NewRouter() *gin.Engine {
	r := gin.New()

	// 基础中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit())

	// 初始化处理器
	userHandler := handler.NewUserHandler()
	deviceHandler := handler.NewDeviceHandler()
	friendHandler := handler.NewFriendHandler()
	messageHandler := handler.NewMessageHandler()
	groupHandler := handler.NewGroupHandler()
	connectHandler := handler.NewConnectHandler()

	// API路由组
	api := r.Group("/api")
	{
		// 用户相关接口
		user := api.Group("/user")
		{
			user.POST("/sign_in", userHandler.SignIn)
			user.GET("/profile", middleware.AuthRequired(), userHandler.GetProfile)
			user.PUT("/update", middleware.AuthRequired(), userHandler.UpdateUser)
			user.GET("/search", middleware.AuthRequired(), userHandler.SearchUser)
			user.POST("/auth", userHandler.Auth) // 内部认证
			user.POST("/batch", middleware.AuthRequired(), userHandler.GetUsers) // 批量获取
		}

		// 好友相关接口
		friend := api.Group("/friend")
		friend.Use(middleware.AuthRequired())
		{
			friend.POST("/message", friendHandler.SendMessage)
			friend.POST("/add", friendHandler.Add)
			friend.POST("/agree", friendHandler.Agree)
			friend.PUT("/set", friendHandler.Set)
			friend.GET("/list", friendHandler.GetFriends)
		}

		// 设备相关接口
		device := api.Group("/device")
		{
			device.POST("/save", deviceHandler.Save)
			device.POST("/signin", deviceHandler.SignIn)
			device.POST("/heartbeat", middleware.AuthRequired(), deviceHandler.Heartbeat)
			device.POST("/offline", middleware.AuthRequired(), deviceHandler.Offline)
		}

		// 消息相关接口
		message := api.Group("/message")
		message.Use(middleware.AuthRequired())
		{
			message.GET("/sync", messageHandler.Sync)
			message.POST("/ack", messageHandler.ACK)
			message.POST("/push", messageHandler.PushToUsers)
			message.POST("/broadcast", messageHandler.PushToAll)
		}

		// 群组相关接口
		group := api.Group("/group")
		group.Use(middleware.AuthRequired())
		{
			group.POST("/create", groupHandler.Create)
			group.GET("/:id", groupHandler.Get)
			group.PUT("/update", groupHandler.Update)
			group.POST("/push", groupHandler.Push)
		}

		// 房间相关接口
		room := api.Group("/room")
		room.Use(middleware.AuthRequired())
		{
			room.POST("/push", connectHandler.PushRoom)
			room.POST("/subscribe", connectHandler.SubscribeRoom)
		}

		// 连接相关接口
		connect := api.Group("/connect")
		{
			connect.POST("/push", connectHandler.PushToDevices)
		}
	}

	// 健康检查接口
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "gateway",
			"version": "1.0.0",
		})
	})

	return r
}