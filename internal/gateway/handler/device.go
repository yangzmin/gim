package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"gim/internal/gateway/client"
	logicpb "gim/pkg/protocol/pb/logicpb"
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
	var req logicpb.DeviceSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	reply, err := h.logicClient.DeviceIntService.Save(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Device registration failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    gin.H{"deviceId": reply.DeviceId},
	})
}

// SignIn 设备登录
func (h *DeviceHandler) SignIn(c *gin.Context) {
	var req logicpb.SignInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	reply, err := h.logicClient.DeviceIntService.SignIn(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Device sign in failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    gin.H{"deviceId": reply.DeviceId},
	})
}

// Heartbeat 设备心跳
func (h *DeviceHandler) Heartbeat(c *gin.Context) {
	var req logicpb.HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.DeviceIntService.Heartbeat(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Heartbeat failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// Offline 设备离线
func (h *DeviceHandler) Offline(c *gin.Context) {
	var req logicpb.OfflineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.DeviceIntService.Offline(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Device offline failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}