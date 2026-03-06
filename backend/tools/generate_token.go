package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"time"
)

// JWT Header
type JWTHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// JWT Payload
type JWTPayload struct {
	Exp int64  `json:"exp"` // 过期时间
	Iat int64  `json:"iat"` // 签发时间
	Sun string `json:"sun"` // 用户名
}

func main() {
	// 命令行参数
	keyFile := flag.String("key", "/etc/slurm/jwt_hs256.key", "Path to JWT HS256 key file")
	username := flag.String("user", "root", "Username for the token")
	lifespan := flag.Int64("lifespan", 3600, "Token lifespan in seconds (default: 3600)")
	flag.Parse()

	// 读取密钥文件
	keyData, err := ioutil.ReadFile(*keyFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading key file: %v\n", err)
		fmt.Fprintf(os.Stderr, "Usage: generate_token -key /path/to/jwt_hs256.key -user username -lifespan 3600\n")
		os.Exit(1)
	}

	// 去除密钥中的空白字符
	secret := strings.TrimSpace(string(keyData))

	// 创建JWT Header
	header := JWTHeader{
		Alg: "HS256",
		Typ: "JWT",
	}

	// 创建JWT Payload
	now := time.Now().Unix()
	payload := JWTPayload{
		Iat: now,
		Exp: now + *lifespan,
		Sun: *username,
	}

	// 编码Header
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	// 编码Payload
	payloadJSON, _ := json.Marshal(payload)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	// 创建签名
	message := headerB64 + "." + payloadB64
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	// 生成完整的JWT token
	token := message + "." + signature

	// 输出结果
	fmt.Println("========================================")
	fmt.Printf("JWT Token Generated Successfully\n")
	fmt.Println("========================================")
	fmt.Printf("Username:  %s\n", *username)
	fmt.Printf("Issued At: %s\n", time.Unix(now, 0).Format(time.RFC3339))
	fmt.Printf("Expires:   %s\n", time.Unix(now+*lifespan, 0).Format(time.RFC3339))
	fmt.Printf("Lifespan:  %d seconds (%d hours)\n", *lifespan, *lifespan/3600)
	fmt.Println("========================================")
	fmt.Println("Token:")
	fmt.Println(token)
	fmt.Println("========================================")
	fmt.Println("\nTo use this token, update your .env file:")
	fmt.Printf("SLURM_REST_TOKEN=%s\n", token)
	fmt.Println("========================================")
}
