#!/bin/bash

echo "========================================="
echo "Building File Manager Service"
echo "========================================="

# 设置版本号
VERSION="1.0.0"
BUILD_TIME=$(date +"%Y-%m-%d %H:%M:%S")

# 创建 build 目录
mkdir -p build

echo "Building for multiple platforms..."
echo ""

# Linux AMD64
echo "Building for Linux AMD64..."
GOOS=linux GOARCH=amd64 go build -o build/filemanager-linux-amd64 \
    -ldflags "-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'" \
    .
if [ $? -eq 0 ]; then
    echo "✓ Linux AMD64 build successful: build/filemanager-linux-amd64"
else
    echo "✗ Linux AMD64 build failed"
fi
echo ""

# Linux ARM64
echo "Building for Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -o build/filemanager-linux-arm64 \
    -ldflags "-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'" \
    .
if [ $? -eq 0 ]; then
    echo "✓ Linux ARM64 build successful: build/filemanager-linux-arm64"
else
    echo "✗ Linux ARM64 build failed"
fi
echo ""

# Windows AMD64
echo "Building for Windows AMD64..."
GOOS=windows GOARCH=amd64 go build -o build/filemanager-windows-amd64.exe \
    -ldflags "-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'" \
    .
if [ $? -eq 0 ]; then
    echo "✓ Windows AMD64 build successful: build/filemanager-windows-amd64.exe"
else
    echo "✗ Windows AMD64 build failed"
fi
echo ""

# macOS AMD64
echo "Building for macOS AMD64..."
GOOS=darwin GOARCH=amd64 go build -o build/filemanager-darwin-amd64 \
    -ldflags "-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'" \
    .
if [ $? -eq 0 ]; then
    echo "✓ macOS AMD64 build successful: build/filemanager-darwin-amd64"
else
    echo "✗ macOS AMD64 build failed"
fi
echo ""

# macOS ARM64 (Apple Silicon)
echo "Building for macOS ARM64..."
GOOS=darwin GOARCH=arm64 go build -o build/filemanager-darwin-arm64 \
    -ldflags "-X 'main.Version=${VERSION}' -X 'main.BuildTime=${BUILD_TIME}'" \
    .
if [ $? -eq 0 ]; then
    echo "✓ macOS ARM64 build successful: build/filemanager-darwin-arm64"
else
    echo "✗ macOS ARM64 build failed"
fi
echo ""

echo "========================================="
echo "Build Summary"
echo "========================================="
echo "Version: ${VERSION}"
echo "Build Time: ${BUILD_TIME}"
echo ""
echo "Output files:"
ls -lh build/
echo ""
echo "Build complete!"
echo "========================================="
