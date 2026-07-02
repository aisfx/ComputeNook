# 快速部署

## 修复内容

1. ✅ 账户配额卡片显示优化
   - 有限制：显示百分比 + 核数
   - 无限制有作业：显示当前核数 + 警告
   - 无限制无作业：显示友好提示

2. ✅ 节点显示改用表格形式
   - 表格列：节点名称、状态、CPU总数/已用/使用率、内存总量/已用/使用率、作业数
   - 点击行查看节点详情
   - 进度条可视化CPU和内存使用率
   - 状态标签带颜色

## 部署步骤

```bash
# 1. 上传到服务器
scp release/computenook-ee69dc0c-darwin-20260702-224522.tar.gz root@192.168.18.150:/tmp/

# 2. SSH 并部署
ssh root@192.168.18.150
pkill -f computenook
cd /root/test
mv computenook computenook.backup.$(date +%Y%m%d_%H%M%S)
tar -xzf /tmp/computenook-*.tar.gz
cp computenook.backup.*/backend/.env computenook/backend/
cd computenook
nohup ./computenook > /dev/null 2>&1 &
```

## 验证

访问 http://192.168.18.150:8081

- 账户配额：显示 "🎯 当前无运行作业 CPU配额: 无限制"
- 节点状态：表格形式显示所有节点，点击任意行查看详情

---

版本：ee69dc0c  
时间：2026-07-02 22:45
