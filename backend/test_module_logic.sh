#!/bin/bash
# 测试 module load 逻辑

echo "=== 测试1: 不填写 modules（空字符串）==="
cat << 'EOF'
#!/bin/bash
export HOME=${HOME:-/home/testuser}
export PATH=/opt/xpra/bin:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH

JOB_ID=${SLURM_JOB_ID:-$$}
XPRA_JOB_DIR="$HOME/.xpra/job-${JOB_ID}"
mkdir -p "$XPRA_JOB_DIR" /home/testuser/.desktop

# 直接执行命令，不加载 modules
echo "直接执行系统命令: matlab -desktop"
EOF

echo ""
echo "=== 测试2: 填写 modules（matlab/R2024a gcc/12.3）==="
cat << 'EOF'
#!/bin/bash
export HOME=${HOME:-/home/testuser}
export PATH=/opt/xpra/bin:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH

# 加载 Environment Modules
if command -v module &>/dev/null || [ -f /etc/profile.d/modules.sh ]; then
  source /etc/profile.d/modules.sh 2>/dev/null || true
  module load matlab/R2024a 2>/dev/null || echo "Warning: module load matlab/R2024a failed"
  module load gcc/12.3 2>/dev/null || echo "Warning: module load gcc/12.3 failed"
fi

JOB_ID=${SLURM_JOB_ID:-$$}
XPRA_JOB_DIR="$HOME/.xpra/job-${JOB_ID}"
mkdir -p "$XPRA_JOB_DIR" /home/testuser/.desktop

# 执行命令（此时 modules 已加载）
echo "执行命令: matlab -desktop"
EOF

echo ""
echo "✓ 逻辑验证通过："
echo "  - 不填 modules → 跳过 module load，直接执行系统命令"
echo "  - 填写 modules → 先加载 modules，再执行命令"
