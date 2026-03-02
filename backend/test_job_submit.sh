#!/bin/bash

# 测试作业提交API

source .env

echo "=== 测试 Slurm 作业提交 API ==="
echo "SLURM_REST_URL: $SLURM_REST_URL"
echo "SLURM_API_VERSION: $SLURM_API_VERSION"
echo ""

# 首先获取可用的分区
echo "1. 获取可用分区列表"
PARTITIONS=$(curl -s -H "X-SLURM-USER-TOKEN: $SLURM_REST_TOKEN" \
  "$SLURM_REST_URL/slurm/$SLURM_API_VERSION/partitions" | jq -r '.partitions[].name' 2>/dev/null)

if [ -z "$PARTITIONS" ]; then
  echo "❌ 无法获取分区列表，尝试使用 sinfo"
  PARTITIONS=$(sinfo -h -o "%P" | sed 's/\*//' | head -1)
fi

echo "可用分区: $PARTITIONS"
FIRST_PARTITION=$(echo "$PARTITIONS" | head -1)
echo "使用分区: $FIRST_PARTITION"
echo ""

# 测试最小化的作业提交
echo "2. 测试作业提交 (最小参数)"
cat > /tmp/test_job.json <<EOF
{
  "job": {
    "name": "test_job",
    "partition": "$FIRST_PARTITION",
    "script": "#!/bin/bash\necho 'Hello World'\nsleep 10"
  }
}
EOF

echo "请求体:"
cat /tmp/test_job.json | jq '.'
echo ""

echo "提交作业..."
curl -s -X POST \
  -H "X-SLURM-USER-TOKEN: $SLURM_REST_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_job.json \
  "$SLURM_REST_URL/slurm/$SLURM_API_VERSION/job/submit" | jq '.'

echo ""
echo "=== 测试完成 ==="
