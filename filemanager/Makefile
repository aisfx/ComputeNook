.PHONY: all build clean linux windows darwin run install

VERSION := 1.0.0
BUILD_TIME := $(shell date +"%Y-%m-%d %H:%M:%S")
LDFLAGS := -ldflags "-X 'main.Version=$(VERSION)' -X 'main.BuildTime=$(BUILD_TIME)'"

all: build

# 编译所有平台
build: linux windows darwin
	@echo "All builds complete!"

# Linux 版本
linux:
	@echo "Building for Linux AMD64..."
	@mkdir -p build
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o build/filemanager-linux-amd64 .
	@echo "Building for Linux ARM64..."
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o build/filemanager-linux-arm64 .

# Windows 版本
windows:
	@echo "Building for Windows AMD64..."
	@mkdir -p build
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o build/filemanager-windows-amd64.exe .

# macOS 版本
darwin:
	@echo "Building for macOS AMD64..."
	@mkdir -p build
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o build/filemanager-darwin-amd64 .
	@echo "Building for macOS ARM64..."
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o build/filemanager-darwin-arm64 .

# 只编译 Linux AMD64（最常用）
linux-amd64:
	@echo "Building for Linux AMD64..."
	@mkdir -p build
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o build/filemanager-linux-amd64 .
	@echo "Build complete: build/filemanager-linux-amd64"

# 运行服务
run:
	@echo "Starting File Manager Service..."
	go run .

# 安装依赖
install:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

# 清理编译文件
clean:
	@echo "Cleaning build files..."
	rm -rf build
	rm -f filemanager filemanager.exe
	@echo "Clean complete!"

# 显示帮助
help:
	@echo "File Manager Service - Build Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make              - Build all platforms"
	@echo "  make linux        - Build Linux versions (AMD64 + ARM64)"
	@echo "  make linux-amd64  - Build Linux AMD64 only"
	@echo "  make windows      - Build Windows version"
	@echo "  make darwin       - Build macOS versions"
	@echo "  make run          - Run service in development mode"
	@echo "  make install      - Install dependencies"
	@echo "  make clean        - Clean build files"
	@echo "  make help         - Show this help message"
