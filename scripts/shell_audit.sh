#!/bin/bash
# ============================================================
# HPC 平台 Shell 行为审计 wrapper
# 部署到登录节点：/etc/profile.d/hpc_audit.sh
# 所有用户登录后自动生效，记录命令并拦截危险操作
# ============================================================

# ── 配置 ────────────────────────────────────────────────────
HPC_API_URL="${HPC_API_URL:-http://localhost:8080}"
HPC_TOKEN_FILE="${HOME}/.hpc_token"   # hpc-client 登录后写入 token 的位置
HPC_NODE=$(hostname -s)

# ── 危险命令黑名单（正则匹配） ────────────────────────────────
BLOCKED_PATTERNS=(
    "^rm[[:space:]].*-[^[:space:]]*r[^[:space:]]*[[:space:]].*/"  # rm -rf /...
    "^rm[[:space:]]+-rf[[:space:]]+"                               # rm -rf
    "^rm[[:space:]]+-fr[[:space:]]+"                               # rm -fr
    "^:(){ :|:& };:"                                               # fork bomb
    "^dd[[:space:]].*of=/dev/"                                     # dd 写设备
    "^mkfs\."                                                      # 格式化
    "^shutdown"                                                     # 关机
    "^reboot"                                                       # 重启
    "^halt"                                                         # 停机
    "^poweroff"                                                     # 断电
    "^chmod[[:space:]]+-R[[:space:]]+[0-7]*7[[:space:]]*/[[:space:]]*$"  # chmod 777 /
    "^chown[[:space:]].*[[:space:]]*/[[:space:]]*$"                # chown /
    "> /dev/sd"                                                     # 写裸设备
)

# ── 警告命令（允许执行但记录警告） ───────────────────────────
WARN_PATTERNS=(
    "^rm[[:space:]]"          # 任何 rm
    "^kill[[:space:]]+-9"     # kill -9
    "^pkill"                  # pkill
    "^iptables"               # 防火墙操作
    "^passwd"                 # 修改密码
    "^su[[:space:]]"          # 切换用户
    "^sudo"                   # sudo
    "^crontab"                # 定时任务
    "^wget.*|.*curl.*>[[:space:]]*/[^t]"  # 下载写系统目录
)

# ── 获取 token ───────────────────────────────────────────────
_hpc_get_token() {
    # 优先从环境变量，其次从文件
    if [ -n "$HPC_SESSION_TOKEN" ]; then
        echo "$HPC_SESSION_TOKEN"
        return
    fi
    if [ -f "$HPC_TOKEN_FILE" ]; then
        cat "$HPC_TOKEN_FILE"
        return
    fi
    echo ""
}

# ── 上报命令到后端 ───────────────────────────────────────────
_hpc_report() {
    local cmd="$1"
    local exit_code="${2:-0}"
    local blocked="${3:-false}"
    local token
    token=$(_hpc_get_token)
    [ -z "$token" ] && return

    # 异步上报，不阻塞用户操作
    curl -sf -X POST "${HPC_API_URL}/api/audit/shell" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d "{\"command\":$(echo "$cmd" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo "\"${cmd//\"/\\\"}\""),\"exit_code\":${exit_code},\"work_dir\":\"$(pwd)\",\"node\":\"${HPC_NODE}\",\"blocked\":${blocked}}" \
        --max-time 2 &>/dev/null &
}

# ── 检查是否匹配黑名单 ───────────────────────────────────────
_hpc_is_blocked() {
    local cmd="$1"
    for pattern in "${BLOCKED_PATTERNS[@]}"; do
        if echo "$cmd" | grep -qE "$pattern" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# ── 检查是否匹配警告名单 ─────────────────────────────────────
_hpc_is_warn() {
    local cmd="$1"
    for pattern in "${WARN_PATTERNS[@]}"; do
        if echo "$cmd" | grep -qE "$pattern" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# ── 主 PROMPT_COMMAND 钩子 ───────────────────────────────────
_hpc_audit_hook() {
    local exit_code=$?
    local last_cmd
    last_cmd=$(history 1 | sed 's/^[[:space:]]*[0-9]*[[:space:]]*//')

    # 跳过空命令和内部命令
    [ -z "$last_cmd" ] && return
    [ "$last_cmd" = "$_HPC_LAST_CMD" ] && return
    _HPC_LAST_CMD="$last_cmd"

    _hpc_report "$last_cmd" "$exit_code" "false"
}

# ── 命令拦截（通过 DEBUG trap 在执行前检查） ─────────────────
_hpc_preexec() {
    local cmd="$BASH_COMMAND"

    # 跳过内部命令
    [[ "$cmd" == _hpc_* ]] && return
    [[ "$cmd" == "history"* ]] && return

    if _hpc_is_blocked "$cmd"; then
        # 拦截：打印警告，终止命令
        echo ""
        echo "╔══════════════════════════════════════════════════════╗" >&2
        echo "║  ⛔  HPC 平台安全拦截                                ║" >&2
        echo "║                                                      ║" >&2
        echo "║  该命令已被系统安全策略阻止：                        ║" >&2
        printf "║  %-52s║\n" "  $cmd" >&2
        echo "║                                                      ║" >&2
        echo "║  此操作已记录并上报管理员。                          ║" >&2
        echo "╚══════════════════════════════════════════════════════╝" >&2
        echo ""
        _hpc_report "$cmd" 1 "true"
        # 终止当前命令（通过让 bash 认为命令不存在）
        kill -SIGINT $$
        return 1
    fi

    if _hpc_is_warn "$cmd"; then
        echo ""
        echo "⚠️  [HPC 安全提醒] 该操作已被记录：$cmd" >&2
        echo ""
    fi
}

# ── 安装钩子（仅交互式 shell） ───────────────────────────────
if [[ $- == *i* ]]; then
    # 追加到 PROMPT_COMMAND（不覆盖已有的）
    if [[ -z "$PROMPT_COMMAND" ]]; then
        PROMPT_COMMAND="_hpc_audit_hook"
    else
        PROMPT_COMMAND="${PROMPT_COMMAND};_hpc_audit_hook"
    fi

    # DEBUG trap：命令执行前触发
    trap '_hpc_preexec' DEBUG

    # 登录提示
    echo ""
    echo "  ✅ HPC 平台安全审计已启用 | 节点: ${HPC_NODE} | 所有操作将被记录"
    echo ""
fi
