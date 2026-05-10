#!/usr/bin/env bash
# 璁剧疆鐢ㄦ埛 inode 閰嶉鐨勮剼鏈?
USERNAME=${1}
INODE_SOFT=${2:-100000}  # 榛樿杞檺鍒?10涓囦釜鏂囦欢
INODE_HARD=${3:-150000}  # 榛樿纭檺鍒?15涓囦釜鏂囦欢
BLOCK_SOFT=${4:-45000000}  # 榛樿 45GB (KB)
BLOCK_HARD=${5:-50000000}  # 榛樿 50GB (KB)

if [ -z "$USERNAME" ]; then
    echo "鐢ㄦ硶: $0 <username> [inode_soft] [inode_hard] [block_soft_kb] [block_hard_kb]"
    echo ""
    echo "绀轰緥:"
    echo "  $0 test1                    # 浣跨敤榛樿鍊?
    echo "  $0 test1 100000 150000      # 鑷畾涔?inode 閰嶉"
    echo "  $0 test1 100000 150000 45000000 50000000  # 瀹屾暣閰嶇疆"
    echo ""
    echo "榛樿鍊?"
    echo "  inode_soft: 100000 (10涓囦釜鏂囦欢)"
    echo "  inode_hard: 150000 (15涓囦釜鏂囦欢)"
    echo "  block_soft: 45000000 KB (45 GB)"
    echo "  block_hard: 50000000 KB (50 GB)"
    exit 1
fi

# 妫€娴嬫枃浠剁郴缁熺被鍨?QUOTA_PATH=${QUOTA_PATH:-/fs/home}
FS_TYPE=$(findmnt -n -o FSTYPE "$QUOTA_PATH" 2>/dev/null)

if [ -z "$FS_TYPE" ]; then
    echo "閿欒: 鏃犳硶妫€娴?$QUOTA_PATH 鐨勬枃浠剁郴缁熺被鍨?
    exit 1
fi

echo "=== 璁剧疆鐢ㄦ埛閰嶉 ==="
echo "鐢ㄦ埛: $USERNAME"
echo "鏂囦欢绯荤粺: $QUOTA_PATH ($FS_TYPE)"
echo "Block 閰嶉: $BLOCK_SOFT KB (soft) / $BLOCK_HARD KB (hard)"
echo "Inode 閰嶉: $INODE_SOFT (soft) / $INODE_HARD (hard)"
echo ""

case "$FS_TYPE" in
    *lustre*)
        echo "妫€娴嬪埌 Lustre 鏂囦欢绯荤粺"
        CMD="lfs setquota -u $USERNAME --block-softlimit ${BLOCK_SOFT}k --block-hardlimit ${BLOCK_HARD}k --inode-softlimit $INODE_SOFT --inode-hardlimit $INODE_HARD $QUOTA_PATH"
        echo "鎵ц鍛戒护: $CMD"
        $CMD
        if [ $? -eq 0 ]; then
            echo "鉁?閰嶉璁剧疆鎴愬姛"
            echo ""
            echo "鏌ョ湅閰嶉:"
            lfs quota -u $USERNAME $QUOTA_PATH
        else
            echo "鉁?閰嶉璁剧疆澶辫触"
            exit 1
        fi
        ;;
    nfs|nfs4)
        echo "妫€娴嬪埌 NFS 鏂囦欢绯荤粺"
        CMD="setquota -u $USERNAME $BLOCK_SOFT $BLOCK_HARD $INODE_SOFT $INODE_HARD $QUOTA_PATH"
        echo "鎵ц鍛戒护: $CMD"
        $CMD
        if [ $? -eq 0 ]; then
            echo "鉁?閰嶉璁剧疆鎴愬姛"
            echo ""
            echo "鏌ョ湅閰嶉:"
            quota -u $USERNAME -f $QUOTA_PATH
        else
            echo "鉁?閰嶉璁剧疆澶辫触"
            exit 1
        fi
        ;;
    xfs)
        echo "妫€娴嬪埌 XFS 鏂囦欢绯荤粺"
        CMD="xfs_quota -x -c \"limit -u bsoft=${BLOCK_SOFT}k bhard=${BLOCK_HARD}k isoft=$INODE_SOFT ihard=$INODE_HARD $USERNAME\" $QUOTA_PATH"
        echo "鎵ц鍛戒护: $CMD"
        eval $CMD
        if [ $? -eq 0 ]; then
            echo "鉁?閰嶉璁剧疆鎴愬姛"
            echo ""
            echo "鏌ョ湅閰嶉:"
            xfs_quota -x -c "report -ubih" $QUOTA_PATH | grep $USERNAME
        else
            echo "鉁?閰嶉璁剧疆澶辫触"
            exit 1
        fi
        ;;
    *)
        echo "閿欒: 涓嶆敮鎸佺殑鏂囦欢绯荤粺绫诲瀷: $FS_TYPE"
        echo "鏀寔鐨勭被鍨? lustre, nfs, nfs4, xfs"
        exit 1
        ;;
esac
