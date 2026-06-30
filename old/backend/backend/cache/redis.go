package cache

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	Client *redis.Client
	ctx    = context.Background()
)

// InitRedis 初始化Redis客户端
func InitRedis() error {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	password := os.Getenv("REDIS_PASSWORD")
	
	db := 0
	if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
		if dbNum, err := strconv.Atoi(dbStr); err == nil {
			db = dbNum
		}
	}

	poolSize := 50
	if poolStr := os.Getenv("REDIS_POOL_SIZE"); poolStr != "" {
		if poolNum, err := strconv.Atoi(poolStr); err == nil && poolNum > 0 {
			poolSize = poolNum
		}
	}

	Client = redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		PoolSize:     poolSize,
		MinIdleConns: 10,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// 测试连接
	if err := Client.Ping(ctx).Err(); err != nil {
		return err
	}

	log.Printf("Redis connected: %s (DB: %d, Pool: %d)", addr, db, poolSize)
	return nil
}

// Close 关闭Redis连接
func Close() {
	if Client != nil {
		Client.Close()
		log.Println("Redis connection closed")
	}
}

// IsEnabled 检查Redis是否启用
func IsEnabled() bool {
	return Client != nil && Client.Ping(ctx).Err() == nil
}
