package client

import (
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"gim/config"
	logicpb "gim/pkg/protocol/pb/logicpb"
)

var (
	deviceClient      logicpb.DeviceIntServiceClient
	messageExtClient  logicpb.MessageExtServiceClient
	messageIntClient  logicpb.MessageIntServiceClient
	groupClient       logicpb.GroupIntServiceClient
	roomClient        logicpb.RoomIntServiceClient
	logicClientOnce   sync.Once
)

// LogicClient logic服务客户端封装
type LogicClient struct {
	DeviceIntService  logicpb.DeviceIntServiceClient
	MessageExtService logicpb.MessageExtServiceClient
	MessageIntService logicpb.MessageIntServiceClient
	GroupIntService   logicpb.GroupIntServiceClient
	RoomIntService    logicpb.RoomIntServiceClient
}

// NewLogicClient 创建logic服务客户端
func NewLogicClient() *LogicClient {
	logicClientOnce.Do(func() {
		conn, err := grpc.NewClient(config.Config.LogicServerAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			panic(err)
		}

		deviceClient = logicpb.NewDeviceIntServiceClient(conn)
		messageExtClient = logicpb.NewMessageExtServiceClient(conn)
		messageIntClient = logicpb.NewMessageIntServiceClient(conn)
		groupClient = logicpb.NewGroupIntServiceClient(conn)
		roomClient = logicpb.NewRoomIntServiceClient(conn)
	})

	return &LogicClient{
		DeviceIntService:  deviceClient,
		MessageExtService: messageExtClient,
		MessageIntService: messageIntClient,
		GroupIntService:   groupClient,
		RoomIntService:    roomClient,
	}
}