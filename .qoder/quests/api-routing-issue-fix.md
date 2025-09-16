# API路由问题修复设计文档

## 问题概述

前端调用 `http://localhost:8080/api/device/save` 接口失败，因为设备的Save方法是一个gRPC内部方法，没有对外暴露HTTP路由。

### 问题分析

1. **设备Save方法现状**：DeviceIntService.Save 是内部gRPC服务方法，只在logic服务(8010端口)中注册
2. **前端期望**：需要通过HTTP接口调用设备注册功能
3. **架构差异**：用户登录已有HTTP接口(UserExtService.SignIn)，但设备注册缺少对应的HTTP端点

// ... existing content ...

## 技术实现

### API网关服务实现

#### 1. 目录结构

```
cmd/
└── gateway/          # 新增API网关服务
    └── main.go

internal/
└── gateway/          # 网关内部实现
    ├── handler/       # HTTP处理器
    │   ├── user.go
    │   ├── device.go
    │   ├── message.go
    │   ├── group.go
    │   └── connect.go
    ├── middleware/    # 中间件
    │   ├── auth.go
    │   ├── cors.go
    │   └── rate_limit.go
    ├── router/        # 路由配置
    │   └── router.go
    └── client/        # gRPC客户端封装
        ├── business.go
        ├── logic.go
        └── connect.go
```

#### 2. 主服务入口

```go
// cmd/gateway/main.go
package main

import (
    "context"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"

    "gim/config"
    "gim/internal/gateway/router"
    "gim/pkg/logger"
)

func main() {
    logger.Init("gateway")

    // 初始化路由
    r := router.NewRouter()

    // 创建HTTP服务器
    server := &http.Server{
        Addr:    config.Config.GatewayHTTPListenAddr,
        Handler: r,
    }

    // 启动服务器
    go func() {
        slog.Info("API网关服务已启动", "addr", server.Addr)
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            slog.Error("服务器启动失败", "error", err)
            panic(err)
        }
    }()

    // 监听关闭信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    slog.Info("正在关闭服务器...")

    // 优雅关闭
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := server.Shutdown(ctx); err != nil {
        slog.Error("强制关闭服务器", "error", err)
    }
    
    slog.Info("服务器已关闭")
}
```

#### 3. 路由配置

```go
// internal/gateway/router/router.go
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
            room.POST("/push", roomHandler.PushRoom)
            room.POST("/subscribe", roomHandler.SubscribeRoom)
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
            "status": "ok",
            "service": "gateway",
            "version": "1.0.0",
        })
    })

    return r
}
```

#### 4. 完整处理器实现

##### 设备处理器

```go
// internal/gateway/handler/device.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    pb "gim/pkg/protocol/pb/logicpb"
)

type DeviceHandler struct {
    logicClient *client.LogicClient
}

func NewDeviceHandler() *DeviceHandler {
    return &DeviceHandler{
        logicClient: client.NewLogicClient(),
    }
}

// Save 设备注册
func (h *DeviceHandler) Save(c *gin.Context) {
    var req pb.DeviceSaveRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.logicClient.DeviceSave(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Device registration failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"deviceId": reply.DeviceId},
    })
}

// SignIn 设备登录
func (h *DeviceHandler) SignIn(c *gin.Context) {
    var req pb.SignInRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.logicClient.DeviceSignIn(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Device sign in failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"deviceId": reply.DeviceId},
    })
}

// Heartbeat 设备心跳
func (h *DeviceHandler) Heartbeat(c *gin.Context) {
    var req pb.HeartbeatRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.DeviceHeartbeat(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Heartbeat failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// Offline 设备离线
func (h *DeviceHandler) Offline(c *gin.Context) {
    var req pb.OfflineRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.DeviceOffline(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Device offline failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}
```

##### 用户处理器

```go
// internal/gateway/handler/user.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    businesspb "gim/pkg/protocol/pb/businesspb"
)

type UserHandler struct {
    businessClient *client.BusinessClient
}

func NewUserHandler() *UserHandler {
    return &UserHandler{
        businessClient: client.NewBusinessClient(),
    }
}

// SignIn 用户登录
func (h *UserHandler) SignIn(c *gin.Context) {
    var req businesspb.SignInRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.businessClient.UserSignIn(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Sign in failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply,
    })
}

// GetProfile 获取用户信息
func (h *UserHandler) GetProfile(c *gin.Context) {
    userID := c.GetUint64("userID")
    
    reply, err := h.businessClient.GetUser(c.Request.Context(), &businesspb.GetUserRequest{
        UserId: userID,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Get user failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply.User,
    })
}

// UpdateUser 更新用户信息
func (h *UserHandler) UpdateUser(c *gin.Context) {
    var req businesspb.UpdateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.businessClient.UpdateUser(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Update user failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// SearchUser 搜索用户
func (h *UserHandler) SearchUser(c *gin.Context) {
    keyword := c.Query("key")
    if keyword == "" {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Missing search keyword",
        })
        return
    }

    reply, err := h.businessClient.SearchUser(c.Request.Context(), &businesspb.SearchUserRequest{
        Key: keyword,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Search user failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply.Users,
    })
}

// Auth 用户认证
func (h *UserHandler) Auth(c *gin.Context) {
    var req businesspb.AuthRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.businessClient.Auth(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{
            "code": 401,
            "message": "Authentication failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// GetUsers 批量获取用户
func (h *UserHandler) GetUsers(c *gin.Context) {
    var req businesspb.GetUsersRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.businessClient.GetUsers(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Get users failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply.Users,
    })
}
```

##### 好友处理器

```go
// internal/gateway/handler/friend.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "google.golang.org/protobuf/types/known/emptypb"

    "gim/internal/gateway/client"
    businesspb "gim/pkg/protocol/pb/businesspb"
)

type FriendHandler struct {
    businessClient *client.BusinessClient
}

func NewFriendHandler() *FriendHandler {
    return &FriendHandler{
        businessClient: client.NewBusinessClient(),
    }
}

// SendMessage 发送好友消息
func (h *FriendHandler) SendMessage(c *gin.Context) {
    var req businesspb.SendFriendMessageRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.businessClient.FriendSendMessage(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Send message failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"messageId": reply.MessageId},
    })
}

// Add 添加好友
func (h *FriendHandler) Add(c *gin.Context) {
    var req businesspb.FriendAddRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.businessClient.FriendAdd(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Add friend failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// Agree 同意添加好友
func (h *FriendHandler) Agree(c *gin.Context) {
    var req businesspb.FriendAgreeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.businessClient.FriendAgree(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Agree friend failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// Set 设置好友信息
func (h *FriendHandler) Set(c *gin.Context) {
    var req businesspb.FriendSetRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.businessClient.FriendSet(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Set friend failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply,
    })
}

// GetFriends 获取好友列表
func (h *FriendHandler) GetFriends(c *gin.Context) {
    reply, err := h.businessClient.FriendGetList(c.Request.Context(), &emptypb.Empty{})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Get friends failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply.Friends,
    })
}
```

##### 消息处理器

```go
// internal/gateway/handler/message.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    logicpb "gim/pkg/protocol/pb/logicpb"
)

type MessageHandler struct {
    logicClient *client.LogicClient
}

func NewMessageHandler() *MessageHandler {
    return &MessageHandler{
        logicClient: client.NewLogicClient(),
    }
}

// Sync 消息同步
func (h *MessageHandler) Sync(c *gin.Context) {
    seqStr := c.Query("seq")
    seq, err := strconv.ParseUint(seqStr, 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid seq parameter",
        })
        return
    }

    reply, err := h.logicClient.MessageSync(c.Request.Context(), &logicpb.SyncRequest{
        Seq: seq,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Message sync failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply,
    })
}

// ACK 消息回执
func (h *MessageHandler) ACK(c *gin.Context) {
    var req logicpb.MessageACKRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.MessageACK(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Message ACK failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// PushToUsers 推送消息到用户
func (h *MessageHandler) PushToUsers(c *gin.Context) {
    var req logicpb.PushToUsersRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.logicClient.MessagePushToUsers(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Push message failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"messageId": reply.MessageId},
    })
}

// PushToAll 全服推送
func (h *MessageHandler) PushToAll(c *gin.Context) {
    var req logicpb.PushToAllRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.MessagePushToAll(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Broadcast message failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}
```

##### 群组处理器

```go
// internal/gateway/handler/group.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    logicpb "gim/pkg/protocol/pb/logicpb"
)

type GroupHandler struct {
    logicClient *client.LogicClient
}

func NewGroupHandler() *GroupHandler {
    return &GroupHandler{
        logicClient: client.NewLogicClient(),
    }
}

// Create 创建群组
func (h *GroupHandler) Create(c *gin.Context) {
    var req logicpb.GroupCreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.logicClient.GroupCreate(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Create group failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"groupId": reply.GroupId},
    })
}

// Get 获取群组信息
func (h *GroupHandler) Get(c *gin.Context) {
    groupIdStr := c.Param("id")
    groupId, err := strconv.ParseUint(groupIdStr, 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid group ID",
        })
        return
    }

    reply, err := h.logicClient.GroupGet(c.Request.Context(), &logicpb.GroupGetRequest{
        GroupId: groupId,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Get group failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": reply.Group,
    })
}

// Update 更新群组
func (h *GroupHandler) Update(c *gin.Context) {
    var req logicpb.GroupUpdateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.GroupUpdate(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Update group failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// Push 发送群组消息
func (h *GroupHandler) Push(c *gin.Context) {
    var req logicpb.GroupPushRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    reply, err := h.logicClient.GroupPush(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Push group message failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{"messageId": reply.MessageId},
    })
}
```

##### 房间和连接处理器

```go
// internal/gateway/handler/room.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    logicpb "gim/pkg/protocol/pb/logicpb"
)

type RoomHandler struct {
    logicClient *client.LogicClient
}

func NewRoomHandler() *RoomHandler {
    return &RoomHandler{
        logicClient: client.NewLogicClient(),
    }
}

// PushRoom 推送消息到房间
func (h *RoomHandler) PushRoom(c *gin.Context) {
    var req logicpb.PushRoomRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.RoomPush(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Push room message failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}

// SubscribeRoom 订阅房间
func (h *RoomHandler) SubscribeRoom(c *gin.Context) {
    var req logicpb.SubscribeRoomRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    _, err := h.logicClient.RoomSubscribe(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Subscribe room failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}
```

```go
// internal/gateway/handler/connect.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"

    "gim/internal/gateway/client"
    connectpb "gim/pkg/protocol/pb/connectpb"
)

type ConnectHandler struct {
    connectClient *client.ConnectClient
}

func NewConnectHandler() *ConnectHandler {
    return &ConnectHandler{
        connectClient: client.NewConnectClient(),
    }
}

// PushToDevices 消息投递到设备
func (h *ConnectHandler) PushToDevices(c *gin.Context) {
    var req connectpb.PushToDevicesRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 400,
            "message": "Invalid request parameters",
            "error": err.Error(),
        })
        return
    }

    // 需要在connect服务器地址配置中选择
    _, err := h.connectClient.PushToDevices(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Push to devices failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
    })
}
```
        return
    }

    // 调用Logic服务
    reply, err := h.logicClient.DeviceSave(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "code": 500,
            "message": "Device registration failed",
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{
            "deviceId": reply.DeviceId,
        },
    })
}

// 其他设备相关方法...
```

#### 5. gRPC客户端封装

```go
// internal/gateway/client/logic.go
package client

import (
    "context"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"

    "gim/config"
    pb "gim/pkg/protocol/pb/logicpb"
)

type LogicClient struct {
    conn            *grpc.ClientConn
    deviceClient    pb.DeviceIntServiceClient
    messageClient   pb.MessageExtServiceClient
    groupClient     pb.GroupIntServiceClient
}

func NewLogicClient() *LogicClient {
    conn, err := grpc.NewClient(
        config.Config.LogicServerAddr,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
        grpc.WithTimeout(5*time.Second),
    )
    if err != nil {
        panic(err)
    }

    return &LogicClient{
        conn:          conn,
        deviceClient:  pb.NewDeviceIntServiceClient(conn),
        messageClient: pb.NewMessageExtServiceClient(conn),
        groupClient:   pb.NewGroupIntServiceClient(conn),
    }
}

// 设备相关方法
func (c *LogicClient) DeviceSave(ctx context.Context, req *pb.DeviceSaveRequest) (*pb.DeviceSaveReply, error) {
    return c.deviceClient.Save(ctx, req)
}

// 其他gRPC调用方法...
```

## 配置变更

### 端口规划

| 服务 | gRPC端口 | HTTP端口 | 说明 |
|-----|----------|----------|------|
| Gateway | - | 8080 | 新增API网关 |
| Business | 8020 | - | 仅gRPC |
| Logic | 8010 | - | 仅gRPC |
| Connect | 8000 | - | WebSocket:8002 |
| File | - | 8085 | 文件服务 |

### 配置文件更新

#### config.go增加网关配置

```go
type Configuration struct {
    // ... 现有配置
    
    // 新增网关配置
    GatewayHTTPListenAddr string
}
```

#### local_builder.go

```go
func (*localBuilder) Build() Configuration {
    return Configuration{
        // ... 现有配置
        
        GatewayHTTPListenAddr: ":8080",
    }
}
```

### Docker Compose配置更新

```yaml
services:
  # 新增API网关服务
  gateway:
    build:
      context: .
      dockerfile: cmd/gateway/Dockerfile
    ports:
      - "8080:8080"
    depends_on:
      - business
      - logic
      - connect
    environment:
      - ENV=compose
    networks:
      - gim-network

  # business服务保持仅gRPC
  business:
    ports:
      - "8020:8020"  # 仅gRPC
```

### Kubernetes配置更新

#### gateway.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      containers:
      - name: gateway
        image: gim/gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: ENV
          value: "k8s"
---
apiVersion: v1
kind: Service
metadata:
  name: gateway-service
spec:
  selector:
    app: gateway
  ports:
    - name: http
      port: 8080
      targetPort: 8080
  type: LoadBalancer
```

## 测试策略

### 单元测试

1. **HTTP接口测试**
   ```go
   func TestDeviceHandler_Save(t *testing.T) {
       // 测试HTTP到gRPC转换
   }
   ```

2. **设备注册集成测试**
   ```go
   func TestDeviceRegistration(t *testing.T) {
       // 端到端测试
   }
   ```

### 前端测试

1. **API客户端测试**
   ```typescript
   test('registerDevice should succeed', async () => {
       const response = await apiClient.registerDevice(mockDevice);
       expect(response.deviceId).toBeDefined();
   });
   ```

## 风险评估

### 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| HTTP/gRPC转换错误 | 高 | 充分单元测试 |
| 网关性能瓶颈 | 中 | 负载均衡和缓存 |
| 跨域问题 | 低 | CORS配置 |

### 兼容性风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 现有gRPC客户端 | 无 | 保持现有接口 |
| 部署配置变更 | 低 | 文档更新 |
| 前端调用变更 | 无 | URL保持不变 |

## 实施计划

### 阶段1：网关服务开发(3天)
1. 创建网关服务框架
2. 实现设备相关HTTP接口
3. 实现用户、消息、群组相关接口
4. 实现认证中间件
5. 单元测试

### 阶段2：配置更新(1天)
1. 更新Docker Compose配置
2. 更新Kubernetes配置
3. 环境配置测试

### 阶段3：前端验证(1天)
1. 验证前端调用
2. 集成测试
3. 文档更新

// ... existing content ...