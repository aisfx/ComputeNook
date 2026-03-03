@echo off
echo =========================================
echo Starting File Manager Service
echo =========================================

REM 检查 .env 文件是否存在
if not exist .env (
    echo Error: .env file not found
    echo Please create .env file with required configuration
    exit /b 1
)

REM 显示配置
echo Building...
go build -o filemanager.exe

if %errorlevel% equ 0 (
    echo Build successful!
    echo Starting service...
    filemanager.exe
) else (
    echo Build failed!
    exit /b 1
)
