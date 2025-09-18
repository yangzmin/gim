package jwtlib

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWT密钥，实际项目中应该从配置文件读取
var jwtSecret = []byte("gowebsocket_jwt_secret_key_2024")

// Claims JWT声明结构体
type Claims struct {
	UserID string `json:"userID"`
	AppID  string `json:"appID"`
	jwt.RegisteredClaims
}

/**
 * 生成JWT token
 * @param userID 用户ID
 * @param appID 应用ID
 * @param expireHours token过期时间（小时）
 * @return token字符串和错误信息
 */
func GenerateToken(userID, appID string, expireHours int) (string, error) {
	if userID == "" {
		return "", errors.New("userID不能为空")
	}
	
	// 设置过期时间
	expirationTime := time.Now().Add(time.Duration(expireHours) * time.Hour)
	
	// 创建声明
	claims := &Claims{
		UserID: userID,
		AppID:  appID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "gowebsocket",
			Subject:   userID,
		},
	}
	
	// 创建token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	
	// 签名token
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}
	
	return tokenString, nil
}

/**
 * 验证JWT token
 * @param tokenString token字符串
 * @return Claims和错误信息
 */
func ValidateToken(tokenString string) (*Claims, error) {
	if tokenString == "" {
		return nil, errors.New("token不能为空")
	}
	
	// 解析token
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的签名方法")
		}
		return jwtSecret, nil
	})
	
	if err != nil {
		return nil, err
	}
	
	// 验证token是否有效
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	
	return nil, errors.New("无效的token")
}

/**
 * 刷新JWT token
 * @param tokenString 旧的token字符串
 * @param expireHours 新token过期时间（小时）
 * @return 新token字符串和错误信息
 */
func RefreshToken(tokenString string, expireHours int) (string, error) {
	// 验证旧token
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return "", err
	}
	
	// 生成新token
	return GenerateToken(claims.UserID, claims.AppID, expireHours)
}

/**
 * 从token中提取用户信息
 * @param tokenString token字符串
 * @return userID, appID和错误信息
 */
func ExtractUserInfo(tokenString string) (string, string, error) {
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return "", "", err
	}
	
	return claims.UserID, claims.AppID, nil
}