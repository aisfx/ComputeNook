#!/bin/bash
# 测试脚本：读取桌面会话日志

SESSION_ID=${1:-1}
USERNAME=${2:-test1}
HOME_BASE=${HOME_BASE_PATH:-/fs/home}

echo "=== 检查会话 $SESSION_ID 的日志文件 ==="
echo ""

OUT_FILE="$HOME_BASE/$USERNAME/.desktop/$SESSION_ID.out"
ERR_FILE="$HOME_BASE/$USERNAME/.desktop/$SESSION_ID.err"
STATUS_FILE="$HOME_BASE/$USERNAME/.desktop/$SESSION_ID.status"

echo "输出文件: $OUT_FILE"
if [ -f "$OUT_FILE" ]; then
    echo "--- 最后50行 ---"
    tail -n 50 "$OUT_FILE"
else
    echo "文件不存在"
fi

echo ""
echo "错误文件: $ERR_FILE"
if [ -f "$ERR_FILE" ]; then
    echo "--- 最后50行 ---"
    tail -n 50 "$ERR_FILE"
else
    echo "文件不存在"
fi

echo ""
echo "状态文件: $STATUS_FILE"
if [ -f "$STATUS_FILE" ]; then
    echo "--- 内容 ---"
    cat "$STATUS_FILE"
else
    echo "文件不存在"
fi

echo ""
echo "=== Slurm 作业信息 ==="
# 从 desktop_sessions.json 读取 job ID
if [ -f "desktop_sessions.json" ]; then
    JOB_ID=$(grep -A 20 "\"id\": $SESSION_ID" desktop_sessions.json | grep "slurmJobId" | head -1 | grep -oE '[0-9]+')
    if [ -n "$JOB_ID" ]; then
        echo "Job ID: $JOB_ID"
        echo ""
        scontrol show job $JOB_ID 2>/dev/null || echo "作业不存在或已完成"
    fi
fi
