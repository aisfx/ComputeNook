package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
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
	secret = strings.TrimSpace(secret)
	
	fmt.Println("========================================")
	fmt.Println("Token Matching Test - Method 3")
	fmt.Println("Testing different key decoding methods")
	fmt.Println("========================================")
	
	// 方法1: StdEncoding解码
	privKey1, _ := base64.StdEncoding.DecodeString(secret)
	fmt.Printf("Method 1 - StdEncoding: %d bytes, hex: %x\n", len(privKey1), privKey1[:16])
	
	// 方法2: RawStdEncoding解码
	privKey2, _ := base64.RawStdEncoding.DecodeString(strings.TrimRight(secret, "="))
	fmt.Printf("Method 2 - RawStdEncoding: %d bytes, hex: %x\n", len(privKey2), privKey2[:16])
	
	// 方法3: URLEncoding解码
	privKey3, _ := base64.URLEncoding.DecodeString(secret)
	fmt.Printf("Method 3 - URLEncoding: %d bytes, hex: %x\n", len(privKey3), privKey3[:16])
	
	// 方法4: RawURLEncoding解码
	privKey4, _ := base64.RawURLEncoding.DecodeString(strings.TrimRight(secret, "="))
	fmt.Printf("Method 4 - RawURLEncoding: %d bytes, hex: %x\n", len(privKey4), privKey4[:16])
	
	fmt.Println("========================================")
	
	// 测试每种方法
	methods := []struct{
		name string
		key []byte
	}{
		{"StdEncoding", privKey1},
		{"RawStdEncoding", privKey2},
		{"URLEncoding", privKey3},
		{"RawURLEncoding", privKey4},
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
