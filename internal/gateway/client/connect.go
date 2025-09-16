package client

import (
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"gim/config"
	connectpb "gim/pkg/protocol/pb/connectpb"
)

var (
	connectIntClient connectpb.ConnectIntServiceClient
	connectClientOnce sync.Once
)

// ConnectClient connect服务客户端封装
type ConnectClient struct {
	ConnectIntService connectpb.ConnectIntServiceClient
}

// NewConnectClient 创建connect服务客户端
func NewConnectClient() *ConnectClient {
	connectClientOnce.Do(func() {
		conn, err := grpc.NewClient(config.Config.ConnectServerAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			panic(err)
		}

		connectIntClient = connectpb.NewConnectIntServiceClient(conn)
	})

	return &ConnectClient{
		ConnectIntService: connectIntClient,
	}
}