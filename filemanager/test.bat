@echo off
echo =========================================
echo File Manager Service - Quick Test
echo =========================================

REM 检查服务是否运行
echo Checking if service is running...
curl -s http://localhost:8081/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Service is running
) else (
    echo [FAIL] Service is not running
    echo Please start the service first: filemanager.exe
    exit /b 1
)

echo.
echo Testing API endpoints...
echo.

REM 测试列出根目录
echo 1. Testing list directory ^(C:\^)...
curl -s "http://localhost:8081/api/files/list?path=C:\"
echo.

REM 测试健康检查
echo 2. Testing health check...
curl -s "http://localhost:8081/health"
echo.

echo =========================================
echo Test complete!
echo =========================================
echo.
echo To change configuration, edit .env file

pause
