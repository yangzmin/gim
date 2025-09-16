package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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