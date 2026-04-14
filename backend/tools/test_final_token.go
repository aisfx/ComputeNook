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
	// 使用Slurm官方token的时间戳进行验证
	username := "sunfx"
	iat := int64(1773303762)
	exp := int64(1859703762)
	
	secret := "YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI="
	
	// 使用正确的方法：Base64字符串 + 换行符
	signingKey := []byte(secret + "\n")
	
	fmt.Println("========================================")
	fmt.Println("Final Token Generation Test")
	fmt.Println("========================================")
	fmt.Printf("Username: %s\n", username)
	fmt.Printf("IAT: %d\n", iat)
	fmt.Printf("EXP: %d\n", exp)
	fmt.Printf("Signing key length: %d bytes\n", len(signingKey))
	fmt.Println("========================================")
	
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
	h := hmac.New(sha256.New, signingKey)
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	
	// 生成完整token
	token := message + "." + signature
	
	fmt.Printf("Generated token:\n%s\n\n", token)
	
	expectedToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE4NTk3MDM3NjIsImlhdCI6MTc3MzMwMzc2Miwic3VuIjoic3VuZngifQ.YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0"
	fmt.Printf("Expected token:\n%s\n\n", expectedToken)
	
	if token == expectedToken {
		fmt.Println("✓ SUCCESS! Token matches Slurm official token!")
	} else {
		fmt.Println("✗ FAILED! Token does not match")
		fmt.Printf("\nGenerated signature: %s\n", signature)
		fmt.Printf("Expected signature:  YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0\n")
	}
	fmt.Println("========================================")
}
