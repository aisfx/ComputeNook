#!/bin/bash
# 测试配额查询脚本

echo "=== 配额诊断脚本 ==="
echo ""

# 1. 检查环境变量
echo "1. 环境变量配置:"
echo "   QUOTA_FS_TYPE: ${QUOTA_FS_TYPE:-未设置}"
echo "   QUOTA_PATH: ${QUOTA_PATH:-未设置}"
echo "   FILEMANAGER_BASE_PATH: ${FILEMANAGER_BASE_PATH:-未设置}"
echo ""

# 2. 检测文件系统类型
HOME_PATH="${FILEMANAGER_BASE_PATH:-/home}"
echo "2. 检测 $HOME_PATH 的文件系统类型:"
if command -v findmnt &>/dev/null; then
    FS_TYPE=$(findmnt -n -o FSTYPE "$HOME_PATH" 2>/dev/null)
    echo "   findmnt 结果: $FS_TYPE"
else
    echo "   findmnt 命令不存在"
fi

# 从 /proc/mounts 检查
FS_FROM_PROC=$(grep " $HOME_PATH " /proc/mounts 2>/dev/null | awk '{print $3}')
echo "   /proc/mounts 结果: ${FS_FROM_PROC:-未找到}"
echo ""

# 3. 测试配额命令
echo "3. 测试配额查询命令:"
TEST_USER="${1:-test1}"

# Lustre
if command -v lfs &>/dev/null; then
    echo "   [Lustre] lfs quota -u $TEST_USER $HOME_PATH"
    lfs quota -u "$TEST_USER" "$HOME_PATH" 2>&1 | head -5
else
    echo "   [Lustre] lfs 命令不存在"
fi
echo ""

# NFS/标准 quota
if command -v quota &>/dev/null; then
    echo "   [NFS/标准] quota -u $TEST_USER -f $HOME_PATH --no-wrap"
    quota -u "$TEST_USER" -f "$HOME_PATH" --no-wrap 2>&1 | head -5
else
    echo "   [NFS/标准] quota 命令不存在"
fi
echo ""

# XFS
if command -v xfs_quota &>/dev/null; then
    echo "   [XFS] xfs_quota -x -c 'report -ubih' $HOME_PATH"
    xfs_quota -x -c "report -ubih" "$HOME_PATH" 2>&1 | grep -A 1 "$TEST_USER"
else
    echo "   [XFS] xfs_quota 命令不存在"
fi
echo ""

# 4. 检查用户目录
echo "4. 检查用户目录:"
if [ -d "$HOME_PATH/$TEST_USER" ]; then
    echo "   $HOME_PATH/$TEST_USER 存在"
    du -sh "$HOME_PATH/$TEST_USER" 2>/dev/null || echo "   无法获取目录大小"
else
    echo "   $HOME_PATH/$TEST_USER 不存在"
fi
echo ""

echo "=== 诊断完成 ==="
