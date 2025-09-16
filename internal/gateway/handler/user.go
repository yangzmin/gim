package handler

import (
	"net/http"

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
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	reply, err := h.businessClient.UserExtService.SignIn(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Sign in failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    reply,
	})
}

// GetProfile 获取用户信息
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.GetUint64("userID")

	reply, err := h.businessClient.UserIntService.GetUser(c.Request.Context(), &businesspb.GetUserRequest{
		UserId: userID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Get user failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    reply.User,
	})
}

// UpdateUser 更新用户信息
func (h *UserHandler) UpdateUser(c *gin.Context) {
	var req businesspb.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.businessClient.UserExtService.UpdateUser(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Update user failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// SearchUser 搜索用户
func (h *UserHandler) SearchUser(c *gin.Context) {
	keyword := c.Query("key")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Missing search keyword",
		})
		return
	}

	reply, err := h.businessClient.UserExtService.SearchUser(c.Request.Context(), &businesspb.SearchUserRequest{
		Key: keyword,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Search user failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    reply.Users,
	})
}

// Auth 用户认证
func (h *UserHandler) Auth(c *gin.Context) {
	var req businesspb.AuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	_, err := h.businessClient.UserIntService.Auth(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "Authentication failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

// GetUsers 批量获取用户
func (h *UserHandler) GetUsers(c *gin.Context) {
	var req businesspb.GetUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
		return
	}

	reply, err := h.businessClient.UserIntService.GetUsers(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "Get users failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    reply.Users,
	})
}