#!/bin/bash

# 日志查看工具
# 使用方法: ./view_logs.sh [选项]

show_help() {
    echo "日志查看工具"
    echo ""
    echo "用法: ./view_logs.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -f, --follow       实时跟踪日志"
    echo "  -d, --debug        只显示DEBUG日志"
    echo "  -e, --error        只显示ERROR日志"
    echo "  -w, --warn         只显示WARN日志"
    echo "  -a, --all          显示所有日志（默认）"
    echo "  -n, --lines N      显示最后N行（默认50）"
    echo "  -h, --help         显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./view_logs.sh -f              # 实时跟踪所有日志"
    echo "  ./view_logs.sh -d -n 100       # 显示最后100行DEBUG日志"
    echo "  ./view_logs.sh -e              # 显示所有ERROR日志"
}

LOG_FILE="logs/backend.log"
LINES=50
FILTER=""
FOLLOW=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -d|--debug)
            FILTER="DEBUG"
            shift
            ;;
        -e|--error)
            FILTER="ERROR"
            shift
            ;;
        -w|--warn)
            FILTER="WARN"
            shift
            ;;
        -a|--all)
            FILTER=""
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查日志文件是否存在
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 日志文件不存在: $LOG_FILE"
    echo "提示: 请先启动后端服务 (./start.sh)"
    exit 1
fi

echo "=========================================="
echo "查看日志: $LOG_FILE"
if [ -n "$FILTER" ]; then
    echo "过滤: $FILTER"
fi
if [ "$FOLLOW" = true ]; then
    echo "模式: 实时跟踪"
else
    echo "显示: 最后 $LINES 行"
fi
echo "=========================================="
echo ""

# 显示日志
if [ "$FOLLOW" = true ]; then
    if [ -n "$FILTER" ]; then
        tail -f "$LOG_FILE" | grep --line-buffered "\[$FILTER\]"
    else
        tail -f "$LOG_FILE"
    fi
else
    if [ -n "$FILTER" ]; then
        grep "\[$FILTER\]" "$LOG_FILE" | tail -n "$LINES"
    else
        tail -n "$LINES" "$LOG_FILE"
    fi
fi
