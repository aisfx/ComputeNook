#!/usr/bin/env bash
# 娓呯悊鐢ㄦ埛纾佺洏绌洪棿鑴氭湰

USERNAME=${1:-test1}
HOME_BASE=${HOME_BASE_PATH:-/fs/home}
USER_HOME="$HOME_BASE/$USERNAME"

echo "=== 娓呯悊鐢ㄦ埛 $USERNAME 鐨勭鐩樼┖闂?==="
echo "鐢ㄦ埛鐩綍: $USER_HOME"
echo ""

if [ ! -d "$USER_HOME" ]; then
    echo "閿欒: 鐢ㄦ埛鐩綍涓嶅瓨鍦?
    exit 1
fi

# 1. 娓呯悊鏃х殑 xpra 浣滀笟鐩綍锛堜繚鐣欐渶杩?涓級
echo "1. 娓呯悊鏃х殑 xpra 浣滀笟鐩綍..."
if [ -d "$USER_HOME/.xpra" ]; then
    OLD_DIRS=$(ls -dt "$USER_HOME/.xpra/job-"* 2>/dev/null | tail -n +4)
    if [ -n "$OLD_DIRS" ]; then
        echo "$OLD_DIRS" | while read dir; do
            echo "  鍒犻櫎: $dir"
            rm -rf "$dir"
        done
        echo "  宸叉竻鐞嗘棫鐨?xpra 鐩綍"
    else
        echo "  鏃犻渶娓呯悊"
    fi
else
    echo "  .xpra 鐩綍涓嶅瓨鍦?
fi

# 2. 娓呯悊鏃х殑妗岄潰鏃ュ織鏂囦欢锛堜繚鐣欐渶杩?0涓級
echo ""
echo "2. 娓呯悊鏃х殑妗岄潰鏃ュ織鏂囦欢..."
if [ -d "$USER_HOME/.desktop" ]; then
    # 娓呯悊 .out 鏂囦欢
    OLD_OUT=$(ls -t "$USER_HOME/.desktop/"*.out 2>/dev/null | tail -n +11)
    if [ -n "$OLD_OUT" ]; then
        echo "$OLD_OUT" | while read f; do
            echo "  鍒犻櫎: $f"
            rm -f "$f"
        done
    fi
    
    # 娓呯悊 .err 鏂囦欢
    OLD_ERR=$(ls -t "$USER_HOME/.desktop/"*.err 2>/dev/null | tail -n +11)
    if [ -n "$OLD_ERR" ]; then
        echo "$OLD_ERR" | while read f; do
            echo "  鍒犻櫎: $f"
            rm -f "$f"
        done
    fi
    
    # 娓呯悊 .status 鏂囦欢
    OLD_STATUS=$(ls -t "$USER_HOME/.desktop/"*.status 2>/dev/null | tail -n +11)
    if [ -n "$OLD_STATUS" ]; then
        echo "$OLD_STATUS" | while read f; do
            echo "  鍒犻櫎: $f"
            rm -f "$f"
        done
    fi
    echo "  宸叉竻鐞嗘棫鐨勬棩蹇楁枃浠?
else
    echo "  .desktop 鐩綍涓嶅瓨鍦?
fi

# 3. 娓呯悊 /tmp 涓嬬殑鍍靛案 X 閿佹枃浠?echo ""
echo "3. 娓呯悊 /tmp 涓嬬殑鍍靛案 X 閿佹枃浠?.."
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
        echo "  娓呯悊鍍靛案閿? $lf (杩涚▼ $_pid 涓嶅瓨鍦?"
        CLEANED=$((CLEANED + 1))
    fi
done
echo "  娓呯悊浜?$CLEANED 涓兊灏搁攣鏂囦欢"

# 4. 鏄剧ず纾佺洏浣跨敤鎯呭喌
echo ""
echo "=== 娓呯悊瀹屾垚 ==="
echo ""
echo "褰撳墠纾佺洏浣跨敤鎯呭喌:"
du -sh "$USER_HOME" 2>/dev/null || echo "鏃犳硶鑾峰彇纾佺洏浣跨敤鎯呭喌"

if command -v quota &>/dev/null; then
    echo ""
    echo "閰嶉淇℃伅:"
    quota -u $USERNAME 2>/dev/null || echo "鏃犳硶鑾峰彇閰嶉淇℃伅"
fi
