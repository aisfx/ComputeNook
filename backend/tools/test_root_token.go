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
	// 从Slurm官方token解析出的时间戳
	username := "root"
	iat := int64(1775992174)
	exp := int64(1775993974)
	
	secret := "YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI="
	
	// 使用正确的方法：Base64字符串 + 换行符
	signingKey := []byte(secret + "\n")
	
	fmt.Println("========================================")
	fmt.Println("Root Token Verification Test")
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
	
	fmt.Printf("Payload JSON: %s\n", string(payloadJSON))
	fmt.Printf("Payload B64: %s\n\n", payloadB64)
	
	// 创建签名
	message := headerB64 + "." + payloadB64
	h := hmac.New(sha256.New, signingKey)
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	
	// 生成完整token
	token := message + "." + signature
	
	fmt.Printf("Generated token:\n%s\n\n", token)
	
	expectedToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzU5OTM5NzQsImlhdCI6MTc3NTk5MjE3NCwic3VuIjoicm9vdCJ9.We-yD8hsoft9MH7ynXDDRXYf-3qRLKMlaWxKMYAWvkQ"
	fmt.Printf("Expected token:\n%s\n\n", expectedToken)
	
	// 解析expected token的payload
	parts := []string{
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
		"eyJleHAiOjE3NzU5OTM5NzQsImlhdCI6MTc3NTk5MjE3NCwic3VuIjoicm9vdCJ9",
		"We-yD8hsoft9MH7ynXDDRXYf-3qRLKMlaWxKMYAWvkQ",
	}
	
	expectedPayloadJSON, _ := base64.RawURLEncoding.DecodeString(parts[1])
	fmt.Printf("Expected payload JSON: %s\n", string(expectedPayloadJSON))
	fmt.Printf("Expected signature: %s\n", parts[2])
	fmt.Printf("Generated signature: %s\n\n", signature)
	
	if token == expectedToken {
		fmt.Println("✓ SUCCESS! Token matches Slurm official token!")
	} else {
		fmt.Println("✗ FAILED! Token does not match")
		
		if signature == parts[2] {
			fmt.Println("  Signature matches! Issue is in header or payload encoding")
		} else {
			fmt.Println("  Signature does NOT match")
		}
	}
	fmt.Println("========================================")
}
