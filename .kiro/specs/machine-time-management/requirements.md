# 需求文档 - 机时管理系统

## 简介

机时管理系统用于管理HPC集群中用户的计算资源配额。系统通过充值机制为QoS（Quality of Service）账户增加可用机时，并在作业运行时自动扣减相应的机时。该系统需要详细记录所有充值历史，并维护累计充值总额和当前可用余额。

## 术语表

- **System**: 机时管理系统
- **QoS**: Quality of Service，Slurm中的服务质量配置，用于限制和管理用户的资源使用
- **Billing**: 计费单位，表示可用的机时配额（以分钟为单位存储）
- **Recharge**: 充值操作，向QoS账户添加机时
- **Operator**: 执行充值操作的管理员用户
- **Job**: 在集群上运行的计算作业

## 需求

### 需求 1

**用户故事:** 作为系统管理员，我想要为QoS账户充值机时，以便用户可以运行计算作业。

#### 验收标准

1. WHEN 管理员提交充值请求 THEN THE System SHALL 验证QoS名称存在且充值金额大于零
2. WHEN 充值操作执行 THEN THE System SHALL 将充值金额添加到QoS的billing配额中
3. WHEN 充值成功 THEN THE System SHALL 返回充值前配额、充值后配额和充值金额
4. WHEN 充值请求包含无效的QoS名称 THEN THE System SHALL 拒绝请求并返回错误信息
5. WHEN 充值金额小于或等于零 THEN THE System SHALL 拒绝请求并返回错误信息

### 需求 2

**用户故事:** 作为系统管理员，我想要查看详细的充值历史记录，以便追踪和审计所有的机时充值操作。

#### 验收标准

1. WHEN 充值操作成功完成 THEN THE System SHALL 在充值记录表中创建一条新记录
2. WHEN 创建充值记录 THEN THE System SHALL 记录QoS名称、充值金额、充值前配额、充值后配额、操作人、备注和时间戳
3. WHEN 管理员请求查看充值历史 THEN THE System SHALL 返回按时间倒序排列的充值记录列表
4. WHEN 管理员指定QoS名称查询 THEN THE System SHALL 仅返回该QoS的充值记录
5. WHEN 管理员指定查询数量限制 THEN THE System SHALL 返回不超过指定数量的记录且默认限制为100条

### 需求 3

**用户故事:** 作为系统，我需要在作业运行时自动扣减机时，以便准确跟踪资源使用情况。

#### 验收标准

1. WHEN 作业开始运行 THEN THE System SHALL 根据作业使用的资源计算billing消耗
2. WHEN 作业完成 THEN THE System SHALL 从QoS的billing配额中扣除相应的机时
3. WHEN billing配额不足 THEN THE System SHALL 阻止新作业提交
4. WHEN 扣减操作失败 THEN THE System SHALL 记录错误并保持配额不变

### 需求 4

**用户故事:** 作为系统管理员，我想要查看QoS的当前可用机时和累计充值总额，以便了解账户状态。

#### 验收标准

1. WHEN 管理员查询QoS信息 THEN THE System SHALL 返回当前可用的billing配额（以小时为单位）
2. WHEN 管理员查询充值历史 THEN THE System SHALL 计算并显示该QoS的累计充值总额
3. WHEN QoS不存在 THEN THE System SHALL 返回错误信息
4. WHEN 配额数据格式为分钟 THEN THE System SHALL 自动转换为小时显示给用户

### 需求 5

**用户故事:** 作为系统，我需要支持多种数据库类型，以便在不同的部署环境中使用。

#### 验收标准

1. WHEN 系统初始化 THEN THE System SHALL 根据配置创建适合当前数据库类型的充值记录表
2. WHEN 数据库类型为MySQL THEN THE System SHALL 使用MySQL特定的表结构和索引
3. WHEN 数据库类型为SQLite THEN THE System SHALL 使用SQLite特定的表结构和索引
4. WHEN 执行数据库操作 THEN THE System SHALL 使用兼容当前数据库类型的SQL语法

### 需求 6

**用户故事:** 作为系统，我需要确保充值操作的原子性和数据一致性，以便避免数据丢失或不一致。

#### 验收标准

1. WHEN 充值记录保存失败 THEN THE System SHALL 仍然完成QoS配额更新并通知管理员记录保存失败
2. WHEN QoS配额更新失败 THEN THE System SHALL 不创建充值记录并返回错误信息
3. WHEN 并发充值请求到达 THEN THE System SHALL 按顺序处理每个请求以避免数据竞争
4. WHEN 读取当前配额 THEN THE System SHALL 获取最新的QoS配置数据

### 需求 7

**用户故事:** 作为系统管理员，我想要在充值时添加备注信息，以便记录充值的原因或相关说明。

#### 验收标准

1. WHEN 管理员提交充值请求 THEN THE System SHALL 接受可选的备注字段
2. WHEN 备注信息存在 THEN THE System SHALL 将备注保存到充值记录中
3. WHEN 备注信息为空 THEN THE System SHALL 允许充值操作继续进行
4. WHEN 查询充值历史 THEN THE System SHALL 在返回的记录中包含备注信息
