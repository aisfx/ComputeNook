package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

type JWTHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

type JWTPayload struct {
	Exp int64  `json:"exp"`
	Iat int64  `json:"iat"`
	Sun string `json:"sun"`
}

func main() {
	// 使用Slurm官方token的时间戳
	username := "sunfx"
	iat := int64(1773303762)
	exp := int64(1859703762)
	
	secret := "YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI="
	
	fmt.Println("========================================")
	fmt.Println("Token Matching Test - Method 4")
	fmt.Println("Testing: Use key string directly as bytes")
	fmt.Println("========================================")
	
	// 方法1: 直接使用密钥字符串的字节（包含Base64字符和=）
	privKey1 := []byte(secret)
	fmt.Printf("Method 1 - Direct string bytes: %d bytes\n", len(privKey1))
	
	// 方法2: 去掉=后使用字符串字节
	secretNoEquals := "YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI"
	privKey2 := []byte(secretNoEquals)
	fmt.Printf("Method 2 - String bytes without =: %d bytes\n", len(privKey2))
	
	fmt.Println("========================================")
	
	// 测试每种方法
	methods := []struct{
		name string
		key []byte
	}{
		{"Direct string bytes (with =)", privKey1},
		{"String bytes (without =)", privKey2},
	}
	
	for _, method := range methods {
		// 创建Header
		header := JWTHeader{
			Alg: "HS256",
			Typ: "JWT",
		}
		headerJSON, _ := json.Marshal(header)
		headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
		
		// 创建Payload
		payload := JWTPayload{
			Iat: iat,
			Exp: exp,
			Sun: username,
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)
		
		// 创建签名
		message := headerB64 + "." + payloadB64
		h := hmac.New(sha256.New, method.key)
		h.Write([]byte(message))
		signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
		
		match := signature == "YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0"
		fmt.Printf("%s: %s (match: %v)\n", method.name, signature, match)
	}
	
	fmt.Println("========================================")
	fmt.Println("Expected signature: YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0")
	fmt.Println("========================================")
}
