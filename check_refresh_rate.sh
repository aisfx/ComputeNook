#!/bin/bash

# 检测前端刷新频率
SERVER=${1:-"hpc"}
DURATION=${2:-10}

echo "监控前端请求频率..."
echo "服务器: $SERVER"
echo "监控时长: ${DURATION}秒"
echo "=============================="

# 创建临时文件记录日志
LOGFILE="/tmp/cn_monitor_$$.log"

echo "开始监控..."
ssh root@${SERVER} "tail -f /root/test/computenook/logs/compute-nook.log 2>/dev/null" > "$LOGFILE" &
TAIL_PID=$!

sleep ${DURATION}
kill $TAIL_PID 2>/dev/null

# 统计各类请求
echo ""
echo "统计结果 (${DURATION}秒):"
echo "=============================="

DASHBOARD_COUNT=$(grep -c "GET.*api/dashboard" "$LOGFILE" 2>/dev/null || echo 0)
MONITORING_COUNT=$(grep -c "GET.*api/monitoring" "$LOGFILE" 2>/dev/null || echo 0)
JOBS_COUNT=$(grep -c "GET.*api/jobs" "$LOGFILE" 2>/dev/null || echo 0)
USAGE_COUNT=$(grep -c "GET.*api/usage" "$LOGFILE" 2>/dev/null || echo 0)
QUOTA_COUNT=$(grep -c "GET.*api/quota" "$LOGFILE" 2>/dev/null || echo 0)
TOTAL_COUNT=$(grep -c "GET.*api/" "$LOGFILE" 2>/dev/null || echo 0)

echo "Dashboard API:       $DASHBOARD_COUNT 次"
echo "Monitoring API:      $MONITORING_COUNT 次"
echo "Jobs API:            $JOBS_COUNT 次"
echo "Usage API:           $USAGE_COUNT 次"
echo "Quota API:           $QUOTA_COUNT 次"
echo "----------------------------"
echo "总请求数:            $TOTAL_COUNT 次"

# 计算平均频率
AVG_RATE=$(echo "scale=2; $TOTAL_COUNT / $DURATION" | bc 2>/dev/null || echo "N/A")
echo "平均频率:            ${AVG_RATE} 次/秒"

# 判断是否正常
echo ""
if [ "$TOTAL_COUNT" -gt 50 ]; then
    echo "❌ 刷新频率过高！前端可能存在无限循环"
    echo ""
    echo "可能的原因："
    echo "1. useEffect 依赖项配置错误"
    echo "2. useCallback 导致函数引用变化"
    echo "3. 轮询间隔设置过短"
    echo ""
    echo "已修复的问题："
    echo "- admin/overview: useEffect([loadData]) -> useEffect([])"
    echo "- user/dashboard: useEffect([refreshAll]) -> useEffect([])"
elif [ "$TOTAL_COUNT" -gt 20 ]; then
    echo "⚠️  刷新频率较高，请检查是否符合预期"
    echo "正常情况下 30 秒刷新一次"
else
    echo "✅ 刷新频率正常"
fi

# 清理
rm -f "$LOGFILE"

echo ""
echo "=============================="
echo "提示: 在浏览器中打开 http://${SERVER}:8081"
echo "然后运行此脚本查看实际请求频率"
