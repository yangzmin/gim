package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"gim/internal/gateway/client"
	connectpb "gim/pkg/protocol/pb/connectpb"
	logicpb "gim/pkg/protocol/pb/logicpb"
)

type ConnectHandler struct {
	connectClient *client.ConnectClient
	logicClient   *client.LogicClient
}

func NewConnectHandler() *ConnectHandler {
	return &ConnectHandler{
		connectClient: client.NewConnectClient(),
		logicClient:   client.NewLogicClient(),
	}
}

// PushToDevices 推送消息到设备
func (h *ConnectHandler) PushToDevices(c *gin.Context) {
	var req connectpb.PushToDevicesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.connectClient.ConnectIntService.PushToDevices(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Push to devices failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// PushRoom 推送房间消息
func (h *ConnectHandler) PushRoom(c *gin.Context) {
	var req logicpb.PushRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.RoomIntService.PushRoom(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Push room failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// SubscribeRoom 订阅房间
func (h *ConnectHandler) SubscribeRoom(c *gin.Context) {
	var req logicpb.SubscribeRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.RoomIntService.SubscribeRoom(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Subscribe room failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}