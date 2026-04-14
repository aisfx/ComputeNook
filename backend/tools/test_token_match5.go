package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
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

func testMethod(name string, key []byte, iat, exp int64, username string) {
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
	h := hmac.New(sha256.New, key)
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	
	match := signature == "YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0"
	fmt.Printf("%s:\n", name)
	fmt.Printf("  Key length: %d bytes\n", len(key))
	fmt.Printf("  Key (hex): %x\n", key[:min(32, len(key))])
	fmt.Printf("  Signature: %s\n", signature)
	fmt.Printf("  Match: %v\n\n", match)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	username := "sunfx"
	iat := int64(1773303762)
	exp := int64(1859703762)
	
	secret := "YEoqs4yNYiqeL6X4CHmAokT0cm+yBr7qUT1bxHGUMYI="
	
	fmt.Println("========================================")
	fmt.Println("Token Matching Test - Method 5")
	fmt.Println("Comprehensive key format testing")
	fmt.Println("========================================\n")
	
	// 方法1: StdEncoding解码
	key1, _ := base64.StdEncoding.DecodeString(secret)
	testMethod("Method 1: base64.StdEncoding.DecodeString", key1, iat, exp, username)
	
	// 方法2: 直接使用字符串字节
	key2 := []byte(secret)
	testMethod("Method 2: Direct string bytes", key2, iat, exp, username)
	
	// 方法3: 模拟Python的文件读取 - 创建临时文件测试
	tmpFile := "/tmp/test_jwt_key.txt"
	ioutil.WriteFile(tmpFile, []byte(secret), 0644)
	key3, _ := ioutil.ReadFile(tmpFile)
	testMethod("Method 3: Read from file (simulating Python)", key3, iat, exp, username)
	
	// 方法4: 去掉换行符后的文件读取
	ioutil.WriteFile(tmpFile, []byte(secret+"\n"), 0644)
	key4, _ := ioutil.ReadFile(tmpFile)
	testMethod("Method 4: Read from file with newline", key4, iat, exp, username)
	
	// 方法5: 尝试hex解码（如果密钥是hex编码的）
	// 先Base64解码，然后看看是否需要进一步处理
	decoded, _ := base64.StdEncoding.DecodeString(secret)
	fmt.Printf("Decoded key as string: %q\n", string(decoded))
	fmt.Printf("Decoded key as hex: %x\n\n", decoded)
	
	fmt.Println("========================================")
	fmt.Println("Expected signature: YsVeG_82b3MewadlvVxC_gzkvgfQMlXLrJD2OtmdFY0")
	fmt.Println("========================================")
}
