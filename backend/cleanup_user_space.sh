#!/bin/bash
# 清理用户磁盘空间脚本

USERNAME=${1:-test1}
HOME_BASE=${HOME_BASE_PATH:-/fs/home}
USER_HOME="$HOME_BASE/$USERNAME"

echo "=== 清理用户 $USERNAME 的磁盘空间 ==="
echo "用户目录: $USER_HOME"
echo ""

if [ ! -d "$USER_HOME" ]; then
    echo "错误: 用户目录不存在"
    exit 1
fi

# 1. 清理旧的 xpra 作业目录（保留最近3个）
echo "1. 清理旧的 xpra 作业目录..."
if [ -d "$USER_HOME/.xpra" ]; then
    OLD_DIRS=$(ls -dt "$USER_HOME/.xpra/job-"* 2>/dev/null | tail -n +4)
    if [ -n "$OLD_DIRS" ]; then
        echo "$OLD_DIRS" | while read dir; do
            echo "  删除: $dir"
            rm -rf "$dir"
        done
        echo "  已清理旧的 xpra 目录"
    else
        echo "  无需清理"
    fi
else
    echo "  .xpra 目录不存在"
fi

# 2. 清理旧的桌面日志文件（保留最近10个）
echo ""
echo "2. 清理旧的桌面日志文件..."
if [ -d "$USER_HOME/.desktop" ]; then
    # 清理 .out 文件
    OLD_OUT=$(ls -t "$USER_HOME/.desktop/"*.out 2>/dev/null | tail -n +11)
    if [ -n "$OLD_OUT" ]; then
        echo "$OLD_OUT" | while read f; do
            echo "  删除: $f"
            rm -f "$f"
        done
    fi
    
    # 清理 .err 文件
    OLD_ERR=$(ls -t "$USER_HOME/.desktop/"*.err 2>/dev/null | tail -n +11)
    if [ -n "$OLD_ERR" ]; then
        echo "$OLD_ERR" | while read f; do
            echo "  删除: $f"
            rm -f "$f"
        done
    fi
    
    # 清理 .status 文件
    OLD_STATUS=$(ls -t "$USER_HOME/.desktop/"*.status 2>/dev/null | tail -n +11)
    if [ -n "$OLD_STATUS" ]; then
        echo "$OLD_STATUS" | while read f; do
            echo "  删除: $f"
            rm -f "$f"
        done
    fi
    echo "  已清理旧的日志文件"
else
    echo "  .desktop 目录不存在"
fi

# 3. 清理 /tmp 下的僵尸 X 锁文件
echo ""
echo "3. 清理 /tmp 下的僵尸 X 锁文件..."
CLEANED=0
for lf in /tmp/.X[0-9]*-lock; do
    [ -f "$lf" ] || continue
    _pid=$(cat "$lf" 2>/dev/null | tr -d ' \n')
    if [ -z "$_pid" ]; then
        rm -f "$lf"
        CLEANED=$((CLEANED + 1))
        continue
    fi
    if ! kill -0 "$_pid" 2>/dev/null; then
        _d=$(basename "$lf" | grep -oE '[0-9]+')
        rm -f "$lf" /tmp/.X11-unix/X${_d} 2>/dev/null
        echo "  清理僵尸锁: $lf (进程 $_pid 不存在)"
        CLEANED=$((CLEANED + 1))
    fi
done
echo "  清理了 $CLEANED 个僵尸锁文件"

# 4. 显示磁盘使用情况
echo ""
echo "=== 清理完成 ==="
echo ""
echo "当前磁盘使用情况:"
du -sh "$USER_HOME" 2>/dev/null || echo "无法获取磁盘使用情况"

if command -v quota &>/dev/null; then
    echo ""
    echo "配额信息:"
    quota -u $USERNAME 2>/dev/null || echo "无法获取配额信息"
fi
