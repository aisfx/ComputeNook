#!/usr/bin/env bash
# ============================================================
# HPC 骞冲彴 Shell 琛屼负瀹¤ wrapper
# 閮ㄧ讲鍒扮櫥褰曡妭鐐癸細/etc/profile.d/hpc_audit.sh
# 鎵€鏈夌敤鎴风櫥褰曞悗鑷姩鐢熸晥锛岃褰曞懡浠ゅ苟鎷︽埅鍗遍櫓鎿嶄綔
# ============================================================

# 鈹€鈹€ 閰嶇疆 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
HPC_API_URL="${HPC_API_URL:-http://localhost:8080}"
HPC_TOKEN_FILE="${HOME}/.hpc_token"   # hpc-client 鐧诲綍鍚庡啓鍏?token 鐨勪綅缃?HPC_NODE=$(hostname -s)

# 鈹€鈹€ 鍗遍櫓鍛戒护榛戝悕鍗曪紙姝ｅ垯鍖归厤锛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
BLOCKED_PATTERNS=(
    "^rm[[:space:]].*-[^[:space:]]*r[^[:space:]]*[[:space:]].*/"  # rm -rf /...
    "^rm[[:space:]]+-rf[[:space:]]+"                               # rm -rf
    "^rm[[:space:]]+-fr[[:space:]]+"                               # rm -fr
    "^:(){ :|:& };:"                                               # fork bomb
    "^dd[[:space:]].*of=/dev/"                                     # dd 鍐欒澶?    "^mkfs\."                                                      # 鏍煎紡鍖?    "^shutdown"                                                     # 鍏虫満
    "^reboot"                                                       # 閲嶅惎
    "^halt"                                                         # 鍋滄満
    "^poweroff"                                                     # 鏂數
    "^chmod[[:space:]]+-R[[:space:]]+[0-7]*7[[:space:]]*/[[:space:]]*$"  # chmod 777 /
    "^chown[[:space:]].*[[:space:]]*/[[:space:]]*$"                # chown /
    "> /dev/sd"                                                     # 鍐欒８璁惧
)

# 鈹€鈹€ 璀﹀憡鍛戒护锛堝厑璁告墽琛屼絾璁板綍璀﹀憡锛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
WARN_PATTERNS=(
    "^rm[[:space:]]"          # 浠讳綍 rm
    "^kill[[:space:]]+-9"     # kill -9
    "^pkill"                  # pkill
    "^iptables"               # 闃茬伀澧欐搷浣?    "^passwd"                 # 淇敼瀵嗙爜
    "^su[[:space:]]"          # 鍒囨崲鐢ㄦ埛
    "^sudo"                   # sudo
    "^crontab"                # 瀹氭椂浠诲姟
    "^wget.*|.*curl.*>[[:space:]]*/[^t]"  # 涓嬭浇鍐欑郴缁熺洰褰?)

# 鈹€鈹€ 鑾峰彇 token 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_get_token() {
    # 浼樺厛浠庣幆澧冨彉閲忥紝鍏舵浠庢枃浠?    if [ -n "$HPC_SESSION_TOKEN" ]; then
        echo "$HPC_SESSION_TOKEN"
        return
    fi
    if [ -f "$HPC_TOKEN_FILE" ]; then
        cat "$HPC_TOKEN_FILE"
        return
    fi
    echo ""
}

# 鈹€鈹€ 涓婃姤鍛戒护鍒板悗绔?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_report() {
    local cmd="$1"
    local exit_code="${2:-0}"
    local blocked="${3:-false}"
    local token
    token=$(_hpc_get_token)
    [ -z "$token" ] && return

    # 寮傛涓婃姤锛屼笉闃诲鐢ㄦ埛鎿嶄綔
    curl -sf -X POST "${HPC_API_URL}/api/audit/shell" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d "{\"command\":$(echo "$cmd" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo "\"${cmd//\"/\\\"}\""),\"exit_code\":${exit_code},\"work_dir\":\"$(pwd)\",\"node\":\"${HPC_NODE}\",\"blocked\":${blocked}}" \
        --max-time 2 &>/dev/null &
}

# 鈹€鈹€ 妫€鏌ユ槸鍚﹀尮閰嶉粦鍚嶅崟 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_is_blocked() {
    local cmd="$1"
    for pattern in "${BLOCKED_PATTERNS[@]}"; do
        if echo "$cmd" | grep -qE "$pattern" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# 鈹€鈹€ 妫€鏌ユ槸鍚﹀尮閰嶈鍛婂悕鍗?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_is_warn() {
    local cmd="$1"
    for pattern in "${WARN_PATTERNS[@]}"; do
        if echo "$cmd" | grep -qE "$pattern" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# 鈹€鈹€ 涓?PROMPT_COMMAND 閽╁瓙 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_audit_hook() {
    local exit_code=$?
    local last_cmd
    last_cmd=$(history 1 | sed 's/^[[:space:]]*[0-9]*[[:space:]]*//')

    # 璺宠繃绌哄懡浠ゅ拰鍐呴儴鍛戒护
    [ -z "$last_cmd" ] && return
    [ "$last_cmd" = "$_HPC_LAST_CMD" ] && return
    _HPC_LAST_CMD="$last_cmd"

    _hpc_report "$last_cmd" "$exit_code" "false"
}

# 鈹€鈹€ 鍛戒护鎷︽埅锛堥€氳繃 DEBUG trap 鍦ㄦ墽琛屽墠妫€鏌ワ級 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
_hpc_preexec() {
    local cmd="$BASH_COMMAND"

    # 璺宠繃鍐呴儴鍛戒护
    [[ "$cmd" == _hpc_* ]] && return
    [[ "$cmd" == "history"* ]] && return

    if _hpc_is_blocked "$cmd"; then
        # 鎷︽埅锛氭墦鍗拌鍛婏紝缁堟鍛戒护
        echo ""
        echo "鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽" >&2
        echo "鈺? 鉀? HPC 骞冲彴瀹夊叏鎷︽埅                                鈺? >&2
        echo "鈺?                                                     鈺? >&2
        echo "鈺? 璇ュ懡浠ゅ凡琚郴缁熷畨鍏ㄧ瓥鐣ラ樆姝細                        鈺? >&2
        printf "鈺? %-52s鈺慭n" "  $cmd" >&2
        echo "鈺?                                                     鈺? >&2
        echo "鈺? 姝ゆ搷浣滃凡璁板綍骞朵笂鎶ョ鐞嗗憳銆?                         鈺? >&2
        echo "鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆" >&2
        echo ""
        _hpc_report "$cmd" 1 "true"
        # 缁堟褰撳墠鍛戒护锛堥€氳繃璁?bash 璁や负鍛戒护涓嶅瓨鍦級
        kill -SIGINT $$
        return 1
    fi

    if _hpc_is_warn "$cmd"; then
        echo ""
        echo "鈿狅笍  [HPC 瀹夊叏鎻愰啋] 璇ユ搷浣滃凡琚褰曪細$cmd" >&2
        echo ""
    fi
}

# 鈹€鈹€ 瀹夎閽╁瓙锛堜粎浜や簰寮?shell锛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
if [[ $- == *i* ]]; then
    # 杩藉姞鍒?PROMPT_COMMAND锛堜笉瑕嗙洊宸叉湁鐨勶級
    if [[ -z "$PROMPT_COMMAND" ]]; then
        PROMPT_COMMAND="_hpc_audit_hook"
    else
        PROMPT_COMMAND="${PROMPT_COMMAND};_hpc_audit_hook"
    fi

    # DEBUG trap锛氬懡浠ゆ墽琛屽墠瑙﹀彂
    trap '_hpc_preexec' DEBUG

    # 鐧诲綍鎻愮ず
    echo ""
    echo "  鉁?HPC 骞冲彴瀹夊叏瀹¤宸插惎鐢?| 鑺傜偣: ${HPC_NODE} | 鎵€鏈夋搷浣滃皢琚褰?
    echo ""
fi
