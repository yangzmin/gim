// Package home 首页
package home

// Index 聊天页面
// func Index(c *gin.Context) {
// 	appIDStr := c.Query("appID")
// 	appIDUint64, _ := strconv.ParseInt(appIDStr, 10, 32)
// 	appID := uint32(appIDUint64)
// 	if !websocket.InAppIDs(appID) {
// 		appID = websocket.GetDefaultAppID()
// 	}
// 	fmt.Println("http_request 聊天首页", appID)
// 	data := gin.H{
// 		"title":        "聊天首页",
// 		"appID":        appID,
// 		"httpUrl":      viper.GetString("app.httpUrl"),
// 		"webSocketUrl": viper.GetString("app.webSocketUrl"),
// 	}
// 	c.HTML(http.StatusOK, "index.tpl", data)
// }
