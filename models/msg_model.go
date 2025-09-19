// Package models 数据模型
package models

import "github.com/link1st/gowebsocket/v2/common"

const (
	// MessageTypeText 文本类型消息
	MessageTypeText = "text"
	// MessageTypeAudio 音频类型消息
	MessageTypeAudio = "audio"
	// MessageCmdMsg 文本类型消息
	MessageCmdMsg = "msg"
	// MessageCmdAudio 音频消息
	MessageCmdAudio = "audio"
	// MessageCmdEnter 用户进入类型消息
	MessageCmdEnter = "enter"
	// MessageCmdExit 用户退出类型消息
	MessageCmdExit = "exit"
)

// Message 消息的定义
type Message struct {
	Target string `json:"target"` // 目标
	Type   string `json:"type"`   // 消息类型 text/audio
	Msg    string `json:"msg"`    // 消息内容
	From   string `json:"from"`   // 发送者
}

// ChatMessage 聊天消息结构
type ChatMessage struct {
	ToUserID    string `json:"toUserID"`    // 接收者用户ID
	MessageType string `json:"messageType"` // 消息类型: text/audio
	Content     string `json:"content"`     // 消息内容（文本消息直接存储，音频消息存储base64编码）
	AudioFormat string `json:"audioFormat,omitempty"` // 音频格式，如 "pcm_16k"
	Timestamp   int64  `json:"timestamp"`   // 消息时间戳
}

// AudioMessage 音频消息结构
type AudioMessage struct {
	ToUserID    string `json:"toUserID"`    // 接收者用户ID
	AudioData   string `json:"audioData"`   // 音频数据（base64编码的PCM数据）
	AudioFormat string `json:"audioFormat"` // 音频格式 "pcm_16k"
	Duration    int    `json:"duration"`    // 音频时长（毫秒）
	Timestamp   int64  `json:"timestamp"`   // 消息时间戳
}

// NewMsg 创建新的消息
func NewMsg(from string, Msg string) (message *Message) {
	message = &Message{
		Type: MessageTypeText,
		From: from,
		Msg:  Msg,
	}
	return
}

// NewAudioMsg 创建新的音频消息
func NewAudioMsg(from string, audioData string) (message *Message) {
	message = &Message{
		Type: MessageTypeAudio,
		From: from,
		Msg:  audioData,
	}
	return
}

func getTextMsgData(cmd, uuID, msgID, message string) string {
	textMsg := NewMsg(uuID, message)
	head := NewResponseHead(msgID, cmd, common.OK, "Ok", textMsg)

	return head.String()
}

func getAudioMsgData(cmd, uuID, msgID, audioData string) string {
	audioMsg := NewAudioMsg(uuID, audioData)
	head := NewResponseHead(msgID, cmd, common.OK, "Ok", audioMsg)

	return head.String()
}

// GetMsgData 文本消息
func GetMsgData(uuID, msgID, cmd, message string) string {
	return getTextMsgData(cmd, uuID, msgID, message)
}

// GetTextMsgData 文本消息
func GetTextMsgData(uuID, msgID, message string) string {
	return getTextMsgData("msg", uuID, msgID, message)
}

// GetAudioMsgData 音频消息
func GetAudioMsgData(uuID, msgID, audioData string) string {
	return getAudioMsgData("audio", uuID, msgID, audioData)
}

// GetTextMsgDataEnter 用户进入消息
func GetTextMsgDataEnter(uuID, msgID, message string) string {
	return getTextMsgData("enter", uuID, msgID, message)
}

// GetTextMsgDataExit 用户退出消息
func GetTextMsgDataExit(uuID, msgID, message string) string {
	return getTextMsgData("exit", uuID, msgID, message)
}
