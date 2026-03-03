@echo off
echo =========================================
echo Building File Manager Service
echo =========================================

REM 设置版本号
set VERSION=1.0.0
set BUILD_TIME=%date% %time%

REM 创建 build 目录
if not exist build mkdir build

echo Building for multiple platforms...
echo.

REM Linux AMD64
echo Building for Linux AMD64...
set GOOS=linux
set GOARCH=amd64
go build -o build/filemanager-linux-amd64 -ldflags "-X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" .
if %errorlevel% equ 0 (
    echo [OK] Linux AMD64 build successful: build/filemanager-linux-amd64
) else (
    echo [FAIL] Linux AMD64 build failed
)
echo.

REM Linux ARM64
echo Building for Linux ARM64...
set GOOS=linux
set GOARCH=arm64
go build -o build/filemanager-linux-arm64 -ldflags "-X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" .
if %errorlevel% equ 0 (
    echo [OK] Linux ARM64 build successful: build/filemanager-linux-arm64
) else (
    echo [FAIL] Linux ARM64 build failed
)
echo.

REM Windows AMD64
echo Building for Windows AMD64...
set GOOS=windows
set GOARCH=amd64
go build -o build/filemanager-windows-amd64.exe -ldflags "-X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" .
if %errorlevel% equ 0 (
    echo [OK] Windows AMD64 build successful: build/filemanager-windows-amd64.exe
) else (
    echo [FAIL] Windows AMD64 build failed
)
echo.

REM macOS AMD64
echo Building for macOS AMD64...
set GOOS=darwin
set GOARCH=amd64
go build -o build/filemanager-darwin-amd64 -ldflags "-X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" .
if %errorlevel% equ 0 (
    echo [OK] macOS AMD64 build successful: build/filemanager-darwin-amd64
) else (
    echo [FAIL] macOS AMD64 build failed
)
echo.

REM macOS ARM64
echo Building for macOS ARM64...
set GOOS=darwin
set GOARCH=arm64
go build -o build/filemanager-darwin-arm64 -ldflags "-X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" .
if %errorlevel% equ 0 (
    echo [OK] macOS ARM64 build successful: build/filemanager-darwin-arm64
) else (
    echo [FAIL] macOS ARM64 build failed
)
echo.

echo =========================================
echo Build Summary
echo =========================================
echo Version: %VERSION%
echo Build Time: %BUILD_TIME%
echo.
echo Output files:
dir /B build\
echo.
echo Build complete!
echo =========================================

pause
