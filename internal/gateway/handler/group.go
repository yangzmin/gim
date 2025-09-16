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
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	reply, err := h.logicClient.GroupIntService.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Create group failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    gin.H{"groupId": reply.GroupId},
	})
}

// Get 获取群组信息
func (h *GroupHandler) Get(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid group ID",
		})
		return
	}

	reply, err := h.logicClient.GroupIntService.Get(c.Request.Context(), &logicpb.GroupGetRequest{
		GroupId: groupID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Get group failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    reply.Group,
	})
}

// Update 更新群组信息
func (h *GroupHandler) Update(c *gin.Context) {
	var req logicpb.GroupUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.GroupIntService.Update(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Update group failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// Push 推送群组消息
func (h *GroupHandler) Push(c *gin.Context) {
	var req logicpb.GroupPushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.logicClient.GroupIntService.Push(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Push to group failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}