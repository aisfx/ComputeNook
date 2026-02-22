.PHONY: run build clean test install create-user

# 运行服务
run:
	go run main.go

# 编译
build:
	go build -o hpc-backend main.go

# 清理
clean:
	rm -f hpc-backend

# 安装依赖
install:
	go mod download
	go mod tidy

# 创建测试用户
create-user:
	chmod +x create_user.sh
	./create_user.sh

# 启动（带检查）
start:
	chmod +x start.sh
	./start.sh
