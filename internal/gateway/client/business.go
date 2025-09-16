package client

import (
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"gim/config"
	businesspb "gim/pkg/protocol/pb/businesspb"
)

var (
	businessClient     businesspb.UserExtServiceClient
	businessIntClient  businesspb.UserIntServiceClient
	friendClient       businesspb.FriendExtServiceClient
	businessClientOnce sync.Once
)

// BusinessClient business服务客户端封装
type BusinessClient struct {
	UserExtService   businesspb.UserExtServiceClient
	UserIntService   businesspb.UserIntServiceClient
	FriendExtService businesspb.FriendExtServiceClient
}

// NewBusinessClient 创建business服务客户端
func NewBusinessClient() *BusinessClient {
	businessClientOnce.Do(func() {
		conn, err := grpc.NewClient(config.Config.BusinessServerAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			panic(err)
		}

		businessClient = businesspb.NewUserExtServiceClient(conn)
		businessIntClient = businesspb.NewUserIntServiceClient(conn)
		friendClient = businesspb.NewFriendExtServiceClient(conn)
	})

	return &BusinessClient{
		UserExtService:   businessClient,
		UserIntService:   businessIntClient,
		FriendExtService: friendClient,
	}
}