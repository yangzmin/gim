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

// Sync 同步消息
func (h *MessageHandler) Sync(c *gin.Context) {
	seqStr := c.Query("seq")
	seq, err := strconv.ParseUint(seqStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid seq parameter",
		})
		return
	}

	reply, err := h.logicClient.MessageExtService.Sync(c.Request.Context(), &logicpb.SyncRequest{
		Seq: seq,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Sync messages failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"messages": reply.Messages,
			"hasMore":  reply.HasMore,
		},
	})
}

// ACK 消息确认
func (h *MessageHandler) ACK(c *gin.Context) {
	var req logicpb.MessageACKRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.MessageIntService.MessageACK(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Message ACK failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// PushToUsers 推送消息给指定用户
func (h *MessageHandler) PushToUsers(c *gin.Context) {
	var req logicpb.PushToUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.MessageIntService.PushToUsers(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Push to users failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// PushToAll 广播消息
func (h *MessageHandler) PushToAll(c *gin.Context) {
	var req logicpb.PushToAllRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.MessageIntService.PushToAll(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Push to all failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}