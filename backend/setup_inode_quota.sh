#!/bin/bash
# 设置用户 inode 配额的脚本

USERNAME=${1}
INODE_SOFT=${2:-100000}  # 默认软限制 10万个文件
INODE_HARD=${3:-150000}  # 默认硬限制 15万个文件
BLOCK_SOFT=${4:-45000000}  # 默认 45GB (KB)
BLOCK_HARD=${5:-50000000}  # 默认 50GB (KB)

if [ -z "$USERNAME" ]; then
    echo "用法: $0 <username> [inode_soft] [inode_hard] [block_soft_kb] [block_hard_kb]"
    echo ""
    echo "示例:"
    echo "  $0 test1                    # 使用默认值"
    echo "  $0 test1 100000 150000      # 自定义 inode 配额"
    echo "  $0 test1 100000 150000 45000000 50000000  # 完整配置"
    echo ""
    echo "默认值:"
    echo "  inode_soft: 100000 (10万个文件)"
    echo "  inode_hard: 150000 (15万个文件)"
    echo "  block_soft: 45000000 KB (45 GB)"
    echo "  block_hard: 50000000 KB (50 GB)"
    exit 1
fi

# 检测文件系统类型
QUOTA_PATH=${QUOTA_PATH:-/fs/home}
FS_TYPE=$(findmnt -n -o FSTYPE "$QUOTA_PATH" 2>/dev/null)

if [ -z "$FS_TYPE" ]; then
    echo "错误: 无法检测 $QUOTA_PATH 的文件系统类型"
    exit 1
fi

echo "=== 设置用户配额 ==="
echo "用户: $USERNAME"
echo "文件系统: $QUOTA_PATH ($FS_TYPE)"
echo "Block 配额: $BLOCK_SOFT KB (soft) / $BLOCK_HARD KB (hard)"
echo "Inode 配额: $INODE_SOFT (soft) / $INODE_HARD (hard)"
echo ""

case "$FS_TYPE" in
    *lustre*)
        echo "检测到 Lustre 文件系统"
        CMD="lfs setquota -u $USERNAME --block-softlimit ${BLOCK_SOFT}k --block-hardlimit ${BLOCK_HARD}k --inode-softlimit $INODE_SOFT --inode-hardlimit $INODE_HARD $QUOTA_PATH"
        echo "执行命令: $CMD"
        $CMD
        if [ $? -eq 0 ]; then
            echo "✓ 配额设置成功"
            echo ""
            echo "查看配额:"
            lfs quota -u $USERNAME $QUOTA_PATH
        else
            echo "✗ 配额设置失败"
            exit 1
        fi
        ;;
    nfs|nfs4)
        echo "检测到 NFS 文件系统"
        CMD="setquota -u $USERNAME $BLOCK_SOFT $BLOCK_HARD $INODE_SOFT $INODE_HARD $QUOTA_PATH"
        echo "执行命令: $CMD"
        $CMD
        if [ $? -eq 0 ]; then
            echo "✓ 配额设置成功"
            echo ""
            echo "查看配额:"
            quota -u $USERNAME -f $QUOTA_PATH
        else
            echo "✗ 配额设置失败"
            exit 1
        fi
        ;;
    xfs)
        echo "检测到 XFS 文件系统"
        CMD="xfs_quota -x -c \"limit -u bsoft=${BLOCK_SOFT}k bhard=${BLOCK_HARD}k isoft=$INODE_SOFT ihard=$INODE_HARD $USERNAME\" $QUOTA_PATH"
        echo "执行命令: $CMD"
        eval $CMD
        if [ $? -eq 0 ]; then
            echo "✓ 配额设置成功"
            echo ""
            echo "查看配额:"
            xfs_quota -x -c "report -ubih" $QUOTA_PATH | grep $USERNAME
        else
            echo "✗ 配额设置失败"
            exit 1
        fi
        ;;
    *)
        echo "错误: 不支持的文件系统类型: $FS_TYPE"
        echo "支持的类型: lustre, nfs, nfs4, xfs"
        exit 1
        ;;
esac
