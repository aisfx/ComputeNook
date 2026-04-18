.PHONY: run build clean test install create-user

# 运行服务（自动查找 .env 或 ../.env）
run:
	go run .

# 编译
build:
	go build -o hpc-backend .

# 清理
clean:
	rm -f hpc-backend

# 安装依赖
install:
	go mod download
	go mod tidy
