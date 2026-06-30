# 设计文档 - 机时管理系统

## 概述

机时管理系统是HPC平台中用于管理计算资源配额的核心模块。系统通过与Slurm REST API集成，实现对QoS（Quality of Service）账户的机时充值、消费跟踪和历史记录管理。

系统采用Go语言开发，使用Gin框架提供RESTful API，支持MySQL和SQLite两种数据库。核心功能包括：
- 管理员充值机时到QoS账户
- 详细记录每次充值的历史信息
- 自动跟踪作业运行时的机时消耗
- 查询QoS账户的当前余额和累计充值

## 架构

### 系统分层

```
┌─────────────────────────────────────┐
│         前端 UI / API 客户端          │
└─────────────────────────────────────┘
                 │
                 │ HTTP/JSON
                 ▼
┌─────────────────────────────────────┐
│      Handlers (API 控制器层)         │
│  - RechargeQoS                      │
│  - GetRechargeHistory               │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│      Models (数据访问层)             │
│  - BillingRecharge                  │
│  - CreateRechargeRecord             │
│  - GetRechargeRecords               │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│      Slurm Client (外部集成层)       │
│  - GetQoS                           │
│  - UpdateQoS                        │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│      Slurm REST API                 │
└─────────────────────────────────────┘
```

### 数据流

**充值流程:**
1. 管理员通过API提交充值请求（QoS名称、金额、备注）
2. Handler验证请求参数
3. 通过Slurm Client获取当前QoS配置
4. 计算新的billing配额（当前值 + 充值金额）
5. 更新Slurm中的QoS配额
6. 在数据库中记录充值历史
7. 返回充值结果

**查询流程:**
1. 管理员请求查看充值历史
2. Handler从数据库查询记录
3. 按时间倒序返回结果

## 组件和接口

### 1. Handler层 (handlers/billing_recharge.go)

#### RechargeQoS
充值机时的HTTP处理器

**输入:**
```go
type RechargeRequest struct {
    QoSName string  `json:"qos_name" binding:"required"`
    Amount  float64 `json:"amount" binding:"required,gt=0"`
    Notes   string  `json:"notes"`
}
```

**输出:**
```json
{
  "message": "充值成功",
  "data": {
    "before_total": 17.0,
    "after_total": 27.0,
    "amount": 10.0,
    "record_id": 123
  }
}
```

**错误响应:**
- 400: 参数错误
- 404: QoS不存在
- 500: 系统错误

#### GetRechargeHistory
获取充值历史的HTTP处理器

**输入参数:**
- `qos_name` (query, optional): 过滤特定QoS的记录
- `limit` (query, optional): 返回记录数量，默认100，最大1000

**输出:**
```json
{
  "data": [
    {
      "id": 123,
      "qos_name": "normal",
      "amount": 10.0,
      "before_total": 17.0,
      "after_total": 27.0,
      "operator": "admin",
      "notes": "月度充值",
      "created_at": "2026-05-18T10:30:00Z"
    }
  ]
}
```

### 2. Model层 (models/billing_recharge.go)

#### BillingRecharge
充值记录数据模型

```go
type BillingRecharge struct {
    ID          int64     `json:"id"`
    QoSName     string    `json:"qos_name"`
    Amount      float64   `json:"amount"`        // 充值金额（小时）
    BeforeTotal float64   `json:"before_total"`  // 充值前总配额（小时）
    AfterTotal  float64   `json:"after_total"`   // 充值后总配额（小时）
    Operator    string    `json:"operator"`      // 操作人
    Notes       string    `json:"notes"`         // 备注
    CreatedAt   time.Time `json:"created_at"`    // 充值时间
}
```

#### CreateRechargeRecord
创建充值记录

**签名:**
```go
func CreateRechargeRecord(record *BillingRecharge) error
```

**功能:**
- 插入新的充值记录到数据库
- 自动设置创建时间
- 返回生成的记录ID

#### GetRechargeRecords
查询充值记录

**签名:**
```go
func GetRechargeRecords(qosName string, limit int) ([]BillingRecharge, error)
```

**功能:**
- 支持按QoS名称过滤
- 按创建时间倒序排列
- 限制返回数量

### 3. Slurm Client层 (slurm/client.go, slurm/qos.go)

#### GetQoS
获取QoS配置

**签名:**
```go
func (c *Client) GetQoS(name string) (*QoS, error)
```

**功能:**
- 从Slurm REST API获取指定QoS的完整配置
- 解析billing配额（从TRES.Minutes.Total中提取）

#### UpdateQoS
更新QoS配置

**签名:**
```go
func (c *Client) UpdateQoS(name string, qos *QoS) error
```

**功能:**
- 更新QoS的billing配额
- 使用Slurm v0.0.43 API格式

## 数据模型

### 数据库表结构

#### billing_recharge表

**MySQL版本:**
```sql
CREATE TABLE IF NOT EXISTS billing_recharge (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    qos_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    before_total DECIMAL(10,2) NOT NULL,
    after_total DECIMAL(10,2) NOT NULL,
    operator VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_qos_name (qos_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**SQLite版本:**
```sql
CREATE TABLE IF NOT EXISTS billing_recharge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qos_name TEXT NOT NULL,
    amount REAL NOT NULL,
    before_total REAL NOT NULL,
    after_total REAL NOT NULL,
    operator TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_qos_name ON billing_recharge(qos_name);
CREATE INDEX IF NOT EXISTS idx_created_at ON billing_recharge(created_at);
```

**字段说明:**
- `id`: 主键，自增
- `qos_name`: QoS名称，用于关联Slurm中的QoS配置
- `amount`: 本次充值金额（小时）
- `before_total`: 充值前的总配额（小时）
- `after_total`: 充值后的总配额（小时）
- `operator`: 执行充值操作的管理员用户名
- `notes`: 充值备注信息
- `created_at`: 充值时间戳

**索引:**
- `idx_qos_name`: 加速按QoS名称查询
- `idx_created_at`: 加速按时间排序查询

### Slurm QoS配额存储

在Slurm中，billing配额存储在QoS的TRES (Trackable RESources) 配置中：

```
limits.max.tres.minutes.total = [
  {type: "billing", id: 5, count: 102000}  // 单位：分钟
]
```

**单位转换:**
- 用户界面：小时（hours）
- 数据库记录：小时（hours）
- Slurm存储：分钟（minutes）
- 转换公式：`minutes = hours * 60`

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 充值金额累加不变性
*对于任何*有效的充值操作，充值后的配额应该等于充值前的配额加上充值金额。
**验证: 需求 1.2**

### 属性 2: 输入验证拒绝无效请求
*对于任何*充值请求，如果QoS名称不存在或充值金额小于等于零，系统应该拒绝该请求并返回错误。
**验证: 需求 1.1, 1.4, 1.5**

### 属性 3: 充值响应完整性
*对于任何*成功的充值操作，API响应应该包含充值前配额、充值后配额和充值金额三个字段。
**验证: 需求 1.3**

### 属性 4: 充值记录创建一致性
*对于任何*成功的充值操作，数据库中应该创建一条新的充值记录，且记录数量增加1。
**验证: 需求 2.1**

### 属性 5: 充值记录字段完整性
*对于任何*创建的充值记录，应该包含QoS名称、充值金额、充值前配额、充值后配额、操作人、备注和时间戳所有字段。
**验证: 需求 2.2**

### 属性 6: 充值历史时间排序
*对于任何*充值历史查询，返回的记录列表应该按创建时间倒序排列（最新的在前）。
**验证: 需求 2.3**

### 属性 7: QoS过滤正确性
*对于任何*指定QoS名称的查询，返回的所有充值记录的qos_name字段都应该等于查询参数中的QoS名称。
**验证: 需求 2.4**

### 属性 8: 查询数量限制
*对于任何*充值历史查询，返回的记录数量不应超过指定的limit参数，且当未指定limit时默认不超过100条。
**验证: 需求 2.5**

### 属性 9: 单位转换正确性
*对于任何*QoS配额查询，返回的小时数应该等于Slurm中存储的分钟数除以60。
**验证: 需求 4.1, 4.4**

### 属性 10: 累计充值总额计算
*对于任何*QoS的充值历史，累计充值总额应该等于该QoS所有充值记录的amount字段之和。
**验证: 需求 4.2**

### 属性 11: 并发充值一致性
*对于任何*一组并发的充值请求，最终的QoS配额应该等于初始配额加上所有充值金额的总和。
**验证: 需求 6.3**

### 属性 12: 备注字段可选性
*对于任何*充值请求，无论是否包含备注字段，只要其他必需字段有效，充值操作都应该成功。
**验证: 需求 7.1, 7.3**

### 属性 13: 备注保存一致性
*对于任何*包含备注的充值请求，保存后的充值记录中的notes字段应该与请求中的备注内容相同。
**验证: 需求 7.2, 7.4**

## 错误处理

### 错误类型

1. **参数验证错误 (400 Bad Request)**
   - 缺少必需字段（qos_name, amount）
   - 充值金额小于等于零
   - 参数类型错误

2. **资源不存在错误 (404 Not Found)**
   - QoS名称不存在
   - 查询的充值记录不存在

3. **外部服务错误 (500 Internal Server Error)**
   - Slurm REST API连接失败
   - Slurm API返回错误
   - 数据库连接失败
   - 数据库操作失败

### 错误处理策略

1. **充值操作的原子性**
   - 优先保证Slurm配额更新成功
   - 如果Slurm更新失败，不创建充值记录，返回错误
   - 如果Slurm更新成功但记录保存失败，仍然返回成功，但在响应中提示记录保存失败

2. **数据一致性保证**
   - 在更新Slurm配额前先获取当前配额
   - 使用获取到的当前配额计算新配额
   - 在充值记录中保存充值前后的配额快照

3. **并发控制**
   - 依赖Slurm REST API的并发控制机制
   - 数据库操作使用事务保证原子性
   - 充值历史查询使用只读事务

4. **错误日志**
   - 记录所有Slurm API调用失败
   - 记录所有数据库操作失败
   - 记录参数验证失败（用于审计）

## 测试策略

### 单元测试

单元测试覆盖具体的功能点和边缘情况：

1. **Handler层测试**
   - 测试参数验证逻辑（空QoS名称、负数金额、零金额）
   - 测试成功响应的JSON格式
   - 测试错误响应的HTTP状态码和消息

2. **Model层测试**
   - 测试CreateRechargeRecord的数据库插入
   - 测试GetRechargeRecords的查询和过滤
   - 测试数据库连接失败的处理

3. **Slurm Client测试**
   - 测试GetQoS的API调用和响应解析
   - 测试UpdateQoS的请求构建
   - 测试单位转换（分钟 ↔ 小时）

4. **边缘情况测试**
   - 不存在的QoS名称
   - 无效的充值金额（负数、零、非数字）
   - 空备注和长备注
   - 数据库保存失败的场景
   - Slurm API调用失败的场景

### 属性测试

属性测试使用Go的testing/quick包或第三方库（如gopter）来验证通用属性：

**配置要求:**
- 每个属性测试至少运行100次迭代
- 使用随机生成器生成测试数据
- 每个属性测试必须标注对应的设计文档属性编号

**测试覆盖:**

1. **属性 1: 充值金额累加不变性**
   - 生成随机的初始配额和充值金额
   - 验证：afterTotal = beforeTotal + amount

2. **属性 2: 输入验证拒绝无效请求**
   - 生成随机的无效输入（不存在的QoS、负数金额、零金额）
   - 验证：所有无效请求都被拒绝

3. **属性 3-13: 其他属性**
   - 为每个属性编写对应的属性测试
   - 使用随机数据生成器
   - 验证属性在所有输入下都成立

### 集成测试

1. **端到端充值流程**
   - 创建测试QoS
   - 执行充值操作
   - 验证Slurm配额更新
   - 验证数据库记录创建
   - 查询充值历史验证

2. **数据库兼容性测试**
   - 在MySQL环境下运行完整测试套件
   - 在SQLite环境下运行完整测试套件
   - 验证两种数据库的行为一致性

3. **并发测试**
   - 模拟多个管理员同时充值
   - 验证最终配额的正确性
   - 验证所有充值记录都被保存

### 测试工具和框架

- **单元测试**: Go标准库 `testing`
- **属性测试**: `gopter` (https://github.com/leanovate/gopter)
- **HTTP测试**: `httptest` 包
- **数据库测试**: 使用内存SQLite数据库
- **Mock**: `gomock` 或手动mock

## 性能考虑

### 数据库性能

1. **索引优化**
   - `idx_qos_name`: 加速按QoS名称过滤
   - `idx_created_at`: 加速按时间排序

2. **查询优化**
   - 使用LIMIT限制返回数量
   - 避免全表扫描
   - 对于累计统计，考虑使用聚合查询

3. **连接池**
   - 使用database/sql的连接池
   - 配置合理的最大连接数

### API性能

1. **响应时间目标**
   - 充值操作: < 2秒（包括Slurm API调用）
   - 查询历史: < 500ms

2. **并发处理**
   - 支持多个管理员同时操作
   - 使用Gin框架的并发处理能力

3. **缓存策略**
   - 不缓存QoS配额（需要实时数据）
   - 可以缓存QoS列表（变化不频繁）

## 安全考虑

### 认证和授权

1. **管理员权限验证**
   - 只有管理员可以执行充值操作
   - 通过JWT token验证用户身份
   - 检查用户的IsAdmin标志

2. **操作审计**
   - 记录每次充值的操作人
   - 记录操作时间
   - 支持审计日志查询

### 输入验证

1. **参数验证**
   - 使用Gin的binding验证
   - 验证QoS名称格式
   - 验证金额范围（> 0）

2. **SQL注入防护**
   - 使用参数化查询
   - 不拼接SQL字符串

3. **XSS防护**
   - 对备注字段进行转义
   - 限制备注长度

## 部署和配置

### 环境变量

```bash
# Slurm配置
SLURM_REST_URL=http://localhost:6820
SLURM_REST_TOKEN=your_token_here
SLURM_API_VERSION=v0.0.43
SLURM_ADMIN_USER=root

# 数据库配置
DB_TYPE=sqlite  # 或 mysql
DB_PATH=./data/hpc_platform.db  # SQLite
DB_HOST=localhost  # MySQL
DB_PORT=3306  # MySQL
DB_USER=root  # MySQL
DB_PASSWORD=password  # MySQL
DB_NAME=computenook  # MySQL
```

### 数据库初始化

系统启动时自动创建billing_recharge表：
- 在InitDatabase()函数中调用CreateBillingRechargeTable()
- 如果表已存在，不会重复创建
- 支持MySQL和SQLite两种数据库

### API路由

```go
// 需要管理员权限
adminRoutes := router.Group("/api/admin")
adminRoutes.Use(middleware.RequireAdmin())
{
    adminRoutes.POST("/billing/recharge", handlers.RechargeQoS)
    adminRoutes.GET("/billing/recharge/history", handlers.GetRechargeHistory)
}
```

## 未来扩展

### 可能的功能增强

1. **充值审批流程**
   - 充值请求需要审批
   - 多级审批支持

2. **充值计划**
   - 定期自动充值
   - 充值提醒

3. **配额预警**
   - 配额不足时发送通知
   - 配额使用趋势分析

4. **充值统计**
   - 按时间段统计充值总额
   - 按QoS统计充值分布
   - 可视化报表

5. **退款功能**
   - 支持充值回退
   - 记录退款历史

6. **批量充值**
   - 一次为多个QoS充值
   - 导入CSV文件批量充值
